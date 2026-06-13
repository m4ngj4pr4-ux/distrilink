"use client";

import { useState, useEffect } from "react";
import { HiOutlineChartBar, HiTrendingUp, HiTrendingDown, HiOutlineDocumentReport } from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";
import { subscribeAllDistributions, subscribeReturns } from "@/lib/firestore";

export default function ProfitLossReport({ products, purchases }) {
  const [distributions, setDistributions] = useState([]);
  const [returns, setReturns] = useState([]);

  useEffect(() => {
    const unsubDist = subscribeAllDistributions(setDistributions);
    const unsubRet = subscribeReturns(setReturns);
    return () => { unsubDist(); unsubRet(); };
  }, []);

  // --- PREPROCESS DISTRIBUTIONS DEDUCTING RETURNS (LIFO per team & product) ---
  const netDistributions = (() => {
    // Group returns by teamId and productId
    const returnSummary = {};
    returns.forEach(r => {
      const key = `${r.teamId || "unknown"}_${r.productId}`;
      returnSummary[key] = (returnSummary[key] || 0) + Math.abs(r.totalPacksReturned || 0);
    });

    // Group distributions by teamId and productId
    const distGroups = {};
    distributions.forEach(d => {
      const key = `${d.teamId || "unknown"}_${d.productId}`;
      if (!distGroups[key]) distGroups[key] = [];
      distGroups[key].push({ ...d });
    });

    // Sort each group LIFO (newest first)
    for (const key of Object.keys(distGroups)) {
      distGroups[key].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
        return timeB - timeA;
      });
    }

    // Step 1: Deduct returns per team
    for (const key of Object.keys(returnSummary)) {
      let remainingReturn = returnSummary[key];
      if (remainingReturn <= 0) continue;

      const group = distGroups[key];
      if (group) {
        for (const d of group) {
          if (remainingReturn <= 0) break;
          const qty = d.totalPacksDistributed || 0;
          if (qty > 0) {
            const deduct = Math.min(qty, remainingReturn);
            d.totalPacksDistributed = qty - deduct;
            // Pro-rate the amount (revenue)
            const pricePerPack = d.pricePerPack || (qty > 0 ? (d.amount || 0) / qty : 0);
            d.amount = Math.max(0, d.totalPacksDistributed * pricePerPack);
            remainingReturn -= deduct;
          }
        }
      }
      returnSummary[key] = remainingReturn;
    }

    // Step 2: Global unmatched returns deduction
    const globalUnmatchedReturns = {};
    for (const key of Object.keys(returnSummary)) {
      const remaining = returnSummary[key];
      if (remaining > 0) {
        const productId = key.split("_")[1];
        globalUnmatchedReturns[productId] = (globalUnmatchedReturns[productId] || 0) + remaining;
      }
    }

    for (const productId of Object.keys(globalUnmatchedReturns)) {
      let remainingReturn = globalUnmatchedReturns[productId];
      if (remainingReturn <= 0) continue;

      const productDists = [];
      for (const key of Object.keys(distGroups)) {
        if (key.endsWith(`_${productId}`)) {
          productDists.push(...distGroups[key]);
        }
      }

      productDists.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
        return timeB - timeA;
      });

      for (const d of productDists) {
        if (remainingReturn <= 0) break;
        const qty = d.totalPacksDistributed || 0;
        if (qty > 0) {
          const deduct = Math.min(qty, remainingReturn);
          d.totalPacksDistributed = qty - deduct;
          const pricePerPack = d.pricePerPack || (qty > 0 ? (d.amount || 0) / qty : 0);
          d.amount = Math.max(0, d.totalPacksDistributed * pricePerPack);
          remainingReturn -= deduct;
        }
      }
    }

    const netDists = [];
    for (const key of Object.keys(distGroups)) {
      netDists.push(...distGroups[key]);
    }
    return netDists;
  })();

  // HITUNG DATA PER BATCH PO
  const batchData = purchases.map(po => {
    // Filter out internal captain-to-sales distributions to prevent double counting in P&L
    const poDist = netDistributions.filter(d => d.poId === po.id && d.source !== "captain");
    const qtyPacks = poDist.reduce((sum, d) => sum + (d.totalPacksDistributed || 0), 0);
    const revenue = poDist.reduce((sum, d) => sum + (d.amount || 0), 0);
    const cogs = poDist.reduce((sum, d) => sum + ((d.totalPacksDistributed || 0) * (d.hppSnapshot || po.hpp || 0)), 0);
    const profit = revenue - cogs;
    
    // Safely format the date, fallback if timestamp is missing or pending
    const tgl = po.createdAt && typeof po.createdAt.toDate === 'function' 
      ? po.createdAt.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" }) 
      : "-";

    return { 
      id: po.id, 
      name: `${tgl} — ${po.productName || "Produk Tidak Diketahui"}`, 
      qtyPacks, 
      totalPack: po.totalPack || 0,
      revenue, cogs, profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0
    };
  });

  // HITUNG DATA LAMA (Tanpa poId)
  const legacyDist = netDistributions.filter(d => !d.poId && d.source !== "captain");
  const legacyData = [];
  if (legacyDist.length > 0) {
    const qtyPacks = legacyDist.reduce((sum, d) => sum + (d.totalPacksDistributed || 0), 0);
    const revenue = legacyDist.reduce((sum, d) => sum + (d.amount || 0), 0);
    const cogs = legacyDist.reduce((sum, d) => {
      const p = products.find(prod => prod.id === d.productId);
      return sum + ((d.totalPacksDistributed || 0) * (d.hppSnapshot || p?.lastHPP || 0));
    }, 0);
    const profit = revenue - cogs;
    legacyData.push({
      id: "legacy-batch",
      name: "Data Historis (Legacy)",
      qtyPacks, 
      totalPack: 0,
      revenue, cogs, profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0
    });
  }

  const reportData = [...batchData, ...legacyData];
  
  console.log("Processed P&L Data:", reportData);

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
            <h2 className="text-lg font-bold text-white">Rincian Laba per PO (Batch)</h2>
            <p className="text-xs text-slate-400">Analisis margin keuntungan berdasarkan batch barang masuk</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
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
                      {item.qtyPacks > 0 || (item.totalPack && item.totalPack > 0) ? (
                        <>
                          <span className="font-mono text-emerald-400 font-bold">{item.qtyPacks.toLocaleString("id-ID")}</span> 
                          {item.totalPack ? (
                            <span className="font-mono text-slate-500">
                              {" / "}{item.totalPack.toLocaleString("id-ID")}
                            </span>
                          ) : null}
                          <span className="text-[10px] text-slate-500 ml-1">Pk</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic bg-dark-700 px-2 py-1 rounded">Belum Ada Penjualan</span>
                      )}
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
