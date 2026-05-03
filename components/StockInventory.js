"use client";

import { HiOutlineCube, HiOutlineRefresh } from "react-icons/hi";
import { formatNumber } from "@/lib/utils";
import { syncProductPacks } from "@/lib/firestore";
import toast from "react-hot-toast";
import { useState } from "react";

export default function StockInventory({ products }) {
  const [syncing, setSyncing] = useState(false);

  // Fungsi helper untuk hitung Bal & Slop
  function calculateBalSlop(totalPacks, packsPerSlop) {
    if (!totalPacks || !packsPerSlop) return { bal: 0, slop: 0 };
    
    const totalSlops = Math.floor(totalPacks / packsPerSlop);
    const bal = Math.floor(totalSlops / 10);
    const slop = totalSlops % 10;
    
    return { bal, slop };
  }

  async function handleManualSync() {
    setSyncing(true);
    try {
      await syncProductPacks(products);
      toast.success("Sinkronisasi stok lama berhasil!");
    } catch (err) {
      toast.error("Gagal sinkron: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="glass-card p-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <HiOutlineCube className="text-emerald-400" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Stok Barang Real-time</h2>
            <p className="text-sm text-slate-400">Saldo stok per merek dalam satuan Bal & Slop</p>
          </div>
        </div>
        <button 
          onClick={handleManualSync} 
          disabled={syncing}
          className="btn-ghost text-xs"
        >
          <HiOutlineRefresh className={syncing ? "animate-spin" : ""} size={16} />
          <span>{syncing ? "Sinkron..." : "Sinkronkan Stok Lama"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => {
          const { bal, slop } = calculateBalSlop(p.totalPacks || 0, p.packsPerSlop || 10);
          
          return (
            <div key={p.id} className="bg-dark-800/40 rounded-2xl border border-slate-400/5 p-5 hover:border-emerald-500/20 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-white text-lg group-hover:text-emerald-400 transition-colors">{p.name}</h3>
                <span className="px-2 py-1 rounded bg-dark-700 text-[10px] text-slate-500 font-mono">
                  {p.packsPerSlop || 10} Pk/Slop
                </span>
              </div>

              <div className="flex items-end gap-4 mb-6">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Jumlah Bal</p>
                  <p className="text-3xl font-black text-white font-mono">{formatNumber(bal)}</p>
                </div>
                <div className="pb-1 text-slate-600 text-xl font-light">/</div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sisa Slop</p>
                  <p className="text-3xl font-black text-emerald-500 font-mono">{slop}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-400/5 flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="font-mono text-white">{formatNumber(p.totalPacks || 0)}</span>
                  <span>Total Pack</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                  Aktif
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-slate-500 italic">Belum ada data produk tersedia.</p>
        </div>
      )}
    </div>
  );
}
