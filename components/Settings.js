"use client";

import { useState } from "react";
import { HiOutlineShieldCheck, HiOutlineRefresh, HiDatabase, HiOutlineExclamation, HiOutlineX } from "react-icons/hi";
import { factoryResetDatabase } from "@/lib/firestore";
import toast from "react-hot-toast";

export default function Settings({ onRecalculate, isRecalculating }) {
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleFactoryReset() {
    if (confirmText !== "HAPUS") return;
    
    setIsResetting(true);
    try {
      await factoryResetDatabase();
      toast.success("DATABASE BERHASIL DIKOSONGKAN TOTAL!");
      setShowResetModal(false);
      setConfirmText("");
      if (onRecalculate) await onRecalculate();
    } catch (err) {
      toast.error("Gagal mereset: " + err.message);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* CARD 1: REKONSILIASI */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <HiOutlineShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Sistem & Keamanan</h2>
            <p className="text-xs text-slate-400">Sinkronisasi ulang saldo dan database</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-dark-800/50 border border-slate-400/5 flex items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Sinkronisasi Ulang Saldo</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gunakan fitur ini jika angka pada dashboard tidak sesuai dengan total transaksi. 
              Sistem akan menghitung ulang seluruh saldo Piutang, Hutang, dan Aset secara manual.
            </p>
          </div>
          <button 
            onClick={onRecalculate}
            disabled={isRecalculating || isResetting}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <HiOutlineRefresh className={isRecalculating ? "animate-spin" : ""} size={18} />
            {isRecalculating ? "Memproses..." : "Sinkron Sekarang"}
          </button>
        </div>
      </div>

      {/* CARD 2: DANGER ZONE */}
      <div className="glass-card p-6 border border-rose-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
            <HiDatabase size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-rose-400">Zona Berbahaya (Danger Zone)</h2>
            <p className="text-xs text-rose-400/70">Tindakan ini tidak dapat dibatalkan</p>
          </div>
        </div>
        
        <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Factory Reset (Kosongkan Database)</h3>
            <p className="text-xs text-rose-400/80 leading-relaxed">
              Hapus SELURUH data produk, PO pabrik, stok, tim sales, dan riwayat transaksi. 
            </p>
          </div>
          <button 
            onClick={() => setShowResetModal(true)}
            disabled={isResetting || isRecalculating}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
          >
            Hapus Semua Data
          </button>
        </div>
      </div>

      {/* MODAL KONFIRMASI RESET */}
      {showResetModal && (
        <div className="modal-overlay z-[9999]" onClick={() => setShowResetModal(false)}>
          <div className="modal-content max-w-md border border-rose-500/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                  <HiOutlineExclamation size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">Konfirmasi Reset</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-500 hover:text-white"><HiOutlineX size={20}/></button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Anda akan menghapus <span className="text-rose-400 font-bold underline">seluruh data aplikasi</span>. Tindakan ini permanen dan tidak dapat dipulihkan.
              </p>
              
              <div className="bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                <p className="text-[11px] text-rose-400 font-medium uppercase mb-2">Ketik kata kunci di bawah untuk melanjutkan:</p>
                <p className="text-xl font-black text-white tracking-widest text-center mb-3 select-none">HAPUS</p>
                <input 
                  type="text" 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Ketik di sini..."
                  className="input-field w-full text-center border-rose-500/30 focus:border-rose-500"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={handleFactoryReset}
                  disabled={confirmText !== "HAPUS" || isResetting}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isResetting ? "Menghapus Database..." : "Ya, Hapus Semua Data"}
                </button>
                <button 
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-3 text-sm text-slate-400 hover:text-white font-medium"
                >
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
