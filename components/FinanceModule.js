"use client";

import { useState, useEffect, useMemo } from "react";
import {
  HiOutlineCash,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilAlt,
  HiOutlineUserGroup,
  HiOutlineDocumentText,
} from "react-icons/hi";
import {
  subscribeInvestors, addInvestor, updateInvestor, deleteInvestor,
  subscribeFinanceLedger, addFinanceEntry, deleteFinanceEntry,
  calcFinanceSummary, subscribeAllDistributions, subscribeSummary,
  syncFinancialBaseline
} from "@/lib/firestore";
import { formatRupiah } from "@/lib/utils";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

const ALL_TYPES = [
  { value: "modal_masuk", label: "Modal Masuk (Investment)", color: "text-emerald-400", sign: "+" },
  { value: "bagi_hasil", label: "Bagi Hasil (Dividend)", color: "text-purple-400", sign: "-" },
  { value: "biaya_operasional", label: "Biaya Operasional (Ops)", color: "text-rose-500", sign: "-" },
  { value: "pemasukan_lain", label: "Pemasukan Lain-lain", color: "text-green-400", sign: "+" },
  { value: "pengeluaran_lain", label: "Pengeluaran Lain-lain", color: "text-red-400", sign: "-" },
  // Auto-journal types (tampil di ledger, tidak bisa dipilih manual)
  { value: "auto_bayar_po", label: "[Auto] Bayar Hutang PO", color: "text-cyan-400", sign: "-" },
  { value: "auto_setoran_sales", label: "[Auto] Setoran Sales", color: "text-emerald-400", sign: "+" },
  { value: "sync_baseline", label: "[Sync] Saldo Awal", color: "text-amber-400", sign: "" },
  // Legacy types (tetap tampil di ledger lama)
  { value: "hutang_masuk", label: "Terima Pinjaman (Hutang)", color: "text-blue-400", sign: "+" },
  { value: "bayar_hutang", label: "Bayar Pinjaman (Lunas Hutang)", color: "text-cyan-400", sign: "-" },
  { value: "piutang_keluar", label: "Beri Pinjaman (Piutang)", color: "text-amber-400", sign: "-" },
  { value: "terima_piutang", label: "Terima Bayaran (Lunas Piutang)", color: "text-yellow-400", sign: "+" },
];

// Hanya 4 opsi manual yang tersedia untuk admin
const TIPE_BUKU_OPTIONS = ALL_TYPES.filter(t => 
  t.value === "modal_masuk" || t.value === "biaya_operasional" || t.value === "pemasukan_lain" || t.value === "pengeluaran_lain"
);

const TIPE_MAP = {};
ALL_TYPES.forEach(t => { TIPE_MAP[t.value] = t; });

export default function FinanceModule({ products = [], purchases = [] }) {
  const { checkWritePermission } = usePermissions();
  const [investors, setInvestors] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null);

  // Modals
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(null);
  const [invForm, setInvForm] = useState({ nama: "", persentaseBagiHasil: "", totalModal: "", kontak: "" });

  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({ tipeBuku: "", nominal: "", keterangan: "", relasiId: "" });

  // Bagi Hasil Modal
  const [showBagiHasilModal, setShowBagiHasilModal] = useState(false);
  const [profitInput, setProfitInput] = useState("");

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const unsubInv = subscribeInvestors(setInvestors);
    const unsubLedger = subscribeFinanceLedger(setLedger);
    const unsubDist = subscribeAllDistributions(setDistributions);
    const unsubSummary = subscribeSummary(setGlobalSummary);
    return () => { unsubInv(); unsubLedger(); unsubDist(); unsubSummary(); };
  }, []);

  // Hitung Laba Kotor (sinkron dengan modul Laba Rugi) - Sekarang menggunakan globalSummary
  const grossProfit = globalSummary?.totalLabaKotor || 0;
  
  // Filter out legacy mirrored "Hutang PO" creation entries to keep general finance clean, 
  // but allow "auto_bayar_po" (PO payments) to show up.
  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => 
      !(entry.tipeBuku === "hutang_masuk" && entry.keterangan?.toLowerCase().includes("hutang po"))
    );
  }, [ledger]);

  const summary = useMemo(() => calcFinanceSummary(filteredLedger), [filteredLedger]);

  // ── Investor Handlers ──
  const openAddInvestor = () => {
    setEditingInvestor(null);
    setInvForm({ nama: "", persentaseBagiHasil: "", totalModal: "", kontak: "" });
    setShowInvestorModal(true);
  };

  const openEditInvestor = (inv) => {
    setEditingInvestor(inv);
    setInvForm({
      nama: inv.nama,
      persentaseBagiHasil: inv.persentaseBagiHasil?.toString() || "",
      totalModal: inv.totalModal?.toLocaleString("id-ID") || "",
      kontak: inv.kontak || ""
    });
    setShowInvestorModal(true);
  };

  const handleSaveInvestor = async () => {
    if (!checkWritePermission(editingInvestor ? "mengedit investor" : "menambah investor")) return;
    if (!invForm.nama.trim()) return toast.error("Nama investor wajib diisi");
    setProcessing(true);
    try {
      const data = {
        nama: invForm.nama.trim(),
        persentaseBagiHasil: parseFloat(invForm.persentaseBagiHasil) || 0,
        totalModal: parseInt(invForm.totalModal.replace(/\D/g, "")) || 0,
        kontak: invForm.kontak.trim()
      };
      if (editingInvestor) {
        await updateInvestor(editingInvestor.id, data);
        toast.success("Investor diperbarui");
      } else {
        await addInvestor(data);
        toast.success("Investor ditambahkan");
      }
      setShowInvestorModal(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteInvestor = async (inv) => {
    if (!checkWritePermission("menghapus investor")) return;
    if (!confirm(`Hapus investor ${inv.nama}?`)) return;
    try {
      await deleteInvestor(inv.id);
      toast.success("Investor dihapus");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  };

  // ── Bagi Hasil (Unified) ──
  const [bagiMode, setBagiMode] = useState("auto"); // "auto" | "manual"
  const [customPayouts, setCustomPayouts] = useState({});

  // Laba tersedia = Laba Kotor dikurangi Bagi Hasil yang sudah dibayarkan
  const availableProfit = globalSummary?.sisaLabaBelumDibagikan || 0;

  const openBagiHasil = () => {
    setProfitInput(availableProfit > 0 ? Math.round(availableProfit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");
    setBagiMode("auto");
    setCustomPayouts({});
    setShowBagiHasilModal(true);
  };

  const syncedProfit = parseInt((profitInput || "0").replace(/\D/g, "")) || 0;

  const bagiHasilPreview = investors.map(inv => {
    const autoPayout = Math.round(syncedProfit * ((inv.persentaseBagiHasil || 0) / 100));
    const payout = bagiMode === "manual" && customPayouts[inv.id] !== undefined
      ? (parseInt((customPayouts[inv.id] || "0").toString().replace(/\D/g, "")) || 0)
      : autoPayout;
    return { ...inv, payout, autoPayout };
  });
  const totalPayout = bagiHasilPreview.reduce((s, i) => s + i.payout, 0);
  const sisaLaba = syncedProfit - totalPayout;
  const isOverBudget = totalPayout > syncedProfit;

  const handleCustomPayoutChange = (invId, val) => {
    const clean = val.replace(/\D/g, "");
    const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setCustomPayouts(prev => ({ ...prev, [invId]: formatted }));
  };

  const handleModeSwitch = (mode) => {
    setBagiMode(mode);
    if (mode === "manual") {
      // Pre-fill custom payouts with auto values
      const map = {};
      investors.forEach(inv => {
        map[inv.id] = Math.round(syncedProfit * ((inv.persentaseBagiHasil || 0) / 100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      });
      setCustomPayouts(map);
    }
  };

  const handleSubmitBagiHasil = async () => {
    if (!checkWritePermission("melakukan bagi hasil")) return;
    if (syncedProfit <= 0) return toast.error("Masukkan nominal keuntungan!");
    if (investors.length === 0) return toast.error("Belum ada investor!");
    if (isOverBudget) return toast.error("Total melebihi keuntungan!");
    const activePayouts = bagiHasilPreview.filter(i => i.payout > 0);
    if (activePayouts.length === 0) return toast.error("Tidak ada nominal untuk dibagikan!");
    if (!confirm(`Distribusikan total ${fmtRp(totalPayout)} ke ${activePayouts.length} investor?\nSisa laba yang tidak dibagi: ${fmtRp(sisaLaba)}`)) return;

    setProcessing(true);
    try {
      for (const inv of activePayouts) {
        await addFinanceEntry({
          tipeBuku: "bagi_hasil",
          nominal: inv.payout,
          keterangan: `Bagi hasil ${bagiMode === 'auto' ? inv.persentaseBagiHasil + '%' : 'manual'} ke ${inv.nama} (Laba: ${fmtRp(syncedProfit)})`,
          relasiId: inv.id
        });
      }
      toast.success(`Bagi hasil ke ${activePayouts.length} investor berhasil dicatat!`);
      setShowBagiHasilModal(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ── Transaction Handlers ──
  const openTxModal = () => {
    setTxForm({ tipeBuku: "", nominal: "", keterangan: "", relasiId: "" });
    setShowTxModal(true);
  };

  const handleSaveTx = async () => {
    if (!checkWritePermission("mencatat transaksi keuangan")) return;
    if (!txForm.tipeBuku) return toast.error("Pilih jenis transaksi");
    const nominal = parseInt(txForm.nominal.replace(/\D/g, ""));
    if (!nominal || nominal <= 0) return toast.error("Nominal tidak valid");

    setProcessing(true);
    try {
      await addFinanceEntry({
        tipeBuku: txForm.tipeBuku,
        nominal,
        keterangan: txForm.keterangan.trim() || TIPE_MAP[txForm.tipeBuku]?.label || "",
        relasiId: txForm.relasiId || null
      });
      toast.success("Transaksi tercatat!");
      setShowTxModal(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  };



  const handleDeleteEntry = async (entry) => {
    if (!checkWritePermission("menghapus entri keuangan")) return;
    if (!confirm(`Hapus entri "${entry.keterangan || entry.tipeBuku}"?`)) return;
    try {
      await deleteFinanceEntry(entry.id);
      toast.success("Entri dihapus");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  };

  const fmtRp = (n) => `Rp ${(n || 0).toLocaleString("id-ID")}`;
  const fmtInput = (val) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // ── Investor dividend history ──
  const investorDividends = useMemo(() => {
    const map = {};
    ledger.forEach(e => {
      if (e.tipeBuku === "bagi_hasil" && e.relasiId) {
        map[e.relasiId] = (map[e.relasiId] || 0) + (e.nominal || 0);
      }
    });
    return map;
  }, [ledger]);

  return (
    <div className="space-y-6">
      {/* ── Header Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Modal Aktif (Kas)</p>
          <p className="text-2xl font-black text-emerald-400">{fmtRp(globalSummary?.modalAktif || 0)}</p>
          {!globalSummary?.financeSyncedAt && (
            <p className="text-[9px] text-amber-400 mt-1 animate-pulse">⚠ Belum disinkronkan</p>
          )}
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Total Hutang Pabrik</p>
          <p className={`text-2xl font-black ${(globalSummary?.factoryDebt || 0) > 0 ? 'text-blue-400' : 'text-slate-500'}`}>{fmtRp(globalSummary?.factoryDebt || 0)}</p>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Total Biaya Operasional</p>
          <p className={`text-2xl font-black ${summary.totalBiayaOperasional > 0 ? 'text-rose-500' : 'text-slate-500'}`}>{fmtRp(summary.totalBiayaOperasional)}</p>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Sisa Laba Belum Dibagikan</p>
          <p className={`text-2xl font-black ${(globalSummary?.sisaLabaBelumDibagikan || 0) > 0 ? 'text-purple-400' : 'text-slate-500'}`}>
            {fmtRp(globalSummary?.sisaLabaBelumDibagikan || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Laba: {fmtRp(globalSummary?.totalLabaKotor || 0)} - Ops: {fmtRp(globalSummary?.totalBiayaOperasional || 0)}</p>
        </div>
      </div>

      {/* ── Section A: Investor & Bagi Hasil ── */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <HiOutlineUserGroup className="text-purple-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Investor & Bagi Hasil</h2>
              <p className="text-xs text-slate-400">Kelola pemilik modal dan distribusi keuntungan</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {investors.length > 0 && (
              <button onClick={openBagiHasil} className="text-[11px] sm:text-sm flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors shadow-lg shadow-purple-500/20">
                💰 Bagikan Keuntungan
              </button>
            )}
            <button onClick={openAddInvestor} className="btn-primary text-[11px] sm:text-sm flex-1 sm:flex-none py-2.5 px-3">
              <HiOutlinePlus size={16} /> Investor
            </button>
          </div>
        </div>

        {investors.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                  <th className="py-3 px-4 font-semibold">Nama</th>
                  <th className="py-3 px-4 font-semibold text-right">Modal</th>
                  <th className="py-3 px-4 font-semibold text-center">% Bagi Hasil</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Dividen Dibayar</th>
                  <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {investors.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-400/5 hover:bg-dark-700/30 transition-colors group">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white text-sm">{inv.nama}</p>
                      {inv.kontak && <p className="text-[10px] text-slate-500">{inv.kontak}</p>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400 text-sm">{fmtRp(inv.totalModal)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-purple-500/10 text-purple-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-purple-500/20">
                        {inv.persentaseBagiHasil}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-300 text-sm">{fmtRp(investorDividends[inv.id] || 0)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEditInvestor(inv)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-blue-400 transition-all">
                          <HiOutlinePencilAlt size={14} />
                        </button>
                        <button onClick={() => handleDeleteInvestor(inv)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 transition-all">
                          <HiOutlineTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500 italic text-sm">
            Belum ada investor terdaftar. Klik "+ Investor" untuk menambahkan.
          </div>
        )}
      </div>

      {/* ── Section B: Transaksi Keuangan ── */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <HiOutlineDocumentText className="text-blue-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Buku Besar Keuangan</h2>
              <p className="text-xs text-slate-400">Seluruh transaksi modal, hutang, piutang, dan bagi hasil</p>
            </div>
          </div>
          <div className="flex items-center gap-2">

            <button onClick={openTxModal} className="btn-primary text-sm flex items-center gap-1.5 px-4 py-2">
              <HiOutlinePlus size={16} /> Catat Transaksi
            </button>
          </div>
        </div>

        {ledger.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10 bg-dark-800/30">
                  <th className="py-3 px-4 font-semibold">Tanggal</th>
                  <th className="py-3 px-4 font-semibold">Jenis</th>
                  <th className="py-3 px-4 font-semibold">Keterangan</th>
                  <th className="py-3 px-4 font-semibold text-right">Nominal</th>
                  <th className="py-3 px-4 font-semibold text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map(entry => {
                  const meta = TIPE_MAP[entry.tipeBuku] || { label: entry.tipeBuku, color: "text-slate-400", sign: "" };
                  return (
                    <tr key={entry.id} className={`border-b border-slate-400/5 hover:bg-dark-700/30 transition-colors group ${entry.isAutoJournal ? 'bg-dark-800/20' : ''}`}>
                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {entry.createdAt ? new Date(entry.createdAt.toDate()).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                          {entry.isAutoJournal && (
                            <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-bold">🤖</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-300 max-w-[250px] truncate">{entry.keterangan || "-"}</td>
                      <td className={`py-3 px-4 text-right font-bold text-sm ${meta.sign === "+" ? "text-emerald-400" : meta.sign === "-" ? "text-rose-400" : "text-amber-400"}`}>
                        {meta.sign}{entry.nominal > 0 ? fmtRp(entry.nominal) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!entry.isAutoJournal ? (
                          <button onClick={() => handleDeleteEntry(entry)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 transition-all">
                            <HiOutlineTrash size={14} />
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-600">🔒</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500 italic text-sm">
            Belum ada transaksi keuangan. Klik "+ Catat Transaksi" untuk memulai.
          </div>
        )}

        {summary.totalBagiHasil > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-400/10 flex justify-between items-center">
            <span className="text-xs text-slate-500">Total Bagi Hasil Dibayarkan</span>
            <span className="font-bold text-purple-400">{fmtRp(summary.totalBagiHasil)}</span>
          </div>
        )}
      </div>

      {/* ── Modal: Add/Edit Investor ── */}
      {showInvestorModal && (
        <div className="modal-overlay" onClick={() => setShowInvestorModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-5">{editingInvestor ? "Edit Investor" : "Tambah Investor"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Investor</label>
                <input type="text" value={invForm.nama} onChange={e => setInvForm({ ...invForm, nama: e.target.value })} className="input-field w-full" placeholder="Contoh: Budi Santoso" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Modal (Rp)</label>
                  <input type="text" inputMode="numeric" value={invForm.totalModal} onChange={e => setInvForm({ ...invForm, totalModal: fmtInput(e.target.value) })} className="input-field w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">% Bagi Hasil</label>
                  <input type="number" step="0.1" value={invForm.persentaseBagiHasil} onChange={e => setInvForm({ ...invForm, persentaseBagiHasil: e.target.value })} className="input-field w-full" placeholder="10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Kontak (Opsional)</label>
                <input type="text" value={invForm.kontak} onChange={e => setInvForm({ ...invForm, kontak: e.target.value })} className="input-field w-full" placeholder="No HP / Email" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setShowInvestorModal(false)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleSaveInvestor} disabled={processing} className="btn-primary flex-1">{processing ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Catat Transaksi Keuangan ── */}
      {showTxModal && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-5">Catat Transaksi Keuangan</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Jenis Transaksi</label>
                <select value={txForm.tipeBuku} onChange={e => setTxForm({ ...txForm, tipeBuku: e.target.value })} className="input-field w-full">
                  <option value="">-- Pilih Jenis --</option>
                  {TIPE_BUKU_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nominal (Rp)</label>
                <input type="text" inputMode="numeric" value={txForm.nominal} onChange={e => setTxForm({ ...txForm, nominal: fmtInput(e.target.value) })} className="input-field w-full text-lg font-bold" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Keterangan</label>
                <textarea value={txForm.keterangan} onChange={e => setTxForm({ ...txForm, keterangan: e.target.value })} className="input-field w-full h-20 resize-none" placeholder="Catatan transaksi..." />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setShowTxModal(false)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleSaveTx} disabled={processing} className="btn-primary flex-1">{processing ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Bagikan Keuntungan (Bagi Hasil Sekaligus) ── */}
      {showBagiHasilModal && (
        <div className="modal-overlay" onClick={() => setShowBagiHasilModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-1">💰 Bagikan Keuntungan</h3>
            <p className="text-[10px] text-slate-400 mb-5">Distribusikan laba ke investor — otomatis atau atur manual</p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Laba yang Akan Dibagikan (Rp)</label>
              <input type="text" inputMode="numeric" value={profitInput} onChange={e => { setProfitInput(fmtInput(e.target.value)); if (bagiMode === 'manual') setCustomPayouts({}); setBagiMode('auto'); }} className="input-field w-full text-xl font-black text-center" placeholder="0" />
              {grossProfit > 0 && (
                <div className="mt-2 space-y-1.5">
                  <button onClick={() => { setProfitInput(availableProfit > 0 ? Math.round(availableProfit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0"); setBagiMode('auto'); setCustomPayouts({}); }} className="w-full text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2 font-bold hover:bg-emerald-500/20 transition-colors">
                    📊 Sinkron Sisa Laba: {fmtRp(availableProfit)}
                  </button>
                  <div className="flex justify-between text-[9px] text-slate-500 px-1">
                    <span>Laba Kotor: {fmtRp(grossProfit)}</span>
                    <span>Sudah Dibagi: {fmtRp(summary.totalBagiHasil)}</span>
                  </div>
                </div>
              )}
            </div>

            {syncedProfit > 0 && investors.length > 0 && (
              <>
                {/* Mode Toggle */}
                <div className="flex bg-dark-800 p-1 rounded-xl mb-4 border border-slate-700">
                  <button onClick={() => handleModeSwitch('auto')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${bagiMode === 'auto' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                    ✨ Otomatis (Sesuai %)
                  </button>
                  <button onClick={() => handleModeSwitch('manual')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${bagiMode === 'manual' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                    ✏️ Manual (Edit Bebas)
                  </button>
                </div>

                {/* Preview Table */}
                <div className={`bg-dark-800 rounded-xl border overflow-hidden mb-4 ${isOverBudget ? 'border-rose-500' : 'border-slate-700'}`}>
                  <div className="px-4 py-2.5 bg-dark-700/50 border-b border-slate-700">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rincian Pembagian</p>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {bagiHasilPreview.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{inv.nama}</p>
                          <p className="text-[10px] text-slate-500">{inv.persentaseBagiHasil}%{bagiMode === 'auto' ? ` = ${fmtRp(inv.autoPayout)}` : ''}</p>
                        </div>
                        {bagiMode === 'manual' ? (
                          <div className="w-36">
                            <input
                              type="text" inputMode="numeric"
                              value={customPayouts[inv.id] || ''}
                              onChange={e => handleCustomPayoutChange(inv.id, e.target.value)}
                              className="input-field w-full text-right text-sm font-black text-purple-400 py-2 px-3"
                              placeholder="0"
                            />
                          </div>
                        ) : (
                          <p className="text-sm font-black text-purple-400">{fmtRp(inv.payout)}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer: Total + Sisa */}
                  <div className="border-t border-slate-700">
                    <div className="flex justify-between items-center px-4 py-2.5 bg-purple-500/5">
                      <span className="text-xs font-bold text-slate-300">Total Dibagikan</span>
                      <span className={`text-base font-black ${isOverBudget ? 'text-rose-400' : 'text-purple-400'}`}>{fmtRp(totalPayout)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 bg-emerald-500/5 border-t border-slate-700/50">
                      <span className="text-xs font-bold text-slate-400">Sisa Laba (Tidak Dibagi)</span>
                      <span className={`text-base font-black ${sisaLaba < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmtRp(sisaLaba)}</span>
                    </div>
                  </div>
                </div>

                {isOverBudget && (
                  <p className="text-[10px] text-rose-400 font-bold mb-3 text-center">⚠️ Total melebihi keuntungan! Kurangi nominal agar tidak melebihi {fmtRp(syncedProfit)}</p>
                )}
              </>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setShowBagiHasilModal(false)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleSubmitBagiHasil} disabled={processing || syncedProfit <= 0 || isOverBudget} className="btn-primary flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50">{processing ? "Memproses..." : "Konfirmasi & Catat Semua"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
