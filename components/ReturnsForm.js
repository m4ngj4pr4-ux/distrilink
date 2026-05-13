"use client";

import { useState } from "react";
import { HiOutlineReply, HiOutlineClipboardCheck, HiOutlineTruck } from "react-icons/hi";
import { formatRupiah, parseInputNumber, formatInputNumber } from "@/lib/utils";
import { addReturnTransaction, addFactoryReturnTransaction } from "@/lib/firestore";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

export default function ReturnsForm({ products, teams, returns, factoryReturns }) {
  const { checkWritePermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("sales"); // "sales" or "factory"
  
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnUnit, setReturnUnit] = useState("Ct");
  const [returnReason, setReturnReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Handle Retur dari Sales
  async function handleSalesSubmit(e) {
    e.preventDefault();
    if (!checkWritePermission("mencatat retur sales")) return;
    if (!selectedTeamId || !selectedProductId || !returnQty) return toast.error("Lengkapi data retur!");
    
    const qty = parseFloat(parseInputNumber(returnQty));
    if (qty <= 0) return toast.error("Jumlah tidak valid");

    const product = products.find(p => p.id === selectedProductId);
    const team = teams.find(t => t.id === selectedTeamId);
    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);

    let totalPacksReturned = returnUnit === "Ct" ? qty * slopsPerKarton * packsPerSlop : returnUnit === "Bal" ? qty * 10 * packsPerSlop : qty * packsPerSlop;
    const returnAmount = totalPacksReturned * (product.currentSellingPrice || 0);

    setProcessing(true);
    try {
      await addReturnTransaction({
        teamId: team.id, teamName: team.name, productId: product.id, productName: product.name,
        qtyOriginal: qty, unit: returnUnit, totalPacksReturned, returnAmount, reason: returnReason || "Sisa Tarikan Sales",
        hppSnapshot: product.lastHPP || product.currentSellingPrice || 0
      });
      toast.success(`Retur ${product.name} dari ${team.name} berhasil!`);
      resetForm();
    } catch (err) { toast.error("Gagal retur: " + err.message); } finally { setProcessing(false); }
  }

  // Handle Retur ke Pabrik
  async function handleFactorySubmit(e) {
    e.preventDefault();
    if (!checkWritePermission("mencatat retur ke pabrik")) return;
    if (!selectedProductId || !returnQty) return toast.error("Lengkapi data retur pabrik!");
    
    const qty = parseFloat(parseInputNumber(returnQty));
    if (qty <= 0) return toast.error("Jumlah tidak valid");

    const product = products.find(p => p.id === selectedProductId);
    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);

    let totalPacksReturned = returnUnit === "Ct" ? qty * slopsPerKarton * packsPerSlop : returnUnit === "Bal" ? qty * 10 * packsPerSlop : qty * packsPerSlop;
    
    if (totalPacksReturned > (product.totalPacks || 0)) {
      return toast.error(`Stok Gudang tidak cukup! Sisa hanya ${(product.totalPacks || 0).toLocaleString("id-ID")} Pk.`);
    }

    const returnAmount = totalPacksReturned * (product.lastHPP || 0);

    setProcessing(true);
    try {
      await addFactoryReturnTransaction({
        productId: product.id, productName: product.name,
        qtyOriginal: qty, unit: returnUnit, totalPacksReturned, returnAmount, reason: returnReason || "Barang Cacat / Rusak"
      });
      toast.success(`Retur ${product.name} ke Pabrik berhasil! Hutang pabrik berkurang.`);
      resetForm();
    } catch (err) { toast.error("Gagal retur pabrik: " + err.message); } finally { setProcessing(false); }
  }

  function resetForm() {
    setSelectedProductId(""); setReturnQty(""); setReturnReason("");
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Tab Switcher */}
      <div className="flex bg-dark-800 p-1 rounded-xl max-w-md mx-auto border border-slate-400/10">
        <button onClick={() => {setActiveTab("sales"); resetForm();}} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "sales" ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:text-white"}`}>
          Terima dari Sales
        </button>
        <button onClick={() => {setActiveTab("factory"); resetForm();}} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "factory" ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-white"}`}>
          Kembalikan ke Pabrik
        </button>
      </div>

      {/* Form Input */}
      <div className={`glass-card p-6 border-t-4 ${activeTab === "sales" ? "border-amber-500" : "border-blue-500"}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === "sales" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"}`}>
            {activeTab === "sales" ? <HiOutlineReply size={22} /> : <HiOutlineTruck size={22} />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{activeTab === "sales" ? "Form Tarik Barang (Sales)" : "Form Retur ke Pabrik"}</h2>
            <p className="text-xs text-slate-400">{activeTab === "sales" ? "Kembalikan barang dari sales ke gudang (potong piutang)" : "Kembalikan stok gudang ke pabrik (potong hutang pabrik)"}</p>
          </div>
        </div>

        <form onSubmit={activeTab === "sales" ? handleSalesSubmit : handleFactorySubmit} className="space-y-4">
          <div className={`grid grid-cols-1 ${activeTab === "sales" ? "md:grid-cols-2" : "md:grid-cols-1"} gap-4`}>
            {activeTab === "sales" && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Tim Sales</label>
                <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="input-field w-full">
                  <option value="">— Pilih Tim —</option>
                  {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Produk</label>
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
                {activeTab === "sales" ? (
                  <>
                    <option value="Sisa Tarikan Sales">Sisa Tarikan Sales</option>
                    <option value="Barang Cacat/Rusak">Barang Cacat / Rusak</option>
                    <option value="Salah Bawa Barang">Salah Bawa Barang</option>
                  </>
                ) : (
                  <>
                    <option value="Barang Cacat / Rusak">Barang Cacat / Rusak</option>
                    <option value="Expired / Kadaluarsa">Expired / Kadaluarsa</option>
                    <option value="Kelebihan Kirim">Kelebihan Kirim</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={processing} className={`btn-primary w-full md:w-auto px-8 ${activeTab === "factory" && "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"}`}>
              {processing ? "Memproses..." : activeTab === "sales" ? "Simpan Retur Sales" : "Proses Retur Pabrik"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Riwayat */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <HiOutlineClipboardCheck className={activeTab === "sales" ? "text-amber-400" : "text-blue-400"}/> 
          Riwayat {activeTab === "sales" ? "Retur dari Sales" : "Retur ke Pabrik"}
        </h3>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                <th className="py-2 px-3">Tanggal</th>
                {activeTab === "sales" && <th className="py-2 px-3">Tim</th>}
                <th className="py-2 px-3">Produk</th>
                <th className="py-2 px-3 text-center">Jumlah</th>
                <th className="py-2 px-3">Keterangan</th>
                <th className="py-2 px-3 text-right">Potongan {activeTab === "sales" ? "Piutang" : "Hutang"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/5">
              {(activeTab === "sales" ? returns : factoryReturns)?.length === 0 ? (
                <tr><td colSpan={activeTab === "sales" ? 6 : 5} className="text-center py-6 text-slate-500 italic text-sm">Belum ada riwayat retur.</td></tr>
              ) : (
                (activeTab === "sales" ? returns : factoryReturns)?.map(r => (
                  <tr key={r.id} className="text-xs hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{r.createdAt?.toDate().toLocaleDateString("id-ID", {day: "2-digit", month:"short"})}</td>
                    {activeTab === "sales" && <td className="py-2 px-3 font-medium text-white">{r.teamName}</td>}
                    <td className="py-2 px-3 text-blue-300">{r.productName}</td>
                    <td className="py-2 px-3 text-center font-bold">{r.qtyOriginal} <span className="text-[10px] text-slate-500">{r.unit}</span></td>
                    <td className="py-2 px-3 text-slate-400">{r.reason}</td>
                    <td className={`py-2 px-3 text-right font-bold ${activeTab === "sales" ? "text-amber-400" : "text-blue-400"}`}>{formatRupiah(r.returnAmount)}</td>
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
