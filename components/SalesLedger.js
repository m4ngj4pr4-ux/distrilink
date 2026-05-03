"use client";

import { useState, useEffect } from "react";
import {
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlineCash,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlinePencilAlt,
  HiOutlineEye,
} from "react-icons/hi";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  addDeposit,
  addGoodsDropTransaction,
  addSalesTeam,
  updateSalesTeam,
  deleteSalesTeam,
  incrementSummaryField,
  subscribeDistributions,
} from "@/lib/firestore";
import toast from "react-hot-toast";

export default function SalesLedger({ teams, products }) {
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
  const [selectedProductId, setSelectedProductId] = useState("");
  
  const [newTeamName, setNewTeamName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [distributions, setDistributions] = useState([]);

  useEffect(() => {
    if (!detailModal) {
      setDistributions([]);
      return;
    }
    const unsub = subscribeDistributions(detailModal.id, (data) => {
      setDistributions(data);
    });
    return () => unsub();
  }, [detailModal]);

  async function handleDeposit() {
    if (!depositModal) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return toast.error("Masukkan jumlah setoran");
    setProcessing(true);
    try {
      await addDeposit(depositModal.id, amount);
      await incrementSummaryField("salesReceivables", -amount);
      await incrementSummaryField("totalAssets", amount);
      toast.success(`Setoran ${formatRupiah(amount)} berhasil!`);
      setDepositModal(null);
      setDepositAmount("");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGoodsDrop() {
    if (!dropModal) return;
    const amount = parseFloat(dropAmount);
    const qty = parseFloat(dropQty);
    
    if (!selectedProductId) return toast.error("Pilih produk");
    if (!qty || qty <= 0) return toast.error("Masukkan jumlah");
    if (!amount || amount <= 0) return toast.error("Nilai barang tidak valid");

    const product = products.find(p => p.id === selectedProductId);
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

    setProcessing(true);
    try {
      await addGoodsDropTransaction({
        teamId: dropModal.id,
        teamName: dropModal.name,
        productId: selectedProductId,
        productName: product.name,
        totalPacksDistributed: totalPacksDistributed,
        jumlahKarton: totalPacksDistributed / (slopsPerKarton * packsPerSlop),
        amount: amount,
        unit: dropUnit,
        qtyOriginal: qty,
        pricePerPack: parseFloat(dropPricePerPack),
      });

      toast.success(`Distribusi ${product.name} (${qty} ${dropUnit}) berhasil!`);
      setDropModal(null);
      setDropAmount("");
      setDropQty("");
      setSelectedProductId("");
      setDropPricePerPack("");
      setDropUnit("Ct");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  function updateCalculatedPrice(prodId, qty, unit, customPrice = null) {
    if (!prodId) return;
    const product = products.find(p => p.id === prodId);
    if (!product) return;

    const priceToUse = customPrice !== null ? customPrice : (product.currentSellingPrice || 0);
    if (customPrice === null) {
      setDropPricePerPack(product.currentSellingPrice ? product.currentSellingPrice.toString() : "");
    }

    const qtyNum = parseFloat(qty);
    if (isNaN(qtyNum) || !priceToUse) {
      setDropAmount("");
      return;
    }

    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);
    
    let totalPacks = 0;
    if (unit === "Ct") {
      totalPacks = qtyNum * slopsPerKarton * packsPerSlop;
    } else if (unit === "Bal") {
      totalPacks = qtyNum * 10 * packsPerSlop; // 1 Bal = 10 Slop
    } else {
      totalPacks = qtyNum * packsPerSlop;
    }

    const totalValue = totalPacks * parseFloat(priceToUse);
    setDropAmount(Math.round(totalValue).toString());
  }

  async function handleAddTeam() {
    if (!newTeamName.trim()) return toast.error("Masukkan nama tim");
    setProcessing(true);
    try {
      await addSalesTeam(newTeamName.trim());
      toast.success(`${newTeamName.trim()} berhasil ditambahkan!`);
      setNewTeamName("");
      setAddTeamModal(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpdateTeam() {
    if (!editTeamModal || !newTeamName.trim()) return;
    setProcessing(true);
    try {
      await updateSalesTeam(editTeamModal.id, { name: newTeamName.trim() });
      toast.success("Nama tim berhasil diperbarui");
      setEditTeamModal(null);
      setNewTeamName("");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteTeam(team) {
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
                      <button onClick={() => { setEditTeamModal(team); setNewTeamName(team.name); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-blue-400 transition-all">
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
                      <button onClick={() => setDepositModal(team)} className="btn-emerald text-[10px] py-1 px-2" title="Tambah setoran">
                        <HiOutlinePlus size={12} />
                        <span>Setor</span>
                      </button>
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
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Pilih Produk</label>
                <select value={selectedProductId} onChange={(e) => { setSelectedProductId(e.target.value); updateCalculatedPrice(e.target.value, dropQty, dropUnit); }} className="input-field w-full">
                  <option value="">— Pilih produk —</option>
                  {products?.map((p) => ( <option key={p.id} value={p.id}>{p.name}</option> ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah</label>
                    <input type="number" value={dropQty} onChange={(e) => { setDropQty(e.target.value); updateCalculatedPrice(selectedProductId, e.target.value, dropUnit, dropPricePerPack); }} placeholder="0" className="input-field" min="0" step="any" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Satuan</label>
                    <select value={dropUnit} onChange={(e) => { setDropUnit(e.target.value); updateCalculatedPrice(selectedProductId, dropQty, e.target.value, dropPricePerPack); }} className="input-field">
                      <option value="Ct">Ct</option>
                      <option value="Bal">Bal</option>
                      <option value="Slop">Slop</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Harga / Pack (Rp)</label>
                  <input type="number" value={dropPricePerPack} onChange={(e) => { setDropPricePerPack(e.target.value); updateCalculatedPrice(selectedProductId, dropQty, dropUnit, e.target.value); }} placeholder="0" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Total Nilai Distribusi (Rp)</label>
                <input type="number" value={dropAmount} onChange={(e) => setDropAmount(e.target.value)} placeholder="0" className="input-field bg-dark-700/50 font-bold text-emerald-400" />
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
            <h3 className="text-base font-bold text-white mb-5">Tambah Setoran - {depositModal.name}</h3>
            <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Jumlah Setoran (Rp)" className="input-field mb-5" />
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
            <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Nama Tim" className="input-field mb-5" />
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
            <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} className="input-field mb-5" />
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
