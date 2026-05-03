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
  subscribeAllDistributions,
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
  const [allDistributions, setAllDistributions] = useState([]);

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
    const unsubAllDist = subscribeAllDistributions(setAllDistributions);

    return () => {
      unsubProducts();
      unsubSummary();
      unsubInventory();
      unsubPurchases();
      unsubTeams();
      unsubReturns();
      unsubAllDist();
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
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                      <th className="py-3 px-4 font-semibold text-left rounded-tl-lg">Produk</th>
                      <th className="py-3 px-4 font-semibold text-right">HPP Terakhir / Pk</th>
                      <th className="py-3 px-4 font-semibold text-right">Target Jual / Pk</th>
                      <th className="py-3 px-4 font-semibold text-right rounded-tr-lg">Sisa Stok</th>
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
                            <div className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{p.name}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {formatRp(p.lastHPP)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-400 bg-blue-500/5">
                            {formatRp(p.currentSellingPrice)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-bold text-emerald-400 text-sm">{stockText}</div>
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
                        <td colSpan="4" className="text-center py-8 text-slate-500 italic text-sm">
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
      case "profit-loss":
        // Hitung Laba Kotor (Revenue - HPP)
        let totalRevenue = 0;
        let totalHPPValue = 0;

        allDistributions.forEach((dist) => {
          totalRevenue += (dist.amount || 0);
          
          const product = products.find(p => p.id === dist.productId);
          const hppPerPack = product?.lastHPP || 0;
          totalHPPValue += (hppPerPack * (dist.totalPacksDistributed || 0));
        });

        const grossProfit = totalRevenue - totalHPPValue;

        return (
          <div className="space-y-8 animate-fadeIn">
            <SummaryCards summary={summary} products={products} />
            
            <div className="glass-card p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <HiTrendingUp className="text-emerald-400" size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Laporan Laba Rugi</h2>
                  <p className="text-sm text-slate-400">Analisa keuntungan kotor dari seluruh distribusi</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-dark-800/50 p-6 rounded-2xl border border-white/5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Total Penjualan</p>
                  <p className="text-2xl font-bold text-white font-mono">{formatRupiah(totalRevenue)}</p>
                </div>
                <div className="bg-dark-800/50 p-6 rounded-2xl border border-white/5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Total COGS (HPP)</p>
                  <p className="text-2xl font-bold text-slate-400 font-mono">{formatRupiah(totalHPPValue)}</p>
                </div>
                <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20">
                  <p className="text-xs font-medium text-emerald-500/60 uppercase tracking-wider mb-2">Laba Kotor (Gross Profit)</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono">{formatRupiah(grossProfit)}</p>
                </div>
              </div>

              <div className="mt-10">
                <h3 className="text-sm font-bold text-white mb-4">Rincian Per Produk</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                        <th className="py-3 px-4 font-semibold text-left">Produk</th>
                        <th className="py-3 px-4 font-semibold text-right">Qty Terjual</th>
                        <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                        <th className="py-3 px-4 font-semibold text-right text-emerald-400">Est. Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-400/5 text-xs">
                      {products.map(p => {
                        const dists = allDistributions.filter(d => d.productId === p.id);
                        const qty = dists.reduce((sum, d) => sum + (d.totalPacksDistributed || 0), 0);
                        const rev = dists.reduce((sum, d) => sum + (d.amount || 0), 0);
                        const cost = qty * (p.lastHPP || 0);
                        const prof = rev - cost;

                        if (qty === 0) return null;

                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-400">{qty.toLocaleString("id-ID")} Pk</td>
                            <td className="py-3 px-4 text-right font-mono text-slate-300">{formatRupiah(rev)}</td>
                            <td className={`py-3 px-4 text-right font-bold font-mono ${prof >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {formatRupiah(prof)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
