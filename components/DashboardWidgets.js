"use client";

import { HiOutlineStar, HiOutlineExclamationCircle } from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";

export default function DashboardWidgets({ products, teams }) {
  // Ambil 5 tim dengan distribusi terbanyak
  const topTeams = [...(teams || [])]
    .sort((a, b) => (b.goodsDropped || 0) - (a.goodsDropped || 0))
    .slice(0, 5);

  // Monitor Stok Terkini: Tampilkan semua produk, urutkan dari stok terendah
  const monitorProducts = [...(products || [])]
    .sort((a, b) => (a.totalPacks || 0) - (b.totalPacks || 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 animate-fadeIn">
      
      {/* Widget 1: Top Sales Teams */}
      <div className="glass-card p-6 border-t-4 border-violet-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <HiOutlineStar className="text-violet-400" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Top 5 Performa Tim</h3>
            <p className="text-xs text-slate-400">Berdasarkan total nilai distribusi</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {topTeams.length === 0 ? (
            <p className="text-center py-4 text-slate-500 text-sm italic">Belum ada data distribusi sales.</p>
          ) : (
            topTeams.map((team, index) => (
              <div key={team.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50 border border-slate-400/5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    index === 0 ? 'bg-amber-500/20 text-amber-400' : 
                    index === 1 ? 'bg-slate-300/20 text-slate-300' : 
                    index === 2 ? 'bg-orange-700/20 text-orange-400' : 
                    'bg-dark-700 text-slate-500'
                  }`}>
                    #{index + 1}
                  </div>
                  <span className="font-medium text-sm text-white">{team.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-violet-400 font-mono">{formatRupiah(team.goodsDropped || 0)}</p>
                </div>
              </div>
            ))
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
                const totalSlops = Math.floor((p.totalPacks || 0) / packsPerSlop);
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

    </div>
  );
}
