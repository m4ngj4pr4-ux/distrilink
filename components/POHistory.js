"use client";

import { useState, useEffect } from "react";
import { HiOutlineSearch, HiOutlineTrash, HiOutlineDocumentText, HiTrendingUp, HiOutlineEye, HiOutlineX, HiOutlinePencil, HiOutlineDownload, HiOutlineCalendar } from "react-icons/hi";
import { formatRupiah, parseInputNumber, formatInputNumber } from "@/lib/utils";
import { deletePurchase, payFactoryDebt, subscribeFactoryPayments } from "@/lib/firestore";
import EditPOModal from "./EditPOModal";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function POHistory({ purchases, distributions }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payModal, setPayModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [editingPO, setEditingPO] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!detailModal) {
      setPaymentHistory([]);
      return;
    }
    const unsub = subscribeFactoryPayments(detailModal.id, setPaymentHistory);
    return () => unsub();
  }, [detailModal]);

  async function handleDelete(purchase) {
    if (confirm(`Hapus PO ${purchase.productName}? Stok dan Hutang akan disesuaikan.`)) {
      try {
        await deletePurchase(purchase.id, purchase);
        toast.success("PO berhasil dihapus");
      } catch (err) {
        toast.error("Gagal: " + err.message);
      }
    }
  }

  async function handlePayment() {
    if (!payModal) return;
    const amount = parseFloat(parseInputNumber(payAmount));
    if (!amount || amount <= 0) return toast.error("Masukkan nominal pembayaran");

    // VALIDASI: Cek sisa hutang
    if (amount > payModal.sisaHutang) {
      return toast.error(`Gagal: Pembayaran melebihi sisa hutang (Maks: ${formatRupiah(payModal.sisaHutang)})`);
    }
    setProcessing(true);
    try {
      await payFactoryDebt(payModal.id, amount);
      toast.success(`Pembayaran ${formatRupiah(amount)} berhasil!`);
      setPayModal(null);
      setPayAmount("");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  const exportToPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString("id-ID", { day: '2-digit', month: 'long', year: 'numeric' });
    
    // Header
    doc.setFontSize(18);
    doc.text("Laporan Riwayat PO Pabrik", 14, 20);
    doc.setFontSize(10);
    doc.text(`DistriLink - Laporan per tanggal: ${dateStr}`, 14, 28);
    if (startDate || endDate) {
      doc.text(`Filter Periode: ${startDate || "Awal"} s/d ${endDate || "Sekarang"}`, 14, 34);
    }

    const tableData = filteredPurchases.map((p) => [
      p.createdAt?.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" }),
      p.productName,
      `${(p.totalPack || 0).toLocaleString("id-ID")} Pk`,
      formatRupiah(p.hargaBeliPerPack),
      formatRupiah(p.biayaPengiriman),
      formatRupiah(p.hpp),
      formatRupiah(p.uangMuka), // Tambah DP
      formatRupiah(p.sisaHutang)
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Tanggal", "Produk", "Qty", "Harga Beli", "Ongkir", "HPP/Pk", "DP", "Sisa Hutang"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 8 },
    });

    doc.save(`Riwayat_PO_${new Date().getTime()}.pdf`);
    toast.success("Laporan PDF berhasil diunduh!");
  };

  const filteredPurchases = (purchases || []).filter(p => {
    const matchesSearch = p.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter Tanggal
    if (!p.createdAt) return matchesSearch;
    const poDate = p.createdAt.toDate();
    poDate.setHours(0, 0, 0, 0);

    let matchesDate = true;
    if (startDate) {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      if (poDate < sDate) matchesDate = false;
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      if (poDate > eDate) matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="glass-card p-6">
      {/* Header & Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <HiOutlineDocumentText className="text-amber-400" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Riwayat PO Pabrik</h2>
            <p className="text-xs text-slate-400">Daftar masuk barang dan rincian HPP per transaksi</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Tanggal */}
          <div className="flex items-center gap-2 bg-dark-800/50 border border-slate-700/50 rounded-xl px-3 py-1.5">
            <HiOutlineCalendar className="text-slate-500" size={16} />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-white outline-none focus:text-blue-400"
              title="Mulai Tanggal"
            />
            <span className="text-slate-600 text-xs">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-white outline-none focus:text-blue-400"
              title="Sampai Tanggal"
            />
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Cari produk..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 py-2 text-sm w-full"
            />
          </div>

          {/* PDF Button */}
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-700 hover:bg-dark-600 border border-slate-600/50 text-white text-xs font-bold transition-all shadow-lg active:scale-95"
          >
            <HiOutlineDownload size={16} className="text-blue-400" />
            Cetak PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="data-table whitespace-nowrap">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th>Tanggal</th>
              <th>Produk</th>
              <th>Qty</th>
              <th>Harga Beli / PK</th>
              <th>Ongkir</th>
              <th className="text-emerald-400">HPP / Pack</th>
              <th className="text-blue-400">Target Jual / PK</th>
              <th className="text-amber-400">DP (Uang Muka)</th>
              <th className="text-slate-400">Sisa Hutang</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400/5">
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center py-8 text-slate-500 text-sm italic">
                  Belum ada riwayat PO yang ditemukan.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((p) => {
                const totalPacks = p.totalPack || 0;
                const totalSlops = p.totalSlop || 0;
                const ongkirPerCt = p.jumlahKarton > 0 ? (p.biayaPengiriman || 0) / p.jumlahKarton : 0;

                return (
                  <tr key={p.id}>
                    <td className="text-xs text-white font-medium">
                      {p.createdAt?.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="font-bold text-white text-sm">{p.productName}</td>
                    <td>
                      <div className="text-sm font-bold text-emerald-400">{totalPacks.toLocaleString("id-ID")} Pack</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{p.jumlahKarton} Ct / {totalSlops.toLocaleString("id-ID")} Slop</div>
                    </td>
                    <td className="text-sm text-slate-300 font-mono">{formatRupiah(p.hargaBeliPerPack)}</td>
                    <td>
                      <div className="text-sm text-slate-300 font-mono">{formatRupiah(p.biayaPengiriman)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{formatRupiah(ongkirPerCt)} /Ct</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400 font-mono">
                        <HiTrendingUp size={14} />
                        <span>{formatRupiah(p.hpp)}</span>
                      </div>
                    </td>
                    <td className="text-sm text-blue-400 font-bold font-mono">{formatRupiah(p.targetHargaJual)}</td>
                    <td className="text-sm text-amber-400 font-bold font-mono">{formatRupiah(p.uangMuka)}</td>
                    <td className="text-sm text-rose-400 border border-rose-500/20 bg-rose-500/5 px-2 py-1 rounded font-mono inline-block">
                      {formatRupiah(p.sisaHutang)}
                    </td>
                    <td>
                      <div className="flex justify-center gap-2">
                        {/* Selalu Bisa Lihat Detail */}
                        <button onClick={() => setDetailModal(p)} className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-slate-400" title="Detail Cicilan">
                          <HiOutlineEye size={16} />
                        </button>

                        {/* Aksi Edit, Bayar, & Hapus Hanya Jika Belum Lunas */}
                        {p.sisaHutang > 0 && (
                          <>
                            <button onClick={() => setEditingPO(p)} className="p-2 rounded-lg hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-colors" title="Edit PO">
                              <HiOutlinePencil size={16} />
                            </button>
                            <button onClick={() => setPayModal(p)} className="btn-emerald text-[10px] py-1 px-2">
                              Bayar
                            </button>
                            <button onClick={() => handleDelete(p)} className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors" title="Hapus PO">
                              <HiOutlineTrash size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-2">Bayar Hutang Pabrik</h3>
            <p className="text-xs text-amber-400 font-mono mb-5">
              Sisa Hutang: {formatRupiah(payModal.sisaHutang)}
            </p>
            <input 
              type="text" 
              value={formatInputNumber(payAmount)} 
              onChange={(e) => setPayAmount(parseInputNumber(e.target.value))} 
              placeholder="Nominal Cicilan (Rp)" 
              className="input-field mb-5" 
            />
            <div className="flex items-center gap-3">
              <button onClick={() => setPayModal(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handlePayment} disabled={processing} className="btn-primary flex-1">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <HiOutlineEye className="text-blue-400" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Riwayat Bayar ke Pabrik</h3>
                  <p className="text-xs text-slate-400">{detailModal.productName}</p>
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400">
                <HiOutlineX size={18} />
              </button>
            </div>

            <div className="overflow-x-auto">
              {paymentHistory.length === 0 ? (
                <p className="text-center py-10 text-slate-500 text-sm italic">Belum ada catatan pembayaran.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10">
                      <th className="py-3 font-semibold">Tanggal Bayar</th>
                      <th className="py-3 font-semibold text-right text-emerald-400">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                    {paymentHistory.map((pay) => (
                      <tr key={pay.id} className="text-xs hover:bg-white/5 transition-colors">
                        <td className="py-3 text-slate-400">
                          {pay.createdAt?.toDate().toLocaleDateString("id-ID", { 
                            day: "2-digit", 
                            month: "short", 
                            year: "numeric", 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-400">{formatRupiah(pay.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {editingPO && (
        <EditPOModal 
          po={editingPO} 
          onClose={() => setEditingPO(null)} 
          distributions={distributions}
        />
      )}
    </div>
  );
}
