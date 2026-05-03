"use client";
import { useState } from "react";
import { HiOutlineLocationMarker, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi";
import { addRetailStore, deleteRetailStore } from "@/lib/firestore";
import { formatRupiah } from "@/lib/utils";
import toast from "react-hot-toast";

export default function RetailMarketing({ stores }) {
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [processing, setProcessing] = useState(false);

  async function handleAddStore(e) {
    e.preventDefault();
    if (!storeName || !address) return toast.error("Nama Toko dan Alamat wajib diisi!");
    setProcessing(true);
    try {
      await addRetailStore({ name: storeName, owner: ownerName, address });
      toast.success("Toko berhasil ditambahkan!");
      setStoreName(""); setOwnerName(""); setAddress("");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Form Tambah Toko */}
      <div className="glass-card p-6 border-t-4 border-pink-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <HiOutlineLocationMarker className="text-pink-400" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Database Toko Retail</h2>
            <p className="text-xs text-slate-400">Kelola daftar warung dan titik wilayah pemasaran sales</p>
          </div>
        </div>

        <form onSubmit={handleAddStore} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input type="text" placeholder="Nama Toko/Warung" value={storeName} onChange={e => setStoreName(e.target.value)} className="input-field" />
          <input type="text" placeholder="Nama Pemilik" value={ownerName} onChange={e => setOwnerName(e.target.value)} className="input-field" />
          <input type="text" placeholder="Alamat / Wilayah" value={address} onChange={e => setAddress(e.target.value)} className="input-field" />
          <button type="submit" disabled={processing} className="btn-primary w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 shadow-pink-500/20">
            <HiOutlinePlus /> Tambah Toko
          </button>
        </form>
      </div>

      {/* Tabel Toko */}
      <div className="glass-card p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                <th className="py-3 px-4 font-semibold rounded-tl-lg">Nama Toko</th>
                <th className="py-3 px-4 font-semibold">Pemilik</th>
                <th className="py-3 px-4 font-semibold">Wilayah</th>
                <th className="py-3 px-4 font-semibold text-right">Total Piutang</th>
                <th className="py-3 px-4 font-semibold text-center rounded-tr-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400/5">
              {stores?.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-slate-500 italic text-sm">Belum ada data toko retail terdaftar.</td></tr>
              ) : (
                stores?.map(s => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-white text-sm">{s.name}</td>
                    <td className="py-3 px-4 text-slate-400">{s.owner || "-"}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{s.address}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">{formatRupiah(s.totalPiutang || 0)}</td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => {if(confirm(`Hapus toko ${s.name}?`)) deleteRetailStore(s.id)}} className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors">
                        <HiOutlineTrash size={16} />
                      </button>
                    </td>
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
