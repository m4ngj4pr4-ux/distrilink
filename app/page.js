"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import SummaryCards from "@/components/SummaryCards";
import FactoryPOForm from "@/components/FactoryPOForm";
import POHistory from "@/components/POHistory";
import SalesLedger from "@/components/SalesLedger";
// import StockInventory from "@/components/StockInventory";
// import ReturnsForm from "@/components/ReturnsForm";
import Settings from "@/components/Settings";
import { HiCube, HiInformationCircle, HiRefresh } from "react-icons/hi";
import { 
  subscribeProducts, 
  subscribeSummary, 
  subscribeInventory,
  subscribePurchases,
  subscribeSalesTeams,
  subscribeReturns,
  syncProductPacks,
  recalculateSummary
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

    return () => {
      unsubProducts();
      unsubSummary();
      unsubInventory();
      unsubPurchases();
      unsubTeams();
      unsubReturns();
    };
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

  function renderContent() {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
          </div>
        );
      case "po":
        return (
          <>
            <SummaryCards summary={summary} products={products} />
            <FactoryPOForm products={products} />
          </>
        );
      case "po-history":
        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            <POHistory purchases={purchases} />
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
                <table className="data-table whitespace-nowrap">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th>Produk</th>
                      <th className="text-right">HPP Terakhir / Pk</th>
                      <th className="text-right">Target Jual / Pk</th>
                      <th className="text-right">Sisa Stok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                    {products.map((p) => {
                      // Gunakan totalPacks sebagai sumber kebenaran utama
                      const totalPacks = p.totalPacks || 0;
                      const packsPerSlop = p.packsPerSlop || 10;
                      
                      // Konversi matematika murni ke Bal & Slop
                      const totalSlops = Math.floor(totalPacks / packsPerSlop);
                      const fullBals = Math.floor(totalSlops / 10); // 1 Bal = 10 Slop
                      const remainingSlops = totalSlops % 10;
                      
                      // Format text konsisten
                      const stockText = `${fullBals} Bal - ${remainingSlops} Slop`;

                      // Format Rupiah helper inline
                      const formatRp = (num) => num ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num) : "-";

                      return (
                        <tr key={p.id}>
                          <td className="font-bold text-white text-sm">{p.name}</td>
                          <td className="text-right font-mono text-slate-300">
                            {formatRp(p.lastHPP || (p.currentSellingPrice ? p.currentSellingPrice * 0.9 : 0))}
                          </td>
                          <td className="text-right font-mono font-bold text-blue-400">
                            {formatRp(p.currentSellingPrice)}
                          </td>
                          <td className="text-right font-bold text-emerald-400 text-sm">
                            {stockText}
                            {totalPacks > 0 && (
                               <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                 Total: {totalPacks.toLocaleString("id-ID")} Bungkus
                               </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-slate-500 italic text-sm">
                          Belum ada produk di master data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case "sales":
        return (
          <>
            <SummaryCards summary={summary} products={products} />
            <SalesLedger teams={teams} products={products} />
          </>
        );
      case "inventory":
        return (
          <div className="glass-card p-12 text-center text-slate-400 italic">
            Modul ini sedang disiapkan.
          </div>
        );
      case "returns":
        return (
          <div className="glass-card p-12 text-center text-slate-400 italic">
            Modul ini sedang disiapkan.
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sinkron Aktif
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}
