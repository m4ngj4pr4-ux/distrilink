"use client";

import { useState, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import SummaryCards from "@/components/SummaryCards";
import FactoryPOForm from "@/components/FactoryPOForm";
import POHistory from "@/components/POHistory";
import ReturnsForm from "@/components/ReturnsForm";
import SalesLedger from "@/components/SalesLedger";
import {
  subscribeSummary,
  subscribeInventory,
  subscribeSalesTeams,
  subscribeProducts,
  seedSalesTeams,
  seedProducts,
} from "@/lib/firestore";

const sectionTitles = {
  dashboard: "Ringkasan Dashboard",
  po: "Purchase Order Pabrik",
  "po-history": "Riwayat PO Pabrik",
  sales: "Buku Besar Penjualan",
  inventory: "Manajemen Inventaris",
  returns: "Retur Barang",
  settings: "Pengaturan",
};

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [summary, setSummary] = useState({
    totalAssets: 0,
    factoryDebt: 0,
    salesReceivables: 0,
  });
  const [inventory, setInventory] = useState({ totalCartons: 0 });
  const [salesTeams, setSalesTeams] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seed data awal jika kosong
    seedSalesTeams().catch(console.error);
    seedProducts().catch(console.error);

    // Subscribe real-time
    const unsubSummary = subscribeSummary((data) => {
      setSummary(data);
      setLoading(false);
    });

    const unsubInventory = subscribeInventory((data) => {
      setInventory(data);
    });

    const unsubSales = subscribeSalesTeams((data) => {
      setSalesTeams(data);
    });

    const unsubProducts = subscribeProducts((data) => {
      setProducts(data);
    });

    return () => {
      unsubSummary();
      unsubInventory();
      unsubSales();
      unsubProducts();
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a2332",
            color: "#e2e8f0",
            border: "1px solid rgba(148, 163, 184, 0.1)",
            borderRadius: "12px",
            fontSize: "0.875rem",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#fff" },
          },
          error: {
            iconTheme: { primary: "#f43f5e", secondary: "#fff" },
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />

      {/* Konten Utama */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-dark-900/80 border-b border-slate-400/8 px-6 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="ml-10 md:ml-0">
              <h1 className="text-xl font-bold text-white">
                {sectionTitles[activeSection] || "Dashboard"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">
                  Sinkron Aktif
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Area konten */}
        <div className="p-6 md:p-8 space-y-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* Dashboard: tampilkan semua */}
              {activeSection === "dashboard" && (
                <>
                  <SummaryCards summary={summary} inventory={inventory} />
                  <div className="grid grid-cols-1 gap-6">
                    <FactoryPOForm products={products} />
                    <SalesLedger teams={salesTeams} products={products} />
                  </div>
                </>
              )}

              {/* PO Pabrik */}
              {activeSection === "po" && (
                <>
                  <SummaryCards summary={summary} inventory={inventory} />
                  <FactoryPOForm products={products} />
                </>
              )}

              {/* Riwayat PO */}
              {activeSection === "po-history" && (
                <>
                  <SummaryCards summary={summary} inventory={inventory} />
                  <POHistory />
                </>
              )}

              {/* Buku Penjualan */}
              {activeSection === "sales" && (
                <>
                  <SummaryCards summary={summary} inventory={inventory} />
                  <SalesLedger teams={salesTeams} products={products} />
                </>
              )}

              {/* Inventaris */}
              {activeSection === "inventory" && (
                <>
                  <SummaryCards summary={summary} inventory={inventory} />
                  <div className="glass-card p-10 text-center">
                    <p className="text-slate-400 text-sm">
                      📦 Modul Inventaris detail akan segera hadir.
                    </p>
                  </div>
                </>
              )}

              {/* Retur Barang */}
              {activeSection === "returns" && (
                <>
                  <SummaryCards summary={summary} inventory={inventory} />
                  <ReturnsForm products={products} />
                </>
              )}

              {/* Pengaturan */}
              {activeSection === "settings" && (
                <div className="glass-card p-10 text-center">
                  <p className="text-slate-400 text-sm">
                    ⚙️ Modul Pengaturan akan segera hadir.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Skeleton kartu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-5 h-[100px]">
            <div className="h-3 w-24 bg-dark-600 rounded mb-3" />
            <div className="h-6 w-36 bg-dark-600 rounded" />
          </div>
        ))}
      </div>
      {/* Skeleton tabel */}
      <div className="glass-card p-6 h-[300px]">
        <div className="h-4 w-48 bg-dark-600 rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-dark-600 rounded w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
