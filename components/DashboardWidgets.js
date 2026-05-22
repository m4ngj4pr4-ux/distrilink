"use client";

import { useState } from "react";
import { HiOutlineStar, HiOutlineExclamationCircle, HiOutlineLightningBolt, HiOutlineCash, HiOutlineClock, HiOutlineTrendingUp, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineTruck, HiOutlineClipboardList } from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";

export default function DashboardWidgets({ products, teams, allDistributions, purchases, salesTransactions = [], storeInventory = [] }) {
  const [dayOffset, setDayOffset] = useState(0);

  // ─── Widget 1: Top 10 Performa Tim ───
  const topTeams = [...(teams || [])]
    .sort((a, b) => (b.goodsDropped || 0) - (a.goodsDropped || 0))
    .slice(0, 10);

  // ─── Widget 2: Monitor Stok Terkini ───
  const monitorProducts = [...(products || [])]
    .map(p => {
      const totalPurchased = (purchases || []).filter(po => po.productId === p.id).reduce((sum, po) => sum + (po.totalPack || 0), 0);
      const actualPacks = Math.max(0, totalPurchased - (p.adminDistributedPacks || 0));
      return { ...p, actualPacks };
    })
    .sort((a, b) => (a.actualPacks || 0) - (b.actualPacks || 0));

  // ─── Widget 3: Aktivitas Distribusi Terbaru ───
  const recentDistributions = [...(allDistributions || [])]
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .slice(0, 8);

  // ─── Widget 4: Top 5 Piutang Terbesar ───
  const allPiutang = [...(teams || [])]
    .map(t => ({
      ...t,
      piutang: Math.max(0, (t.goodsDropped || 0) - (t.totalDeposited || 0))
    }))
    .filter(t => t.piutang > 0)
    .sort((a, b) => b.piutang - a.piutang);

  const piutangRanking = allPiutang.slice(0, 5);
  const totalPiutangSales = allPiutang.reduce((sum, t) => sum + t.piutang, 0);

  // Hutang Pabrik yang belum lunas
  const hutangPabrik = (purchases || [])
    .filter(p => (p.sisaHutang || 0) > 0)
    .sort((a, b) => (b.sisaHutang || 0) - (a.sisaHutang || 0))
    .slice(0, 3);
  
  const totalHutangPabrik = hutangPabrik.reduce((sum, p) => sum + (p.sisaHutang || 0), 0);

  // ─── Widget 5: Setoran Hari Ini / Terpilih ───
  const selectedDate = new Date();
  selectedDate.setDate(selectedDate.getDate() + dayOffset);
  selectedDate.setHours(0, 0, 0, 0);

  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);
  
  const dailyDistributions = (allDistributions || []).filter(d => {
    const ts = d.createdAt?.toMillis?.();
    return ts && ts >= selectedDate.getTime() && ts < nextDate.getTime();
  });

  const totalDistribusiHariIni = dailyDistributions.reduce((sum, d) => sum + (d.amount || 0), 0);
  const jumlahTransaksiHariIni = dailyDistributions.length;

  // ─── Widget 6: Sales Terbaik Hari Ini / Terpilih ───
  const todayByTeam = {};
  dailyDistributions.forEach(d => {
    const name = d.teamName || d.salesName || "Unknown";
    const teamId = d.teamId;
    if (!todayByTeam[teamId]) {
      todayByTeam[teamId] = { name, total: 0, count: 0 };
    }
    todayByTeam[teamId].total += (d.amount || 0);
    todayByTeam[teamId].count += 1;
  });

  const topSalesToday = Object.values(todayByTeam)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ─── Widget 7: Aktivitas Drop Toko Hari Ini / Terpilih ───
  const dailyDrops = salesTransactions.filter(d => {
    const ts = d.waktu?.toMillis?.() || d.createdAt?.toMillis?.();
    return ts && ts >= selectedDate.getTime() && ts < nextDate.getTime();
  });
  
  const totalDropPacks = dailyDrops.reduce((sum, d) => sum + (d.jumlahDrop || 0), 0);
  const totalDropStores = new Set(dailyDrops.map(d => d.storeId)).size;
  
  const dropsBySales = {};
  dailyDrops.forEach(d => {
    const name = d.namaSales || "Unknown";
    const teamId = d.teamId;
    if (!dropsBySales[teamId]) dropsBySales[teamId] = { name, total: 0, count: 0 };
    dropsBySales[teamId].total += (d.jumlahDrop || 0);
    dropsBySales[teamId].count += 1;
  });
  const topSalesDrop = Object.values(dropsBySales).sort((a, b) => b.total - a.total).slice(0, 3);

  // ─── Widget 8: Monitor Audit Stok Toko ───
  const lowStockStores = [...storeInventory]
    .sort((a, b) => {
      // Prioritaskan yang belum pernah diaudit lama, atau stoknya paling kecil
      const timeA = a.lastAuditDate?.toMillis?.() || a.lastDropDate?.toMillis?.() || 0;
      const timeB = b.lastAuditDate?.toMillis?.() || b.lastDropDate?.toMillis?.() || 0;
      if (a.currentStock !== b.currentStock) {
        return (a.currentStock || 0) - (b.currentStock || 0);
      }
      return timeA - timeB;
    })
    .slice(0, 5);

  // Helper: format waktu relatif
  function timeAgo(timestamp) {
    if (!timestamp?.toMillis) return "-";
    const diff = Date.now() - timestamp.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
  }

  // Format Label Tanggal
  const getDateLabel = () => {
    if (dayOffset === 0) return "Hari Ini";
    if (dayOffset === -1) return "Kemarin";
    return selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };
  const dateLabel = getDateLabel();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 animate-fadeIn">
      
      {/* Widget 1: Top Sales Teams */}
      <div className="glass-card p-6 border-t-4 border-violet-500 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <HiOutlineStar className="text-violet-400" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Top 10 Performa Tim</h3>
            <p className="text-xs text-slate-400">Berdasarkan total nilai distribusi</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {topTeams.length === 0 ? (
            <p className="text-center py-4 text-slate-500 text-sm italic">Belum ada data distribusi sales.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              {topTeams.map((team, index) => (
                <div key={team.id} className="flex items-center justify-between p-2.5 rounded-xl bg-dark-800/50 border border-slate-400/5 hover:border-violet-500/20 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                      index === 0 ? 'bg-amber-500 text-dark-900 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 
                      index === 1 ? 'bg-slate-300 text-dark-900' : 
                      index === 2 ? 'bg-orange-700 text-white' : 
                      'bg-violet-600/40 text-white border border-violet-500/50 shadow-sm'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-bold text-xs text-slate-200 truncate">{team.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-black text-violet-400 font-mono">{formatRupiah(team.goodsDropped || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Widget 2: Live Stock Monitor */}
      <div className="glass-card p-6 border-t-4 border-emerald-500 flex flex-col max-h-[400px]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <HiOutlineExclamationCircle className="text-emerald-400" size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Monitor Stok Terkini</h3>
              <p className="text-xs text-slate-400">Ketersediaan barang di gudang utama</p>
            </div>
          </div>
          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider animate-pulse">Live</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {monitorProducts.length === 0 ? (
            <p className="text-center py-10 text-slate-500 italic text-sm">Tidak ada produk aktif.</p>
          ) : (
            <div className="flex flex-col gap-2.5 pb-2">
              {monitorProducts.map((p) => {
                const packsPerSlop = p.packsPerSlop || 10;
                const totalSlops = Math.floor((p.actualPacks || 0) / packsPerSlop);
                const fullBals = Math.floor(totalSlops / 10);
                const remainingSlops = totalSlops % 10;
                const isLow = fullBals < 15;
                
                return (
                  <div 
                    key={p.id} 
                    className={`flex items-center gap-4 p-3 rounded-xl transition-all border ${
                      isLow 
                        ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/50 shadow-[inset_0_0_15px_rgba(244,63,94,0.05)]" 
                        : "bg-dark-800/50 border-slate-400/5 hover:border-emerald-500/30"
                    }`}
                  >
                    {/* Product Image */}
                    <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/50 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xl opacity-30 select-none">📦</div>
                      )}
                      {isLow && (
                        <div className="absolute top-0 right-0 p-0.5 bg-rose-500 rounded-bl-lg">
                          <HiOutlineExclamationCircle className="text-white" size={10} />
                        </div>
                      )}
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-white truncate leading-none">{p.name}</h4>
                        <span className={`text-[10px] font-black font-mono ${isLow ? "text-rose-400" : "text-emerald-400"}`}>
                          {formatRupiah(p.currentSellingPrice)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {isLow ? (
                            <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shadow-sm">Kritis</span>
                          ) : (
                            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Stabil</span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-black ${isLow ? "text-rose-500" : "text-white"} flex items-baseline gap-1`}>
                            {fullBals} <span className="text-[9px] font-bold text-slate-500 uppercase">Bal</span> 
                            {remainingSlops} <span className="text-[9px] font-bold text-slate-500 uppercase">Slop</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Widget 3: Aktivitas Distribusi Terbaru */}
      <div className="glass-card p-6 border-t-4 border-blue-500 flex flex-col max-h-[400px]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <HiOutlineLightningBolt className="text-blue-400" size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Aktivitas Distribusi</h3>
              <p className="text-xs text-slate-400">Riwayat distribusi terbaru ke sales</p>
            </div>
          </div>
          <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider animate-pulse">Live</span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {recentDistributions.length === 0 ? (
            <p className="text-center py-10 text-slate-500 italic text-sm">Belum ada aktivitas distribusi.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentDistributions.map((dist, idx) => (
                <div key={dist.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50 border border-slate-400/5 hover:border-blue-500/20 transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                    <span className="text-sm">📦</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white truncate">{dist.teamName || dist.salesName || "Sales"}</p>
                      <span className="text-[10px] font-black text-blue-400 font-mono shrink-0 ml-2">{formatRupiah(dist.amount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-slate-500 truncate">
                        {dist.productName || "Produk"} • {dist.totalPacksDistributed || 0} pck
                      </p>
                      <span className="text-[9px] text-slate-600 shrink-0 ml-2">{timeAgo(dist.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Widget 4: Ringkasan Hutang & Piutang */}
      <div className="glass-card p-6 border-t-4 border-amber-500 flex flex-col max-h-[400px]">
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <HiOutlineCash className="text-amber-400" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Hutang & Piutang</h3>
            <p className="text-xs text-slate-400">Ringkasan kewajiban yang belum lunas</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {/* Piutang Sales */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Piutang Sales</p>
              <span className="text-[10px] font-black text-rose-400 font-mono">{formatRupiah(totalPiutangSales)}</span>
            </div>
            {piutangRanking.length === 0 ? (
              <p className="text-center py-3 text-slate-600 italic text-[11px]">Tidak ada piutang.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {piutangRanking.map((t, idx) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/30 transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-rose-500/20 flex items-center justify-center text-[9px] font-black text-rose-400 shrink-0">{idx + 1}</div>
                      <span className="text-xs font-bold text-slate-300 truncate">{t.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-rose-400 font-mono shrink-0">{formatRupiah(t.piutang)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Divider */}
          <div className="border-t border-slate-700/50 my-3"></div>

          {/* Hutang Pabrik */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Hutang Pabrik</p>
              <span className="text-[10px] font-black text-amber-400 font-mono">{formatRupiah(totalHutangPabrik)}</span>
            </div>
            {hutangPabrik.length === 0 ? (
              <p className="text-center py-3 text-slate-600 italic text-[11px]">Tidak ada hutang pabrik.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {hutangPabrik.map((po) => (
                  <div key={po.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 transition-all">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-300 truncate">PO #{(po.id || "").slice(-6).toUpperCase()}</p>
                      <p className="text-[9px] text-slate-500">{po.productName || "Produk"}</p>
                    </div>
                    <span className="text-[11px] font-black text-amber-400 font-mono shrink-0">{formatRupiah(po.sisaHutang || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Widget 5: Ringkasan Distribusi Harian */}
      <div className="glass-card p-6 border-t-4 border-cyan-500 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
              <HiOutlineClock className="text-cyan-400" size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Distribusi <span className="text-cyan-400">{dateLabel}</span></h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Performa distribusi tim harian</p>
            </div>
          </div>
          
          {/* Navigasi Tanggal */}
          <div className="flex items-center justify-center bg-dark-800/80 rounded-lg p-1 border border-slate-700/50 self-start sm:self-auto w-full sm:w-auto">
            <button 
              onClick={() => setDayOffset(prev => prev - 1)}
              className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors"
              title="Hari Sebelumnya"
            >
              <HiOutlineChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-bold px-2 text-cyan-400 min-w-[60px] text-center">
              {dateLabel}
            </span>
            <button 
              onClick={() => setDayOffset(prev => Math.min(0, prev + 1))}
              disabled={dayOffset === 0}
              className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Hari Berikutnya"
            >
              <HiOutlineChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-dark-800/60 rounded-xl p-4 border border-slate-700/30 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Total Nilai</p>
            <p className="text-lg font-black text-cyan-400 font-mono">{formatRupiah(totalDistribusiHariIni)}</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl p-4 border border-slate-700/30 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Transaksi</p>
            <p className="text-lg font-black text-white">{jumlahTransaksiHariIni}</p>
            <p className="text-[9px] text-slate-500">distribusi</p>
          </div>
        </div>

        {jumlahTransaksiHariIni === 0 ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-2">😴</p>
            <p className="text-xs text-slate-500 italic">Belum ada aktivitas distribusi {dateLabel.toLowerCase()}.</p>
          </div>
        ) : (
          <div className="bg-dark-800/40 rounded-xl p-3 border border-cyan-500/10">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Rata-rata per Transaksi</p>
            <p className="text-sm font-black text-cyan-400 font-mono">
              {formatRupiah(Math.round(totalDistribusiHariIni / jumlahTransaksiHariIni))}
            </p>
          </div>
        )}
      </div>

      {/* Widget 6: Sales Terbaik */}
      <div className="glass-card p-6 border-t-4 border-yellow-500 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
              <HiOutlineTrendingUp className="text-yellow-400" size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">🏆 Sales <span className="text-yellow-400">{dateLabel}</span></h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Berdasarkan nilai distribusi harian</p>
            </div>
          </div>
          
          {/* Navigasi Tanggal (Sinkron dengan sebelahnya) */}
          <div className="flex items-center justify-center bg-dark-800/80 rounded-lg p-1 border border-slate-700/50 self-start sm:self-auto w-full sm:w-auto">
            <button 
              onClick={() => setDayOffset(prev => prev - 1)}
              className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors"
            >
              <HiOutlineChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-bold px-2 text-yellow-400 min-w-[60px] text-center">
              {dateLabel}
            </span>
            <button 
              onClick={() => setDayOffset(prev => Math.min(0, prev + 1))}
              disabled={dayOffset === 0}
              className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <HiOutlineChevronRight size={16} />
            </button>
          </div>
        </div>

        {topSalesToday.length === 0 ? (
          <div className="text-center py-6 flex-1 flex flex-col items-center justify-center">
            <p className="text-3xl mb-2">🏁</p>
            <p className="text-xs text-slate-500 italic">Belum ada distribusi {dateLabel.toLowerCase()}.</p>
            <p className="text-[10px] text-slate-600 mt-1">Siapa yang memimpin {dateLabel.toLowerCase()}?</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {topSalesToday.map((s, idx) => (
              <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                idx === 0 
                  ? 'bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40 shadow-[inset_0_0_15px_rgba(234,179,8,0.03)]' 
                  : 'bg-dark-800/50 border-slate-400/5 hover:border-slate-500/20'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                    idx === 0 ? 'bg-yellow-500 text-dark-900 shadow-[0_0_12px_rgba(234,179,8,0.3)]' :
                    idx === 1 ? 'bg-slate-300 text-dark-900' :
                    idx === 2 ? 'bg-orange-700 text-white' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {idx === 0 ? '👑' : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${idx === 0 ? 'text-yellow-400' : 'text-slate-200'}`}>{s.name}</p>
                    <p className="text-[9px] text-slate-500">{s.count} transaksi</p>
                  </div>
                </div>
                <span className={`text-xs font-black font-mono shrink-0 ml-2 ${idx === 0 ? 'text-yellow-400' : 'text-slate-300'}`}>
                  {formatRupiah(s.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget 7: Aktivitas Drop Toko */}
      <div className="glass-card p-6 border-t-4 border-indigo-500 flex flex-col relative">
        <div className="absolute top-4 right-4 flex items-center bg-dark-800/80 rounded-lg p-1 border border-slate-700/50">
          <button onClick={() => setDayOffset(prev => prev - 1)} className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors">
            <HiOutlineChevronLeft size={16} />
          </button>
          <span className="text-[10px] font-bold px-2 text-indigo-400 min-w-[60px] text-center">{dateLabel}</span>
          <button onClick={() => setDayOffset(prev => Math.min(0, prev + 1))} disabled={dayOffset === 0} className="p-1 hover:bg-slate-700/50 rounded-md text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
            <HiOutlineChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6 pr-24">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <HiOutlineTruck className="text-indigo-400" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">Drop Toko <span className="text-indigo-400">{dateLabel}</span></h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Barang turun dari Sales ke Toko</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-dark-800/60 rounded-xl p-4 border border-slate-700/30 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Total Drop</p>
            <p className="text-lg font-black text-indigo-400 font-mono">{totalDropPacks.toLocaleString("id-ID")}</p>
            <p className="text-[9px] text-slate-500">pack</p>
          </div>
          <div className="bg-dark-800/60 rounded-xl p-4 border border-slate-700/30 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Cakupan Toko</p>
            <p className="text-lg font-black text-white">{totalDropStores}</p>
            <p className="text-[9px] text-slate-500">titik toko</p>
          </div>
        </div>

        {topSalesDrop.length > 0 && (
          <div className="bg-dark-800/40 rounded-xl p-3 border border-indigo-500/10 flex-1">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-2">Leaderboard Drop</p>
            <div className="space-y-2">
              {topSalesDrop.map((sales, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">{idx + 1}.</span>
                    <span className="text-white truncate max-w-[120px]">{sales.name}</span>
                  </div>
                  <span className="text-indigo-400 font-bold font-mono">{sales.total} Pk</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {topSalesDrop.length === 0 && (
          <div className="text-center py-4 flex-1 flex flex-col justify-center">
            <p className="text-xs text-slate-500 italic">Belum ada drop ke toko.</p>
          </div>
        )}
      </div>

    </div>
  );
}
