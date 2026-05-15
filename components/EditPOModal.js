"use client";

import { useState, useEffect } from "react";
import { HiOutlineX, HiOutlineSave, HiOutlineCalculator } from "react-icons/hi";
import { updatePO } from "@/lib/firestore";
import { formatRupiah } from "@/lib/utils";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

export default function EditPOModal({ po, onClose, distributions }) {
  const { checkWritePermission } = usePermissions();
  const [form, setForm] = useState({
    tanggal: "", // Tambah field tanggal
    jumlahKarton: "",
    hargaBeliPerPack: "",
    targetHargaJual: "",
    biayaPengiriman: "",
    uangMuka: "",
    ekstraSlopPerKarton: 0
  });
  const [saving, setSaving] = useState(false);

  // LOGIKA KUNCI QTY: Cek apakah PO ini sudah pernah didistribusikan
  const isQtyLocked = distributions?.some(d => d.poId === po.id);

  useEffect(() => {
    if (po) {
      // Format tanggal untuk input type="date" (YYYY-MM-DD)
      const dateObj = po.createdAt?.toDate ? po.createdAt.toDate() : new Date();
      const dateStr = dateObj.toISOString().split('T')[0];

      setForm({
        tanggal: dateStr,
        jumlahKarton: po.jumlahKarton || "",
        hargaBeliPerPack: po.hargaBeliPerPack || "",
        targetHargaJual: po.targetHargaJual || "",
        biayaPengiriman: po.biayaPengiriman || "",
        uangMuka: po.uangMuka || "",
        ekstraSlopPerKarton: po.conversion?.ekstraSlopPerKarton || 0
      });
    }
  }, [po]);

  if (!po) return null;
  
  // LOGIKA HITUNG ULANG (Mirip FactoryPOForm)
  const karton = parseFloat(form.jumlahKarton) || 0;
  const hargaPack = parseFloat(form.hargaBeliPerPack) || 0;
  const ongkir = parseFloat(form.biayaPengiriman) || 0;
  const dp = parseFloat(form.uangMuka) || 0;

  const packsPerSlop = po.conversion?.packsPerSlop || 10;
  const extraSlop = parseInt(form.ekstraSlopPerKarton) || 0;
  const slopsPerKarton = ((po.conversion?.slopsPerBall || 20) * (po.conversion?.ballsPerKarton || 5)) + extraSlop;
  const totalPacks = karton * slopsPerKarton * packsPerSlop;
  
  const totalBarang = totalPacks * hargaPack;
  const totalFaktur = totalBarang + ongkir;
  const newHpp = totalPacks > 0 ? totalFaktur / totalPacks : 0;
  const newSisaHutang = totalFaktur - dp;

  async function handleSave() {
    if (!checkWritePermission("mengedit riwayat PO")) return;
    if (karton <= 0 || hargaPack <= 0) return toast.error("Jumlah & Harga harus valid!");
    
    // Hitung Dampak untuk Konfirmasi
    const oldPacksPerSlop = po.conversion?.packsPerSlop || 10;
    const oldSlopsPerKarton = ((po.conversion?.slopsPerBall || 20) * (po.conversion?.ballsPerKarton || 5)) + (po.conversion?.ekstraSlopPerKarton || 0);
    const oldPacks = (po.jumlahKarton || 0) * oldSlopsPerKarton * oldPacksPerSlop;
    const deltaPacks = totalPacks - oldPacks;
    
    const oldSisaHutang = po.sisaHutang || 0;
    const deltaHutang = newSisaHutang - oldSisaHutang;

    // VALIDASI: Jika Qty Terkunci, hanya boleh menambah (tidak boleh mengurangi stok yang sudah teralokasi)
    if (isQtyLocked && deltaPacks < 0) {
      return toast.error("Gagal: Tidak dapat mengurangi stok karena barang sudah didistribusikan ke sales.");
    }

    const message = `Konfirmasi Perubahan:
${deltaPacks !== 0 ? `• Stok: ${deltaPacks > 0 ? "+" : ""}${deltaPacks.toLocaleString()} Pack` : "• Stok: Tidak berubah"}
${deltaHutang !== 0 ? `• Hutang: ${deltaHutang > 0 ? "+" : ""}${formatRupiah(deltaHutang)}` : "• Hutang: Tidak berubah"}

Lanjutkan pembaruan dan sinkronisasi data?`;

    if (!confirm(message)) return;

    setSaving(true);
    try {
      // Konversi string tanggal kembali ke Date object
      const newDate = new Date(form.tanggal);
      // Tambahkan jam sekarang agar tidak mentok di jam 00:00 jika perlu, 
      // tapi biasanya tanggal saja cukup untuk urutan harian.
      
      await updatePO(po.id, {
        createdAt: newDate, // Update tanggal transaksi
        jumlahKarton: karton,
        hargaBeliPerPack: hargaPack,
        targetHargaJual: parseFloat(form.targetHargaJual) || 0,
        biayaPengiriman: ongkir,
        uangMuka: dp,
        hpp: newHpp,
        totalFaktur: totalFaktur,
        sisaHutang: newSisaHutang,
        // Update rincian unit juga agar sinkron
        totalBall: karton * (po.conversion?.ballsPerKarton || 5),
        totalSlop: karton * slopsPerKarton,
        totalPack: totalPacks,
        conversion: {
          ...po.conversion,
          ekstraSlopPerKarton: extraSlop
        }
      });
      toast.success("Data PO berhasil diperbarui!");
      onClose();
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="modal-overlay z-[150]" onClick={onClose}>
      <div className="modal-content animate-zoomIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <HiOutlineCalculator className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Edit Riwayat PO</h2>
              <p className="text-xs text-slate-400">{po.productName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <HiOutlineX size={22} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tanggal Transaksi</label>
            <input 
              type="date" 
              value={form.tanggal} 
              onChange={e => setForm({...form, tanggal: e.target.value})} 
              className="input-field" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah Karton</label>
              <input 
                type="number" 
                value={form.jumlahKarton} 
                onChange={e => setForm({...form, jumlahKarton: e.target.value})} 
                disabled={isQtyLocked}
                className={`input-field ${isQtyLocked ? "opacity-50 cursor-not-allowed bg-dark-800" : ""}`} 
              />
              {isQtyLocked && (
                <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1">
                  <span>🔒</span> Qty Utama & Harga dikunci karena distribusi aktif.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Harga Beli / Pack</label>
              <input 
                type="number" 
                value={form.hargaBeliPerPack} 
                onChange={e => setForm({...form, hargaBeliPerPack: e.target.value})} 
                disabled={isQtyLocked}
                className={`input-field ${isQtyLocked ? "opacity-50 cursor-not-allowed bg-dark-800" : ""}`} 
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-amber-500 mb-1.5 flex items-center gap-2">
                Ekstra Slop / Karton
                <span className="text-[9px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Unlocked</span>
              </label>
              <input 
                type="number" 
                value={form.ekstraSlopPerKarton} 
                onChange={e => setForm({...form, ekstraSlopPerKarton: e.target.value})} 
                className="input-field border-amber-500/30 focus:border-amber-500 text-amber-400 font-bold" 
                placeholder="0"
              />
              <p className="text-[9px] text-slate-500 mt-1.5 italic">
                Anda masih dapat menambah jumlah slop ekstra meskipun Qty utama dikunci.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Biaya Ongkir</label>
              <input type="number" value={form.biayaPengiriman} onChange={e => setForm({...form, biayaPengiriman: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Uang Muka (DP)</label>
              <input type="number" value={form.uangMuka} onChange={e => setForm({...form, uangMuka: e.target.value})} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Harga Jual / Pack</label>
            <input type="number" value={form.targetHargaJual} onChange={e => setForm({...form, targetHargaJual: e.target.value})} className="input-field text-blue-400 font-bold" />
          </div>

          {/* Ringkasan Hasil Kalkulasi Ulang */}
          <div className="p-4 rounded-xl bg-dark-800 border border-slate-700 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Faktur Baru:</span>
              <span className="text-white font-bold">{formatRupiah(totalFaktur)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">HPP Baru / Pack:</span>
              <span className="text-emerald-400 font-bold">{formatRupiah(newHpp)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Sisa Hutang Baru:</span>
              <span className="text-rose-400 font-bold">{formatRupiah(newSisaHutang)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="btn-ghost flex-1">Batal</button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700"
            >
              <HiOutlineSave size={18} />
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
