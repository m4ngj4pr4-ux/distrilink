"use client";

import { useState, useEffect } from "react";
import { 
  HiOutlineClipboardList, 
  HiOutlineSearch, 
  HiOutlineCalendar,
  HiOutlineTrendingUp,
  HiOutlineExclamation,
  HiOutlineTrash,
  HiOutlineX
} from "react-icons/hi";
import { formatRupiah, formatNumber } from "@/lib/utils";
import { subscribePurchases, deletePurchase } from "@/lib/firestore";
import toast from "react-hot-toast";

export default function POHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = subscribePurchases((data) => {
      setPurchases(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredPurchases = purchases.filter(p => 
    p.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleDelete() {
    if (!deleteId) return;
    const target = purchases.find(p => p.id === deleteId);
    if (!target) return;

    setDeleting(true);
    try {
      await deletePurchase(deleteId, target);
      toast.success("Data PO berhasil dihapus dan stok telah dikoreksi");
      setDeleteId(null);
    } catch (err) {
      toast.error("Gagal menghapus: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header & Search */}
      <div className="p-6 border-b border-slate-400/8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <HiOutlineClipboardList className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Riwayat PO Pabrik</h2>
              <p className="text-xs text-slate-400">Daftar masuk barang dan rincian HPP per transaksi</p>
            </div>
          </div>

          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-800/50 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4 font-semibold">Tanggal</th>
              <th className="px-6 py-4 font-semibold">Produk</th>
              <th className="px-6 py-4 font-semibold text-center">Qty</th>
              <th className="px-6 py-4 font-semibold">Harga Beli / Pk</th>
              <th className="px-6 py-4 font-semibold text-center">Ongkir</th>
              <th className="px-6 py-4 font-semibold text-emerald-400">HPP / Pack</th>
              <th className="px-6 py-4 font-semibold text-amber-400">DP (Uang Muka)</th>
              <th className="px-6 py-4 font-semibold">Sisa Hutang</th>
              <th className="px-6 py-4 font-semibold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-400/5">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="9" className="px-6 py-4 h-12 bg-dark-700/20"></td>
                </tr>
              ))
            ) : filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-6 py-12 text-center text-slate-500 italic">
                  Belum ada data transaksi.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((p) => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors text-xs">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-slate-300">
                      {p.createdAt?.toDate().toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit"
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-white">
                    {p.productName}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-emerald-400 font-bold mb-0.5">
                      {formatNumber(p.totalPack)} Pack
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {p.jumlahKarton} Ct / {p.totalSlop} Slop
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {formatRupiah(p.hargaBeliPerPack)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-slate-300 mb-0.5">
                      {formatRupiah(p.biayaPengiriman)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {formatRupiah(p.biayaPengiriman / p.jumlahKarton)} /Ct
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <HiOutlineTrendingUp size={14} />
                      {formatRupiah(p.hpp)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-amber-400/90 font-medium">
                    {formatRupiah(p.uangMuka || 0)}
                  </td>
                  <td className="px-6 py-4">
                    {p.sisaHutang > 0 ? (
                      <span className="flex items-center gap-1.5 text-rose-400 font-semibold text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 w-fit">
                        {formatRupiah(p.sisaHutang)}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Lunas</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    >
                      <HiOutlineTrash size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
                <HiOutlineExclamation className="text-rose-400" size={28} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Hapus Riwayat PO?</h3>
              <p className="text-sm text-slate-400 mb-6">
                Menghapus data ini akan otomatis mengoreksi (mengurangi) **Stok Gudang**, **Hutang**, dan **Total Aset**.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Batal</button>
                <button 
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-primary bg-rose-500 hover:bg-rose-600 flex-1"
                >
                  {deleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
