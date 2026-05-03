"use client";

import { HiOutlineRefresh, HiOutlineShieldCheck, HiOutlineDatabase } from "react-icons/hi";

export default function Settings({ onRecalculate, isRecalculating }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <HiOutlineDatabase size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Pemeliharaan Data</h2>
            <p className="text-xs text-slate-400">Kelola dan sinkronkan ulang data dashboard Anda</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-dark-800/50 border border-slate-400/5 flex items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Reset & Hitung Ulang Dashboard</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gunakan fitur ini jika angka di Dashboard (Aset, Hutang, Piutang) terasa tidak akurat. 
              Sistem akan menghitung ulang seluruh saldo dari transaksi yang ada.
            </p>
          </div>
          <button 
            onClick={onRecalculate}
            disabled={isRecalculating}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <HiOutlineRefresh className={isRecalculating ? "animate-spin" : ""} size={18} />
            <span>{isRecalculating ? "Memproses..." : "Hitung Ulang Sekarang"}</span>
          </button>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <HiOutlineShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Sistem & Keamanan</h2>
            <p className="text-xs text-slate-400">Informasi status aplikasi</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-dark-800/30 border border-slate-400/5">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Status Sinkronisasi</p>
            <p className="text-sm font-medium text-emerald-400">Real-time Aktif</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/30 border border-slate-400/5">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Versi Aplikasi</p>
            <p className="text-sm font-medium text-white">v1.2.0-MVP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
