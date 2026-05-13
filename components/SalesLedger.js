"use client";

import { useState, useEffect, useMemo } from "react";
import {
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlineCash,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlinePencilAlt,
  HiOutlineEye,
} from "react-icons/hi";
import { formatRupiah, formatNumber, formatInputNumber, parseInputNumber } from "@/lib/utils";
import {
  addDepositTransaction,
  subscribeDeposits,
  addGoodsDropTransaction,
  addSalesTeam,
  updateSalesTeam,
  deleteSalesTeam,
  incrementSummaryField,
  subscribeDistributions,
  deleteDistribution,
  verifikasiSetoranAdmin,
} from "@/lib/firestore";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

export default function SalesLedger({ teams, products, purchases, allDistributions }) {
  const { checkWritePermission } = usePermissions();
  const [depositModal, setDepositModal] = useState(null);
  const [dropModal, setDropModal] = useState(null);
  const [addTeamModal, setAddTeamModal] = useState(false);
  const [editTeamModal, setEditTeamModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  
  const [depositAmount, setDepositAmount] = useState("");
  const [dropAmount, setDropAmount] = useState("");
  const [dropQty, setDropQty] = useState("");
  const [dropPricePerPack, setDropPricePerPack] = useState("");
  const [dropUnit, setDropUnit] = useState("Ct"); // Ct, Bal, atau Slop
  const [selectedPoId, setSelectedPoId] = useState("");
  
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPin, setNewTeamPin] = useState("");
  const [newTeamRole, setNewTeamRole] = useState("sales");
  const [processing, setProcessing] = useState(false);
  const [distributions, setDistributions] = useState([]);
  const [depositHistory, setDepositHistory] = useState([]);

  useEffect(() => {
    if (!detailModal) {
      setDistributions([]);
      setDepositHistory([]);
      return;
    }
    const unsubDist = subscribeDistributions(detailModal.id, (data) => {
      setDistributions(data);
    });
    const unsubDep = subscribeDeposits(detailModal.id, (data) => {
      setDepositHistory(data);
    });
    return () => {
      unsubDist();
      unsubDep();
    };
  }, [detailModal]);

  // HITUNG SISA STOK PO REAL-TIME (METODE FIFO)
  // Menjamin sinkronisasi absolut dengan Stok Gudang (product.totalPacks)
  const availableBatches = useMemo(() => {
    if (!purchases || !products) return [];
    
    let resultBatches = [];
    
    // Kelompokkan PO berdasarkan produk
    products.forEach(product => {
      let remainingGlobalStock = product.totalPacks || 0;
      if (remainingGlobalStock <= 0) return; // Lewati jika stok gudang habis
      
      // Ambil semua PO untuk produk ini, urutkan dari yang TERBARU (Descending)
      const productPOs = purchases
        .filter(po => po.productId === product.id)
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        
      // Alokasikan stok global ke batch PO (mengisi PO terbaru lebih dulu)
      productPOs.forEach(po => {
        if (remainingGlobalStock <= 0) return;
        
        const poOriginalCapacity = po.totalPack || 0;
        const allocated = Math.min(remainingGlobalStock, poOriginalCapacity);
        
        if (allocated > 0) {
          resultBatches.push({
            ...po,
            realSisa: allocated
          });
          remainingGlobalStock -= allocated;
        }
      });
    });
    
    return resultBatches;
  }, [purchases, products]);

  // AUTO-RECALCULATE TOTAL NILAI DISTRIBUSI
  useEffect(() => {
    if (!selectedPoId || !dropQty || !dropUnit || !dropPricePerPack) {
      setDropAmount("0");
      return;
    }

    const po = purchases.find(p => p.id === selectedPoId);
    if (!po) return;
    
    const product = products.find(p => p.id === po.productId);
    if (!product) return;

    const qtyNum = parseFloat(dropQty) || 0;
    const priceNum = parseFloat(dropPricePerPack) || 0;
    
    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerBall = product.slopsPerBall || 20;
    const ballsPerKarton = product.ballsPerKarton || 5;
    
    let totalPacks = 0;
    if (dropUnit === "Ct") {
      totalPacks = qtyNum * (ballsPerKarton * slopsPerBall * packsPerSlop);
    } else if (dropUnit === "Bal") {
      totalPacks = qtyNum * (slopsPerBall * packsPerSlop);
    } else if (dropUnit === "Slop") {
      totalPacks = qtyNum * packsPerSlop;
    } else {
      totalPacks = qtyNum;
    }

    setDropAmount(Math.round(totalPacks * priceNum).toString());
  }, [selectedPoId, dropQty, dropUnit, dropPricePerPack, purchases, products]);

  async function handleDeposit() {
    if (!checkWritePermission("mencatat setoran sales")) return;
    if (!depositModal) return;
    const amount = parseFloat(parseInputNumber(depositAmount));
    if (!amount || amount <= 0) return toast.error("Masukkan jumlah setoran");

    // VALIDASI: Cek sisa piutang
    const currentBalance = (depositModal.goodsDropped || 0) - (depositModal.totalDeposited || 0);
    if (amount > currentBalance) {
      return toast.error(`Gagal: Setoran melebihi sisa piutang (Maks: ${formatRupiah(currentBalance)})`);
    }

    setProcessing(true);
    try {
      await addDepositTransaction(depositModal.id, amount, depositModal.name);
      toast.success(`Setoran ${formatRupiah(amount)} berhasil!`);
      setDepositModal(null);
      setDepositAmount("");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleVerifikasi(dep) {
    if (!checkWritePermission("verifikasi setoran")) return;
    if (!confirm(`Sahkan setoran ${formatRupiah(dep.nominal)} dari ${dep.namaSales || 'Sales'}? Piutang akan dikurangi secara permanen.`)) return;
    
    setProcessing(true);
    try {
      await verifikasiSetoranAdmin(dep.id, dep.teamId, dep.nominal);
      toast.success("Setoran berhasil disahkan!");
    } catch (err) {
      toast.error("Gagal verifikasi: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteDist(dist) {
    if (!checkWritePermission("menghapus riwayat distribusi")) return;
    if (!confirm(`Hapus distribusi ${dist.productName} sejumlah ${dist.qtyOriginal} ${dist.unit}? Stok dan piutang akan dikoreksi otomatis.`)) return;
    try {
      await deleteDistribution(dist.id, dist);
      toast.success("Distribusi dihapus dan direkonsiliasi");
    } catch (err) {
      toast.error("Gagal menghapus: " + err.message);
    }
  }

  async function handleGoodsDrop() {
    if (!checkWritePermission("mencatat dropping barang")) return;
    if (!dropModal) return;
    const amount = parseFloat(dropAmount);
    const qty = parseFloat(dropQty);
    
    if (!selectedPoId) return toast.error("Pilih Batch PO");
    if (!qty || qty <= 0) return toast.error("Masukkan jumlah");
    if (!amount || amount <= 0) return toast.error("Nilai barang tidak valid");

    const po = purchases.find(p => p.id === selectedPoId);
    if (!po) return toast.error("Data PO tidak ditemukan");

    const product = products.find(p => p.id === po.productId);
    if (!product) return toast.error("Data produk tidak ditemukan");

    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);

    let totalPacksDistributed = 0;
    if (dropUnit === "Ct") {
      totalPacksDistributed = qty * slopsPerKarton * packsPerSlop;
    } else if (dropUnit === "Bal") {
      totalPacksDistributed = qty * 10 * packsPerSlop; // 1 Bal = 10 Slop
    } else {
      totalPacksDistributed = qty * packsPerSlop;
    }

    // VALIDASI STOK: Cegah stok batch minus
    const selectedBatch = availableBatches.find(b => b.id === selectedPoId);
    if (!selectedBatch) return toast.error("Batch PO tidak valid atau stok sudah habis!");

    if (totalPacksDistributed > selectedBatch.realSisa) {
      return toast.error(`Gagal! Sisa stok di batch ini hanya ${selectedBatch.realSisa.toLocaleString("id-ID")} Bungkus. Anda mencoba mendistribusikan ${totalPacksDistributed.toLocaleString("id-ID")} Bungkus.`);
    }

    setProcessing(true);
    try {
      await addGoodsDropTransaction({
        teamId: dropModal.id,
        teamName: dropModal.name,
        poId: selectedPoId,
        productId: po.productId,
        productName: po.productName,
        totalPacksDistributed: totalPacksDistributed,
        jumlahKarton: totalPacksDistributed / (slopsPerKarton * packsPerSlop),
        amount: amount,
        unit: dropUnit,
        qtyOriginal: qty,
        pricePerPack: parseFloat(dropPricePerPack),
        hppSnapshot: po.hpp || 0, // KUNCI HPP DARI BATCH INI
      });

      toast.success(`Distribusi ${po.productName} (${qty} ${dropUnit}) berhasil!`);
      setDropModal(null);
      setDropAmount("");
      setDropQty("");
      setSelectedPoId("");
      setDropPricePerPack("");
      setDropUnit("Ct");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }


  async function handleAddTeam() {
    if (!checkWritePermission("menambah tim sales baru")) return;
    if (!newTeamName.trim()) return toast.error("Masukkan nama tim");
    if (!newTeamPin || newTeamPin.length < 6) return toast.error("PIN harus 6 angka");
    setProcessing(true);
    try {
      await addSalesTeam(newTeamName.trim(), newTeamPin);
      toast.success(`${newTeamName.trim()} berhasil ditambahkan!`);
      setNewTeamName("");
      setNewTeamPin("");
      setAddTeamModal(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpdateTeam() {
    if (!checkWritePermission("mengedit tim sales")) return;
    if (!editTeamModal || !newTeamName.trim()) return;
    if (!newTeamPin || newTeamPin.length < 6) return toast.error("PIN harus 6 angka");
    setProcessing(true);
    try {
      await updateSalesTeam(editTeamModal.id, { name: newTeamName.trim(), pin: newTeamPin, role: newTeamRole });
      toast.success("Tim berhasil diperbarui");
      setEditTeamModal(null);
      setNewTeamName("");
      setNewTeamPin("");
      setNewTeamRole("sales");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteTeam(team) {
    if (!checkWritePermission("menghapus tim sales")) return;
    if (!confirm(`Hapus ${team.name}? Data tidak dapat dikembalikan.`)) return;
    try {
      await deleteSalesTeam(team.id, team);
      toast.success(`${team.name} berhasil dihapus`);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  }

  const totalGoods = teams.reduce((sum, t) => sum + (t.goodsDropped || 0), 0);
  const totalDeposited = teams.reduce((sum, t) => sum + (t.totalDeposited || 0), 0);
  const totalBalance = totalGoods - totalDeposited;

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <HiOutlineUserGroup className="text-violet-400" size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Buku Besar Penjualan</h2>
            <p className="text-xs text-slate-400">Rekap per tim sales — {teams.length} tim aktif</p>
          </div>
        </div>
        <button onClick={() => setAddTeamModal(true)} className="btn-emerald text-xs">
          <HiOutlinePlus size={16} />
          <span>Tambah Tim</span>
        </button>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Tim</th>
              <th className="text-right">Total Distribusi</th>
              <th className="text-right">Total Setoran</th>
              <th className="text-right">Saldo Piutang</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const balance = (team.goodsDropped || 0) - (team.totalDeposited || 0);
              return (
                <tr key={team.id}>
                  <td className="text-slate-500 text-xs font-mono">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5 group">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                        {team.name?.charAt(0) || "T"}
                      </div>
                      <span className="font-medium text-white">{team.name}</span>
                      {team.role === 'captain' && (
                        <span className="text-[8px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase">Captain</span>
                      )}
                      <button onClick={() => { setEditTeamModal(team); setNewTeamName(team.name); setNewTeamPin(team.pin || ""); setNewTeamRole(team.role || "sales"); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-blue-400 transition-all">
                        <HiOutlinePencilAlt size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="text-right font-mono text-sm">{formatRupiah(team.goodsDropped || 0)}</td>
                  <td className="text-right font-mono text-sm text-emerald-400">{formatRupiah(team.totalDeposited || 0)}</td>
                  <td className={`text-right font-mono text-sm font-semibold ${balance > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {formatRupiah(balance)}
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => setDetailModal(team)} className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-slate-400" title="Detail Riwayat">
                        <HiOutlineEye size={16} />
                      </button>
                      <button onClick={() => setDropModal(team)} className="btn-ghost text-[10px] py-1 px-2" title="Distribusi Barang">
                        <HiOutlineCash size={12} />
                        <span>Distribusi</span>
                      </button>
                      {balance > 0 && (
                        <button onClick={() => setDepositModal(team)} className="btn-emerald text-[10px] py-1 px-2" title="Tambah setoran">
                          <HiOutlinePlus size={12} />
                          <span>Setor</span>
                        </button>
                      )}
                      <button onClick={() => handleDeleteTeam(team)} className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400">
                        <HiOutlineTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── MODAL DETAIL DISTRIBUSI ── */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-content w-[95vw] max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <HiOutlineEye className="text-violet-400" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detail Riwayat Distribusi</h3>
                  <p className="text-xs text-slate-400">{detailModal.name}</p>
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="overflow-x-auto">
              {distributions.length === 0 ? (
                <p className="text-center py-10 text-slate-500 text-sm italic">Belum ada riwayat distribusi.</p>
              ) : (
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10">
                      <th className="py-3 font-semibold">Tgl</th>
                      <th className="py-3 font-semibold">Produk</th>
                      <th className="py-3 font-semibold text-center">Qty</th>
                      <th className="py-3 font-semibold text-right">Harga/Pk</th>
                      <th className="py-3 font-semibold text-right text-emerald-400">Total Nilai</th>
                      <th className="py-3 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                    {distributions.map((d) => (
                      <tr key={d.id} className="text-xs hover:bg-white/5 transition-colors">
                        <td className="py-3 text-slate-400">
                          {d.createdAt?.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="py-3 font-medium text-white">{d.productName}</td>
                        <td className="py-3 text-center text-slate-300">
                          {formatNumber(d.qtyOriginal)} <span className="text-[10px] text-slate-500">{d.unit}</span>
                        </td>
                        <td className="py-3 text-right text-slate-400">
                          {formatRupiah(d.pricePerPack || (d.amount / d.totalPacksDistributed) * (d.packsPerSlop || 10) / (d.packsPerSlop || 10))}
                        </td>
                        <td className="py-3 text-right font-bold text-emerald-400">{formatRupiah(d.amount)}</td>
                        <td className="py-3 text-center">
                          <button 
                            onClick={() => handleDeleteDist(d)} 
                            className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Hapus Distribusi"
                          >
                            <HiOutlineTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* RIWAYAT SETORAN */}
            <div className="mt-8 border-t border-slate-400/10 pt-6">
              <h4 className="text-sm font-bold text-white mb-4">Riwayat Setoran Uang</h4>
              {depositHistory.length === 0 ? (
                <p className="text-center py-4 text-slate-500 text-sm italic">Belum ada riwayat setoran.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-400/10">
                      <th className="py-2 font-semibold">Tanggal</th>
                      <th className="py-2 font-semibold">Metode</th>
                      <th className="py-2 font-semibold text-right text-emerald-400">Nominal Setoran</th>
                      <th className="py-2 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400/5">
                     {depositHistory.map((dep) => (
                       <tr key={dep.id} className="text-xs hover:bg-white/5 transition-colors">
                         <td className="py-2 text-slate-400">
                           {dep.waktu ? dep.waktu.toDate().toLocaleDateString("id-ID", { 
                             day: "2-digit", 
                             month: "short", 
                             year: "numeric", 
                             hour: "2-digit", 
                             minute: "2-digit" 
                           }) : dep.createdAt?.toDate().toLocaleDateString("id-ID")}
                         </td>
                         <td className="py-2">
                           <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                             dep.metode === "Tunai ke Captain" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-400"
                           }`}>
                             {dep.metode || "Transfer"}
                           </span>
                         </td>
                         <td className="py-2 text-right font-bold text-emerald-400">
                           {formatRupiah(dep.nominal || dep.amount)}
                         </td>
                         <td className="py-2 text-right">
                           {(dep.status === "Menunggu Verifikasi" || dep.status === "Menunggu Verifikasi Admin") ? (
                             <button 
                               onClick={() => handleVerifikasi(dep)}
                               className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2 py-1 rounded transition-colors shadow-sm"
                             >
                               Sahkan
                             </button>
                           ) : (
                             <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tighter ${
                               dep.status === "Diverifikasi Admin" || dep.status === "Selesai (Sistem Lama)" ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-800 text-slate-500"
                             }`}>
                               {dep.status === "Diverifikasi Admin" ? "Selesai" : (dep.status === "Kas di Captain" ? "Di Captain" : dep.status)}
                             </span>
                           )}
                         </td>
                       </tr>
                     ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DISTRIBUSI ── */}
      {dropModal && (
        <div className="modal-overlay" onClick={() => setDropModal(null)}>
          <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><HiOutlineCash className="text-blue-400" size={20} /></div>
                <div>
                  <h3 className="text-base font-bold text-white">Distribusi Barang</h3>
                  <p className="text-xs text-slate-400">{dropModal.name}</p>
                </div>
              </div>
              <button onClick={() => setDropModal(null)} className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400"><HiOutlineX size={18} /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Batch PO (Sisa Stok)</label>
                <select 
                  value={selectedPoId} 
                  onChange={(e) => { 
                    const newPoId = e.target.value;
                    setSelectedPoId(newPoId); 
                    
                    // Ambil data PO untuk auto-fill harga
                    const po = purchases?.find(p => p.id === newPoId);
                    const defaultPrice = po?.targetHargaJual ? po.targetHargaJual.toString() : "";
                    setDropPricePerPack(defaultPrice);
                  }} 
                  className="input-field w-full"
                >
                  <option value="">— Pilih batch PO —</option>
                  {availableBatches.map((batch) => {
                    const tgl = batch.createdAt?.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
                    return (
                      <option key={batch.id} value={batch.id}>
                        {tgl} — {batch.productName} (Sisa: {batch.realSisa.toLocaleString("id-ID")} Pk) — Modal: {formatRupiah(batch.hpp)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah</label>
                    <input 
                      type="text" 
                      value={formatInputNumber(dropQty)} 
                      onChange={(e) => { 
                        const raw = parseInputNumber(e.target.value);
                        setDropQty(raw); 
                      }} 
                      placeholder="0" 
                      className="input-field" 
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Satuan</label>
                    <select value={dropUnit} onChange={(e) => setDropUnit(e.target.value)} className="input-field">
                      <option value="Ct">Ct</option>
                      <option value="Bal">Bal</option>
                      <option value="Slop">Slop</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Harga / Pack (Rp)</label>
                  <input 
                    type="text" 
                    value={formatInputNumber(dropPricePerPack)} 
                    onChange={(e) => { 
                      const raw = parseInputNumber(e.target.value);
                      setDropPricePerPack(raw); 
                    }} 
                    placeholder="0" 
                    className="input-field" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Total Nilai Distribusi (Rp)</label>
                <input 
                  type="text" 
                  value={formatNumber(dropAmount)} 
                  onChange={(e) => setDropAmount(parseRupiah(e.target.value))} 
                  placeholder="0" 
                  className="input-field bg-dark-700/50 font-bold text-emerald-400" 
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setDropModal(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleGoodsDrop} disabled={processing} className="btn-primary flex-1">Simpan Distribusi</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SETORAN ── */}
      {depositModal && (
        <div className="modal-overlay" onClick={() => setDepositModal(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-2">Tambah Setoran - {depositModal.name}</h3>
            <p className="text-xs text-amber-400 font-mono mb-5">
              Sisa Piutang: {formatRupiah((depositModal.goodsDropped || 0) - (depositModal.totalDeposited || 0))}
            </p>
            <input 
              type="text" 
              value={formatInputNumber(depositAmount)} 
              onChange={(e) => setDepositAmount(parseInputNumber(e.target.value))} 
              placeholder="Jumlah Setoran (Rp)" 
              className="input-field mb-5" 
            />
            <div className="flex items-center gap-3">
              <button onClick={() => setDepositModal(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleDeposit} disabled={processing} className="btn-primary flex-1">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIT/TAMBAH TIM ── */}
      {addTeamModal && (
        <div className="modal-overlay" onClick={() => setAddTeamModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-5">Tambah Tim Sales</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Tim</label>
              <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Contoh: Budi Darmawan" className="input-field w-full" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">PIN Akses Aplikasi (6 Angka)</label>
              <input 
                type="text" 
                maxLength="6"
                pattern="\d{6}"
                value={newTeamPin} 
                onChange={(e) => setNewTeamPin(e.target.value.replace(/\D/g, ''))}
                className="input-field w-full text-center tracking-[0.5em] font-mono text-lg"
                placeholder="123456"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">PIN ini akan digunakan sales untuk login ke aplikasi HP.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setAddTeamModal(false)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleAddTeam} disabled={processing} className="btn-primary flex-1">Simpan</button>
            </div>
          </div>
        </div>
      )}
      {editTeamModal && (
        <div className="modal-overlay" onClick={() => setEditTeamModal(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-5">Edit Tim</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Tim</label>
              <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="input-field w-full" />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">PIN Akses Aplikasi (6 Angka)</label>
              <input 
                type="text" 
                maxLength="6"
                pattern="\d{6}"
                value={newTeamPin} 
                onChange={(e) => setNewTeamPin(e.target.value.replace(/\D/g, ''))}
                className="input-field w-full text-center tracking-[0.5em] font-mono text-lg"
                placeholder="123456"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">Ubah PIN jika sales lupa atau ganti device.</p>
            </div>
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={newTeamRole === 'captain'}
                  onChange={(e) => setNewTeamRole(e.target.checked ? 'captain' : 'sales')}
                  className="w-4 h-4 rounded border-slate-600 bg-dark-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">Jadikan Captain</span>
                  <p className="text-[9px] text-slate-500">Memiliki akses Distribusi ke Tim & Verifikasi Setoran</p>
                </div>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditTeamModal(null)} className="btn-ghost flex-1">Batal</button>
              <button onClick={handleUpdateTeam} disabled={processing} className="btn-primary flex-1">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
