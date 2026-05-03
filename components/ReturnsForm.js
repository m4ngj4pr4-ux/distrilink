"use client";

import { useState } from "react";
import { HiOutlineReply, HiOutlineClipboardCheck } from "react-icons/hi";
import { formatRupiah, parseInputNumber, formatInputNumber } from "@/lib/utils";
import { addReturnTransaction } from "@/lib/firestore";
import toast from "react-hot-toast";

export default function ReturnsForm({ products, teams, returns }) {
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnUnit, setReturnUnit] = useState("Ct");
  const [returnReason, setReturnReason] = useState("Sisa Tarikan Sales");
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTeamId || !selectedProductId || !returnQty) return toast.error("Lengkapi data retur!");
    
    const qty = parseFloat(parseInputNumber(returnQty));
    if (qty <= 0) return toast.error("Jumlah tidak valid");

    const product = products.find(p => p.id === selectedProductId);
    const team = teams.find(t => t.id === selectedTeamId);
    
    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);

    let totalPacksReturned = 0;
    if (returnUnit === "Ct") totalPacksReturned = qty * slopsPerKarton * packsPerSlop;
    else if (returnUnit === "Bal") totalPacksReturned = qty * 10 * packsPerSlop;
    else totalPacksReturned = qty * packsPerSlop;

    // Hitung nilai uang yang diretur berdasarkan harga jual saat ini
    const returnAmount = totalPacksReturned * (product.currentSellingPrice || 0);

    setProcessing(true);
    try {
      await addReturnTransaction({
        teamId: team.id,
        teamName: team.name,
        productId: product.id,
        productName: product.name,
        qtyOriginal: qty,
        unit: returnUnit,
        totalPacksReturned,
        returnAmount,
        reason: returnReason
      });
      
      toast.success(`Retur ${product.name} dari ${team.name} berhasil! Stok dipulihkan.`);
      setSelectedProductId("");
      setReturnQty("");
      setReturnReason("Sisa Tarikan Sales");
    } catch (err) {
      toast.error("Gagal retur: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="glass-card p-6 border-t-4 border-amber-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <HiOutlineReply className="text-amber-400" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Form Retur Barang (Tarik Sales)</h2>
            <p className="text-xs text-slate-400">Kembalikan sisa barang dari tim sales ke stok gudang utama</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Tim Sales</label>
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="input-field w-full">
                <option value="">— Pilih Tim —</option>
                {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Produk Diretur</label>
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="input-field w-full">
                <option value="">— Pilih Produk —</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah Barang</label>
                <input type="text" value={formatInputNumber(returnQty)} onChange={(e) => setReturnQty(parseInputNumber(e.target.value))} placeholder="0" className="input-field" />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Satuan</label>
                <select value={returnUnit} onChange={(e) => setReturnUnit(e.target.value)} className="input-field">
                  <option value="Ct">Ct</option>
                  <option value="Bal">Bal</option>
                  <option value="Slop">Slop</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Keterangan / Kondisi</label>
              <select value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="input-field w-full">
                <option value="Sisa Tarikan Sales">Sisa Tarikan Sales (Bagus)</option>
                <option value="Barang Cacat/Rusak">Barang Cacat / Rusak</option>
                <option value="Salah Bawa Barang">Salah Bawa Barang</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={processing} className="btn-primary w-full md:w-auto px-8">
              {processing ? "Memproses..." : "Simpan Retur & Pulihkan Stok"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Riwayat Retur */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><HiOutlineClipboardCheck className="text-amber-400"/> Riwayat Retur Terakhir</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                <th className="py-2 px-3">Tanggal</th>
                <th className="py-2 px-3">Tim</th>
                <th className="py-2 px-3">Produk</th>
                <th className="py-2 px-3 text-center">Jumlah</th>
                <th className="py-2 px-3">Keterangan</th>
                <th className="py-2 px-3 text-right">Nilai Pemotongan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/5">
              {returns?.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-6 text-slate-500 italic text-sm">Belum ada riwayat retur.</td></tr>
              ) : (
                returns?.map(r => (
                  <tr key={r.id} className="text-xs hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{r.createdAt?.toDate().toLocaleDateString("id-ID", {day: "2-digit", month:"short"})}</td>
                    <td className="py-2 px-3 font-medium text-white">{r.teamName}</td>
                    <td className="py-2 px-3 text-blue-300">{r.productName}</td>
                    <td className="py-2 px-3 text-center font-bold">{r.qtyOriginal} <span className="text-[10px] text-slate-500">{r.unit}</span></td>
                    <td className="py-2 px-3 text-slate-400">{r.reason}</td>
                    <td className="py-2 px-3 text-right font-bold text-amber-400">{formatRupiah(r.returnAmount)}</td>
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
