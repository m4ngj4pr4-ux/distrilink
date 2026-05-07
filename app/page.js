"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import SummaryCards from "@/components/SummaryCards";
import FactoryPOForm from "@/components/FactoryPOForm";
import POHistory from "@/components/POHistory";
import SalesLedger from "@/components/SalesLedger";
import ReturnsForm from "@/components/ReturnsForm";
import ProfitLossReport from "@/components/ProfitLossReport";
import RetailMarketing from "@/components/RetailMarketing";
import EditProductModal from "@/components/EditProductModal";
import DashboardWidgets from "@/components/DashboardWidgets";
import Settings from "@/components/Settings";
import { HiCube, HiInformationCircle, HiRefresh, HiOutlinePencil } from "react-icons/hi";
import { 
  subscribeProducts, 
  subscribeSummary, 
  subscribeInventory,
  subscribePurchases,
  subscribeSalesTeams,
  subscribeReturns,
  subscribeFactoryReturns,
  subscribeRetailStores,
  subscribeAllDistributions,
  syncProductPacks,
  recalculateSummary,
  getCountPendingSetoran,
  getSemuaPendingSetoran,
  verifikasiSetoranAdmin
} from "@/lib/firestore";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({
    totalAssets: 0,
    factoryDebt: 0,
    salesReceivables: 0,
  });
  const [inventory, setInventory] = useState({ totalCartons: 0 });
  const [purchases, setPurchases] = useState([]);
  const [teams, setTeams] = useState([]);
  const [returns, setReturns] = useState([]);
  const [factoryReturns, setFactoryReturns] = useState([]);
  const [retailStores, setRetailStores] = useState([]);
  const [allDistributions, setAllDistributions] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingList, setPendingList] = useState([]);
  const [isVerificationQueueOpen, setIsVerificationQueueOpen] = useState(false);

  useEffect(() => {
    const unsubProducts = subscribeProducts((data) => {
      setProducts(data);
      syncProductPacks(data).catch(console.error);
    });
    const unsubSummary = subscribeSummary(setSummary);
    const unsubInventory = subscribeInventory(setInventory);
    const unsubPurchases = subscribePurchases(setPurchases);
    const unsubTeams = subscribeSalesTeams(setTeams);
    const unsubReturns = subscribeReturns(setReturns);
    const unsubFactoryReturns = subscribeFactoryReturns(setFactoryReturns);
    const unsubRetail = subscribeRetailStores(setRetailStores);
    const unsubAllDist = subscribeAllDistributions(setAllDistributions);

    return () => {
      unsubProducts();
      unsubSummary();
      unsubInventory();
      unsubPurchases();
      unsubTeams();
      unsubReturns();
      unsubFactoryReturns();
      unsubRetail();
      unsubAllDist();
    };
  }, []);

  const fetchTasks = async () => {
    const list = await getSemuaPendingSetoran();
    setPendingList(list);
    setPendingCount(list.length);
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleRecalculate() {
    setIsRecalculating(true);
    try {
      await recalculateSummary();
      toast.success("Dashboard berhasil diperbarui!");
    } catch (err) {
      toast.error("Gagal memperbarui: " + err.message);
    } finally {
      setIsRecalculating(false);
    }
  }

  const handleGlobalVerify = async (item) => {
    if (confirm(`Sahkan setoran Rp ${item.nominal?.toLocaleString('id-ID')} dari ${item.namaSales}?`)) {
      try {
        await verifikasiSetoranAdmin(item.id, item.teamId, item.nominal);
        toast.success("Berhasil disahkan!");
        
        // Update local state without refetching immediately for snappier UI
        setPendingList(prev => {
          const newList = prev.filter(p => p.id !== item.id);
          if (newList.length === 0) setIsVerificationQueueOpen(false);
          return newList;
        });
        setPendingCount(prev => prev - 1);
      } catch (error) {
        toast.error("Gagal memverifikasi: " + error.message);
      }
    }
  };

  function renderContent() {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Notification Card */}
            <div 
              onClick={() => { if(pendingCount > 0) setIsVerificationQueueOpen(true); }}
              className={`cursor-pointer p-5 rounded-2xl border transition-all ${
                pendingCount > 0 
                ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-900/20 animate-pulse' 
                : 'bg-dark-800 border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Tugas Perlu Verifikasi</p>
                  <h3 className="text-2xl font-black text-white">
                    {pendingCount} <span className="text-sm font-normal text-slate-500">Setoran</span>
                  </h3>
                </div>
                <div className={`p-3 rounded-xl ${pendingCount > 0 ? 'bg-amber-500' : 'bg-slate-700'}`}>
                  <span className="text-xl">🔔</span>
                </div>
              </div>
              {pendingCount > 0 && (
                <p className="text-[10px] text-amber-500 mt-3 font-bold">
                  ⚠️ Klik untuk segera proses verifikasi di Buku Penjualan
                </p>
              )}
            </div>

            <SummaryCards summary={summary} products={products} />
            <DashboardWidgets products={products} teams={teams} />
          </div>
        );
      case "po":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <FactoryPOForm products={products} />
          </div>
        );
      case "po-history":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <POHistory purchases={purchases} distributions={allDistributions} />
          </div>
        );
      case "stock":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <HiCube className="text-blue-400" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Katalog & Stok Gudang</h2>
                  <p className="text-xs text-slate-400">Rincian sisa stok (akumulasi) dan patokan harga distribusi</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                      <th className="py-3 px-4 font-semibold text-left rounded-tl-lg w-20">Foto</th>
                      <th className="py-3 px-4 font-semibold text-left">Produk</th>
                      <th className="py-3 px-4 font-semibold text-right">HPP Terakhir / Pk</th>
                      <th className="py-3 px-4 font-semibold text-right">Target Jual / Pk</th>
                      <th className="py-3 px-4 font-semibold text-right">Sisa Stok</th>
                      <th className="py-3 px-4 font-semibold text-center rounded-tr-lg">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                    {products.map((p) => {
                      const totalPacks = p.totalPacks || 0;
                      const packsPerSlop = p.packsPerSlop || 10;
                      
                      const totalSlops = Math.floor(totalPacks / packsPerSlop);
                      const fullBals = Math.floor(totalSlops / 10);
                      const remainingSlops = totalSlops % 10;
                      
                      const stockText = `${fullBals} Bal - ${remainingSlops} Slop`;
                      const formatRp = (num) => num ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num) : "-";

                      return (
                        <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                          <td className="py-3 px-4">
                            {p.imageUrl ? (
                              <img 
                                src={p.imageUrl} 
                                alt={p.name} 
                                onClick={() => setPreviewImage({ url: p.imageUrl, name: p.name })}
                                className="w-12 h-12 rounded-lg object-cover cursor-pointer border border-slate-400/20 hover:scale-110 transition-transform" 
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-dark-700 border border-dashed border-slate-600 flex items-center justify-center text-[10px] text-slate-500">
                                No Pic
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{p.name}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {totalPacks > 0 ? formatRp(p.lastHPP) : <span className="text-slate-500">-</span>}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-400 bg-blue-500/5">
                            {totalPacks > 0 ? formatRp(p.currentSellingPrice) : <span className="text-slate-500">-</span>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-bold text-emerald-400 text-sm">{stockText}</div>
                            {totalPacks > 0 && (
                              <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                Total: {totalPacks.toLocaleString("id-ID")} Bungkus
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button 
                              onClick={() => setEditingProduct(p)}
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                              <HiOutlinePencil size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-8 text-slate-500 italic text-sm">
                          Belum ada produk di master data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Preview Gambar */}
            {previewImage && (
              <div className="modal-overlay z-[100] p-4 flex items-center justify-center" onClick={() => setPreviewImage(null)}>
                <div className="relative max-w-2xl w-full p-2 animate-zoomIn" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute -top-10 right-0 text-white hover:text-rose-400 transition-colors flex items-center gap-2 font-bold"
                  >
                    Tutup (X)
                  </button>
                  <img 
                    src={previewImage.url} 
                    alt={previewImage.name} 
                    className="w-full h-auto rounded-2xl shadow-2xl border-4 border-white/10" 
                  />
                  <p className="text-center text-white mt-4 font-bold text-lg">{previewImage.name}</p>
                </div>
              </div>
            )}

            <EditProductModal 
              product={editingProduct} 
              isOpen={!!editingProduct} 
              onClose={() => setEditingProduct(null)} 
            />
          </div>
        );
      case "laba-rugi":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <ProfitLossReport products={products} purchases={purchases} />
          </div>
        );
      case "sales":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <SalesLedger teams={teams} products={products} purchases={purchases} />
          </div>
        );
      case "retail":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <RetailMarketing />
          </div>
        );
      case "returns":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <ReturnsForm products={products} teams={teams} returns={returns} factoryReturns={factoryReturns} />
          </div>
        );
      case "settings":
        return <Settings onRecalculate={handleRecalculate} isRecalculating={isRecalculating} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">{activeSection.replace("-", " ")}</h1>
            <p className="text-slate-400">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Status Sinkron */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sinkron Aktif
            </div>

            {/* Profil Pemilik - Pindahan dari Sidebar */}
            <div className="flex items-center gap-3 pl-6 border-l border-slate-400/10">
              <div className="text-center hidden sm:block">
                <p className="text-sm font-bold text-slate-200 leading-tight">Owner</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Admin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
                O
              </div>
            </div>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}
