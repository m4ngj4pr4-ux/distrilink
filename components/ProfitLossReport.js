"use client";

import { useState, useEffect } from "react";
import { HiOutlineChartBar, HiTrendingUp, HiTrendingDown, HiOutlineDocumentReport } from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";
import { subscribeAllDistributions } from "@/lib/firestore";

export default function ProfitLossReport({ products }) {
  const [distributions, setDistributions] = useState([]);

  useEffect(() => {
    const unsub = subscribeAllDistributions(setDistributions);
    return () => unsub();
  }, []);

  // Hitung Data per Produk
  const reportData = products.map(p => {
    const productDist = distributions.filter(d => d.productId === p.id);
    const qtyPacks = productDist.reduce((sum, d) => sum + (d.totalPacksDistributed || 0), 0);
    const revenue = productDist.reduce((sum, d) => sum + (d.amount || 0), 0);
    const cogs = qtyPacks * (p.lastHPP || 0);
    const profit = revenue - cogs;
    
    return { 
      id: p.id, 
      name: p.name, 
      qtyPacks, 
      revenue, 
      cogs, 
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0
    };
  }).filter(item => item.qtyPacks > 0); // Hanya tampilkan produk yang sudah terjual

  const totalRevenue = reportData.reduce((sum, item) => sum + item.revenue, 0);
  const totalCOGS = reportData.reduce((sum, item) => sum + item.cogs, 0);
  const totalProfit = totalRevenue - totalCOGS;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Kartu Ringkasan Atas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-t-4 border-blue-500">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Total Pendapatan (Distribusi)</p>
          <h3 className="text-2xl font-bold text-blue-400">{formatRupiah(totalRevenue)}</h3>
        </div>
        <div className="glass-card p-6 border-t-4 border-rose-500">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Total HPP (Modal Terjual)</p>
          <h3 className="text-2xl font-bold text-rose-400">{formatRupiah(totalCOGS)}</h3>
        </div>
        <div className="glass-card p-6 border-t-4 border-emerald-500 bg-emerald-500/5">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-2">Laba Kotor (Gross Profit)</p>
          <h3 className="text-3xl font-bold text-emerald-400">{formatRupiah(totalProfit)}</h3>
        </div>
      </div>

      {/* Tabel Rincian */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <HiOutlineDocumentReport className="text-emerald-400" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Rincian Laba per Produk</h2>
            <p className="text-xs text-slate-400">Analisis margin keuntungan berdasarkan barang yang keluar</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                <th className="py-3 px-4 font-semibold rounded-tl-lg">Produk</th>
                <th className="py-3 px-4 font-semibold text-center">Qty Terjual</th>
                <th className="py-3 px-4 font-semibold text-right">Pendapatan</th>
                <th className="py-3 px-4 font-semibold text-right text-rose-400">HPP</th>
                <th className="py-3 px-4 font-semibold text-right text-emerald-400 rounded-tr-lg">Laba</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/5">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500 italic text-sm">Belum ada data penjualan/distribusi.</td>
                </tr>
              ) : (
                reportData.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-white text-sm">{item.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-emerald-400 font-bold">{item.qtyPacks.toLocaleString("id-ID")}</span> 
                      <span className="text-[10px] text-slate-500 ml-1">Pk</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{formatRupiah(item.revenue)}</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-400/80">{formatRupiah(item.cogs)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-emerald-400">{formatRupiah(item.profit)}</div>
                      <div className="text-[10px] text-emerald-500/70 mt-0.5">{item.margin.toFixed(1)}% Margin</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
