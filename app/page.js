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

  // Helper untuk format stok Karton - Slop
  function formatStockDetailed(cartons, product) {
    if (!product) return "0 Ct";
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);
    
    const fullCartons = Math.floor(cartons);
    const remainingCartons = cartons - fullCartons;
    const remainingSlops = Math.round(remainingCartons * slopsPerKarton);
    
    if (fullCartons === 0 && remainingSlops > 0) return `${remainingSlops} Slop`;
    if (remainingSlops === 0) return `${fullCartons} Ct`;
    return `${fullCartons} Ct - ${remainingSlops} Slop`;
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
                  <h2 className="text-lg font-bold text-white">Stok Gudang per Produk</h2>
                  <p className="text-xs text-slate-400">Rincian sisa barang di gudang</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th className="text-center">Konversi</th>
                      <th className="text-right">Sisa Stok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium text-white">{p.name}</td>
                        <td className="text-center text-[10px] text-slate-500">
                          1 Ct = {(p.slopsPerBall || 20) * (p.ballsPerKarton || 5)} Slop
                        </td>
                        <td className="text-right font-bold text-emerald-400">
                          {formatStockDetailed(p.stockCartons || 0, p)}
                        </td>
                      </tr>
                    ))}
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
