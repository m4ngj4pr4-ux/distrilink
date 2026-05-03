"use client";

import { HiOutlineStar, HiOutlineExclamationCircle } from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";

export default function DashboardWidgets({ products, teams }) {
  // Ambil 5 tim dengan distribusi terbanyak
  const topTeams = [...(teams || [])]
    .sort((a, b) => (b.goodsDropped || 0) - (a.goodsDropped || 0))
    .slice(0, 5);

  // Ambil produk dengan stok di bawah 5 Bal (1 Bal = 10 Slop = 100 Pack)
  // 5 Bal = 500 Pack
  const lowStockProducts = (products || [])
    .filter(p => (p.totalPacks || 0) < 500)
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

      {/* Widget 2: Low Stock Alert */}
      <div className="glass-card p-6 border-t-4 border-rose-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <HiOutlineExclamationCircle className="text-rose-400" size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Radar Peringatan Stok</h3>
            <p className="text-xs text-slate-400">Produk menipis (Di bawah 5 Bal)</p>
          </div>
        </div>

        <div className="space-y-4">
          {lowStockProducts.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-emerald-400 text-sm font-medium">Semua stok aman terkendali!</p>
            </div>
          ) : (
            lowStockProducts.map((p) => {
              const packsPerSlop = p.packsPerSlop || 10;
              const totalSlops = Math.floor((p.totalPacks || 0) / packsPerSlop);
              const fullBals = Math.floor(totalSlops / 10);
              const remainingSlops = totalSlops % 10;
              
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <span className="font-bold text-sm text-white">{p.name}</span>
                  <div className="text-right">
                    <p className={`text-sm font-bold font-mono ${fullBals === 0 ? 'text-rose-500' : 'text-amber-400'}`}>
                      {fullBals} Bal - {remainingSlops} Slop
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Sisa {p.totalPacks || 0} Pk</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
