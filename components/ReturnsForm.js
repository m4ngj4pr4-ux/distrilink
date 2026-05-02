"use client";

import { useState } from "react";
import { 
  HiOutlineReply, 
  HiOutlineSave, 
  HiOutlineRefresh,
  HiOutlineExclamation
} from "react-icons/hi";
import { addReturn } from "@/lib/firestore";
import toast from "react-hot-toast";

export default function ReturnsForm({ products }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [form, setForm] = useState({
    jumlahKarton: "",
    reason: "",
    type: "factory", // factory atau sales
  });
  const [saving, setSaving] = useState(false);

  const selectedProduct = products?.find(p => p.id === selectedProductId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedProductId) return toast.error("Pilih produk");
    if (!form.jumlahKarton || form.jumlahKarton <= 0) return toast.error("Jumlah tidak valid");
    if (!form.reason) return toast.error("Alasan retur wajib diisi");

    setSaving(true);
    try {
      await addReturn({
        productId: selectedProductId,
        productName: selectedProduct.name,
        jumlahKarton: parseInt(form.jumlahKarton),
        reason: form.reason,
        type: form.type,
        // Kita asumsikan HPP diambil dari data produk atau PO terakhir (untuk MVP kita pakai estimasi sederhana)
        hpp: 0, 
      });

      toast.success("Retur barang berhasil dicatat!");
      setForm({ jumlahKarton: "", reason: "", type: "factory" });
      setSelectedProductId("");
    } catch (err) {
      toast.error("Gagal mencatat retur: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
          <HiOutlineReply className="text-rose-400" size={22} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Retur Barang</h2>
          <p className="text-xs text-slate-400">Catat barang rusak atau tidak sesuai pesanan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Produk</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">— Pilih produk —</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Jenis Retur</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="input-field w-full"
            >
              <option value="factory">Retur ke Pabrik (Potong Hutang)</option>
              <option value="sales">Retur dari Sales (Masuk Gudang Kembali)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah (Karton)</label>
            <input
              type="number"
              value={form.jumlahKarton}
              onChange={(e) => setForm({ ...form, jumlahKarton: e.target.value })}
              placeholder="mis. 1"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Alasan Retur</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="mis. Segel rusak / Salah merek"
              className="input-field"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
          <HiOutlineExclamation className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-xs text-amber-200/70 leading-relaxed">
            Mencatat retur akan secara otomatis menyesuaikan **Stok Gudang** dan **Total Aset**. Jika retur ke pabrik, sistem juga akan memotong saldo **Hutang Pabrik**.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button 
            type="button"
            onClick={() => {
              setForm({ jumlahKarton: "", reason: "", type: "factory" });
              setSelectedProductId("");
            }}
            className="btn-ghost"
          >
            <HiOutlineRefresh size={16} />
            Reset
          </button>
          <button 
            type="submit"
            disabled={saving}
            className="btn-primary px-8"
          >
            <HiOutlineSave size={16} />
            {saving ? "Menyimpan..." : "Simpan Retur"}
          </button>
        </div>
      </form>
    </div>
  );
}
