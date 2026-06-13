"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SummaryCards from "@/components/SummaryCards";
import FactoryPOForm from "@/components/FactoryPOForm";
import POHistory from "@/components/POHistory";
import SalesLedger from "@/components/SalesLedger";
import ReturnsForm from "@/components/ReturnsForm";
import ProfitLossReport from "@/components/ProfitLossReport";
import RetailMarketing from "@/components/RetailMarketing";
import FinanceModule from "@/components/FinanceModule";
import EditProductModal from "@/components/EditProductModal";
import DashboardWidgets from "@/components/DashboardWidgets";
import Settings from "@/components/Settings";
import HPPCalculator from "@/components/HPPCalculator";
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
  getSemuaPendingSetoran, 
  verifikasiSetoranAdmin, 
  subscribeAdminUsers,
  seedDefaultOwner,
  subscribeAllSalesTransactions,
  subscribeAllStoreInventory,
  calculatePOBatchesWithRealSisa
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { useAdminAuth } from "@/lib/AdminAuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export default function DashboardPage() {
  const { adminUser } = useAdminAuth();
  const { isInvestor, checkWritePermission } = usePermissions();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState(searchParams.get("section") || "dashboard");
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
  const [salesTransactions, setSalesTransactions] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [expandedProducts, setExpandedProducts] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingList, setPendingList] = useState([]);
  const [isVerificationQueueOpen, setIsVerificationQueueOpen] = useState(false);

  const allAvailableBatches = useMemo(() => {
    return calculatePOBatchesWithRealSisa(purchases, allDistributions, returns);
  }, [purchases, allDistributions, returns]);

  useEffect(() => {
    if (adminUser?.role === 'investor' && activeSection === 'settings') {
      setActiveSection('dashboard');
    }
  }, [adminUser, activeSection]);

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
    const unsubSalesTx = subscribeAllSalesTransactions(setSalesTransactions);
    const unsubStoreInv = subscribeAllStoreInventory(setStoreInventory);

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
      unsubSalesTx();
      unsubStoreInv();
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



  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateSummary();
      toast.success("Sinkronisasi saldo berhasil!");
    } catch (err) {
      toast.error("Gagal sinkronisasi: " + err.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleGlobalVerify = async (item) => {
    if (!checkWritePermission("verifikasi setoran")) return;
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
          <div className="space-y-8 animate-fadeIn">
            {pendingCount > 0 && (
              <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <p className="text-xs text-amber-400 font-bold">
                    Ada {pendingCount} setoran yang menunggu verifikasi.
                  </p>
                </div>
                <button 
                  onClick={() => setIsVerificationQueueOpen(true)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-dark-900 text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Proses Sekarang
                </button>
              </div>
            )}
            <SummaryCards summary={summary} products={products} purchases={purchases} />
            <DashboardWidgets 
              products={products} 
              teams={teams} 
              allDistributions={allDistributions} 
              purchases={purchases} 
              salesTransactions={salesTransactions}
              storeInventory={storeInventory}
            />
          </div>
        );
      case "po":
        if (adminUser?.role === 'admin') return null; // Admin can't see PO, but Investor can
        return (
          <div className="space-y-8 animate-fadeIn">
            <FactoryPOForm products={products} />
          </div>
        );
      case "po-history":
        if (adminUser?.role === 'admin') return null;
        return (
          <div className="space-y-8 animate-fadeIn">
            <POHistory purchases={purchases} distributions={allDistributions} />
          </div>
        );
      case "stock":
        return (
          <div className="space-y-8 animate-fadeIn">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <HiCube className="text-blue-400" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Katalog & Stok Gudang</h2>
                  <p className="text-xs text-slate-400">Rincian sisa stok (akumulasi) dan rincian dinamis per batch PO masuk</p>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                      <th className="py-3 px-4 font-semibold text-left rounded-tl-lg w-20">Foto</th>
                      <th className="py-3 px-4 font-semibold text-left">Produk</th>
                      <th className="py-3 px-4 font-semibold text-right">HPP Terakhir / Pk</th>
                      <th className="py-3 px-4 font-semibold text-right">Target Jual / Pk</th>
                      <th className="py-3 px-4 font-semibold text-right">Sisa Stok Gudang</th>
                      <th className="py-3 px-4 font-semibold text-center rounded-tr-lg">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                    {products.map((p) => {
                      // 1. Ambil semua batch PO aktif untuk produk ini dengan sisa stok riil, urutkan dari yang TERBARU (Descending)
                      const batches = allAvailableBatches
                        .filter(b => b.productId === p.id && b.realSisa > 0)
                        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                        
                      // 2. Total pack sisa di gudang adalah jumlah sisa dari seluruh batch aktif
                      const totalPacks = batches.reduce((sum, b) => sum + b.realSisa, 0);

                      const packsPerSlop = p.packsPerSlop || 10;
                      const totalSlops = Math.floor(totalPacks / packsPerSlop);
                      const fullBals = Math.floor(totalSlops / 10);
                      const remainingSlops = totalSlops % 10;
                      const remainingPacks = totalPacks % packsPerSlop;
                      
                      const stockText = `${fullBals} Bal - ${remainingSlops} Slop - ${remainingPacks} Pk`;
                      const formatRp = (num) => num ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num) : "-";

                      // HPP dan Target Jual dinamis berdasarkan PO aktif terbaru
                      const latestActiveBatch = batches[0]; // PO paling baru yang masih ada sisa stok
                      const displayHPP = latestActiveBatch ? latestActiveBatch.hpp : p.lastHPP;
                      const displaySellingPrice = latestActiveBatch ? latestActiveBatch.targetHargaJual : p.currentSellingPrice;
                      return (
                        <div key={p.id} className="contents">
                          <tr className="hover:bg-white/5 transition-colors group">
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
                              <div className="flex items-center gap-2">
                                {batches.length > 0 && (
                                  <button 
                                    onClick={() => setExpandedProducts(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                    className="text-[10px] bg-slate-800 text-slate-400 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 transition-colors flex items-center gap-1 font-mono font-bold"
                                    title="Lihat Rincian Batch PO"
                                  >
                                    {expandedProducts[p.id] ? "▼ Tutup" : "▶ Detail"}
                                  </button>
                                )}
                                <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{p.name}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-300">
                              {totalPacks > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span>{formatRp(displayHPP)}</span>
                                  {latestActiveBatch && <span className="text-[8px] text-slate-500">Batch {latestActiveBatch.id.slice(-4).toUpperCase()}</span>}
                                </div>
                              ) : <span className="text-slate-500">-</span>}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-blue-400 bg-blue-500/5">
                              {totalPacks > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span>{formatRp(displaySellingPrice)}</span>
                                  {latestActiveBatch && <span className="text-[8px] text-blue-500/50">Batch {latestActiveBatch.id.slice(-4).toUpperCase()}</span>}
                                </div>
                              ) : <span className="text-slate-500">-</span>}
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
                                onClick={() => {
                                  if (checkWritePermission("edit produk")) {
                                    setEditingProduct(p);
                                  }
                                }}
                                className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-colors"
                              >
                                <HiOutlinePencil size={18} />
                              </button>
                            </td>
                          </tr>
                          {expandedProducts[p.id] && batches.length > 0 && (
                            <tr className="bg-dark-900/40">
                              <td colSpan={6} className="py-4 px-6">
                                <div className="bg-dark-800/80 rounded-2xl border border-slate-700/60 p-4 shadow-inner animate-fadeIn">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    📦 Rincian Batch PO Aktif (FIFO Inventory)
                                  </p>
                                  <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                                          <th className="py-2 px-3">Tanggal PO</th>
                                          <th className="py-2 px-3">Kode Batch (ID)</th>
                                          <th className="py-2 px-3 text-right text-emerald-400">HPP PO / Pk</th>
                                          <th className="py-2 px-3 text-right text-blue-400">Target Jual / Pk</th>
                                          <th className="py-2 px-3 text-right">Sisa Stok Batch</th>
                                          <th className="py-2 px-3 text-right">Total Pack</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-700/30">
                                        {batches.map(batch => {
                                          const batchPacks = batch.realSisa || 0;
                                          const bSlops = Math.floor(batchPacks / packsPerSlop);
                                          const bBals = Math.floor(bSlops / 10);
                                          const bRemainingSlops = bSlops % 10;
                                          const bRemainingPacks = batchPacks % packsPerSlop;
                                          
                                          return (
                                            <tr key={batch.id} className="hover:bg-slate-700/20 transition-colors">
                                              <td className="py-2.5 px-3 text-slate-400 font-medium">
                                                {batch.createdAt ? new Date(batch.createdAt.toDate()).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                                              </td>
                                              <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                                                {batch.id ? batch.id.slice(-6).toUpperCase() : "-"}
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">
                                                {formatRp(batch.hpp)}
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono text-blue-400 font-bold">
                                                {formatRp(batch.targetHargaJual)}
                                              </td>
                                              <td className="py-2.5 px-3 text-right text-slate-300 font-bold">
                                                {bBals} Bal - {bRemainingSlops} Slop - {bRemainingPacks} Pack
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-mono text-slate-500 font-semibold">
                                                {batchPacks.toLocaleString("id-ID")} Pk
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </div>
                      );
                    })}
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
        if (adminUser?.role === 'admin') return null;
        return (
          <div className="space-y-8 animate-fadeIn">
            <ProfitLossReport products={products} purchases={purchases} />
          </div>
        );
      case "keuangan":
        if (!['owner', 'investor'].includes(adminUser?.role)) return null;
        return (
          <div className="space-y-8 animate-fadeIn">
            <FinanceModule products={products} purchases={purchases} />
          </div>
        );
      case "sales":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SalesLedger teams={teams} products={products} purchases={purchases} allDistributions={allDistributions} returns={returns} />
          </div>
        );
      case "retail":
        return (
          <div className="space-y-8 animate-fadeIn">
            <RetailMarketing />
          </div>
        );
      case "returns":
        if (adminUser?.role === 'admin') return null;
        return (
          <div className="space-y-8 animate-fadeIn">
            <ReturnsForm products={products} teams={teams} returns={returns} factoryReturns={factoryReturns} />
          </div>
        );
      case "kalkulator":
        return (
          <div className="animate-fadeIn">
            <HPPCalculator />
          </div>
        );
      case "settings":
        if (adminUser?.role !== 'owner') return null;
        return <Settings onRecalculate={handleRecalculate} isRecalculating={isRecalculating} />;
      default:
        return null;
    }
  }

  return (
    <Suspense fallback={<div className="h-screen bg-dark-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div></div>}>
      <div className="flex h-screen bg-dark-900 text-slate-200 overflow-hidden font-sans">
        <Sidebar 
          activeSection={activeSection} 
          onNavigate={setActiveSection} 
          pendingCount={pendingCount}
        />
        
        <main className="flex-1 overflow-y-auto custom-scrollbar relative p-4 md:p-8 pt-[80px] md:pt-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white capitalize">{activeSection.replace("-", " ")}</h1>
              <p className="text-slate-400 text-xs mt-1">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Profil User */}
              <div className="flex items-center gap-3 pl-6 border-l border-slate-400/10">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-200 leading-tight">{adminUser?.nama}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{adminUser?.role}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/20 uppercase">
                  {adminUser?.nama?.[0] || 'A'}
                </div>
              </div>
            </div>
          </header>
          {renderContent()}
        </main>

        {/* Global Verification Hub Modal */}
        {isVerificationQueueOpen && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4">
            <div className="bg-dark-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[80vh] animate-slideIn">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-dark-800 rounded-t-2xl shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🔔</span> Antrean Verifikasi Setoran
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Daftar setoran sales yang menunggu persetujuan Anda</p>
                </div>
                <button onClick={() => setIsVerificationQueueOpen(false)} className="text-slate-400 hover:text-white text-2xl px-2">&times;</button>
              </div>

              {/* Modal Body (Scrollable List) */}
              <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex flex-col gap-3">
                  {pendingList.map(item => (
                    <div key={item.id} className="bg-dark-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between hover:border-emerald-500/50 transition-colors">
                      <div>
                        <h3 className="font-bold text-emerald-400">{item.teamName || item.namaSales || "Sales"}</h3>
                        <p className="text-[11px] font-medium text-slate-400 mb-1">
                          {item.waktu ? new Date(item.waktu.toDate()).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : '-'}
                        </p>
                        {item.catatan && <p className="text-[10px] text-slate-500 italic max-w-[200px] truncate">"{item.catatan}"</p>}
                      </div>
                      
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Nominal Setor</p>
                          <p className="font-black text-white text-lg">Rp {item.nominal?.toLocaleString('id-ID')}</p>
                        </div>
                        <button 
                          onClick={() => handleGlobalVerify(item)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-emerald-900/30 whitespace-nowrap active:scale-95"
                        >
                          ✅ Sahkan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          </div>
        )}
      </div>
    </Suspense>
  );
}
