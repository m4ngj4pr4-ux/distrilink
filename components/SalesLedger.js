"use client";

import { useState } from "react";
import {
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlineCash,
  HiOutlineX,
  HiOutlineTrash,
} from "react-icons/hi";
import { formatRupiah } from "@/lib/utils";
import {
  addDeposit,
  addGoodsDropTransaction,
  addSalesTeam,
  deleteSalesTeam,
  getLastPurchase,
  incrementSummaryField,
} from "@/lib/firestore";
import toast from "react-hot-toast";

export default function SalesLedger({ teams, products }) {
  const [depositModal, setDepositModal] = useState(null);
  const [dropModal, setDropModal] = useState(null);
  const [addTeamModal, setAddTeamModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [dropAmount, setDropAmount] = useState("");
  const [dropQty, setDropQty] = useState("");
  const [dropUnit, setDropUnit] = useState("Ct"); // Ct atau Slop
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [processing, setProcessing] = useState(false);

  async function handleDeposit() {
    if (!depositModal) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error("Masukkan jumlah setoran yang valid");
      return;
    }
    setProcessing(true);
    try {
      await addDeposit(depositModal.id, amount);
      // Kurangi piutang sales
      await incrementSummaryField("salesReceivables", -amount);
      // Tambah total aset (uang masuk)
      await incrementSummaryField("totalAssets", amount);
      toast.success(
        `Setoran ${formatRupiah(amount)} dari ${depositModal.name} berhasil!`
      );
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
    
    // Konversi ke Karton untuk stok
    let cartonQty = qty;
    if (dropUnit === "Slop") {
      const slopsPerBall = product.slopsPerBall || 20;
      const ballsPerKarton = product.ballsPerKarton || 5;
      cartonQty = qty / (slopsPerBall * ballsPerKarton);
    }

    setProcessing(true);
    try {
      await addGoodsDropTransaction({
        teamId: dropModal.id,
        teamName: dropModal.name,
        productId: selectedProductId,
        productName: product.name,
        jumlahKarton: cartonQty,
        amount: amount,
        unit: dropUnit,
        qtyOriginal: qty,
      });

      toast.success(
        `Barang turun ${product.name} (${qty} ${dropUnit}) untuk ${dropModal.name} berhasil!`
      );
      setDropModal(null);
      setDropAmount("");
      setDropQty("");
      setSelectedProductId("");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    } finally {
      setProcessing(false);
    }
  }

  // Fungsi helper untuk hitung harga otomatis
  async function updateCalculatedPrice(prodId, qty, unit) {
    if (!prodId || !qty) return;
    const product = products.find(p => p.id === prodId);
    if (!product) return;

    try {
      const lastPO = await getLastPurchase(product.name);
      if (lastPO && lastPO.targetHargaJual) {
        const packsPerSlop = product.packsPerSlop || 10;
        const slopsPerBall = product.slopsPerBall || 20;
        const ballsPerKarton = product.ballsPerKarton || 5;
        
        let totalPacks = 0;
        if (unit === "Ct") {
          totalPacks = qty * (packsPerSlop * slopsPerBall * ballsPerKarton);
        } else {
          totalPacks = qty * packsPerSlop;
        }

        const totalValue = totalPacks * lastPO.targetHargaJual;
        setDropAmount(Math.round(totalValue).toString());
      }
    } catch (err) {
      console.error("Error auto price:", err);
    }
  }

  async function handleAddTeam() {
    if (!newTeamName.trim()) {
      toast.error("Masukkan nama tim");
      return;
    }
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

  async function handleDeleteTeam(team) {
    if (!confirm(`Hapus ${team.name}? Data tidak dapat dikembalikan.`)) return;
    try {
      await deleteSalesTeam(team.id);
      toast.success(`${team.name} berhasil dihapus`);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  }

  const totalGoods = teams.reduce((sum, t) => sum + (t.goodsDropped || 0), 0);
  const totalDeposited = teams.reduce(
    (sum, t) => sum + (t.totalDeposited || 0),
    0
  );
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
            <h2 className="text-lg font-bold text-white">
              Buku Besar Penjualan
            </h2>
            <p className="text-xs text-slate-400">
              Rekap per tim sales — {teams.length} tim aktif
            </p>
          </div>
        </div>
        <button onClick={() => setAddTeamModal(true)} className="btn-emerald">
          <HiOutlinePlus size={16} />
          <span className="hidden sm:inline">Tambah Tim</span>
        </button>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Tim</th>
              <th className="text-right">Barang Turun (Rp)</th>
              <th className="text-right">Total Setoran (Rp)</th>
              <th className="text-right">Saldo Piutang (Rp)</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const balance =
                (team.goodsDropped || 0) - (team.totalDeposited || 0);
              return (
                <tr key={team.id}>
                  <td className="text-slate-500 text-xs font-mono">
                    {i + 1}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                        {team.name?.charAt(0) || "T"}
                      </div>
                      <span className="font-medium text-white">
                        {team.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-sm">
                    {formatRupiah(team.goodsDropped || 0)}
                  </td>
                  <td className="text-right font-mono text-sm text-emerald-400">
                    {formatRupiah(team.totalDeposited || 0)}
                  </td>
                  <td
                    className={`text-right font-mono text-sm font-semibold ${
                      balance > 0
                        ? "text-amber-400"
                        : balance === 0
                        ? "text-slate-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {formatRupiah(balance)}
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setDropModal(team)}
                        className="btn-ghost text-xs"
                        title="Tambah barang turun"
                      >
                        <HiOutlineCash size={14} />
                        <span className="hidden lg:inline">Turun</span>
                      </button>
                      <button
                        onClick={() => setDepositModal(team)}
                        className="btn-emerald text-xs"
                        title="Tambah setoran"
                      >
                        <HiOutlinePlus size={14} />
                        <span className="hidden lg:inline">Setor</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Hapus tim"
                      >
                        <HiOutlineTrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {teams.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-500">
                  Belum ada data tim sales. Klik &quot;Tambah Tim&quot; untuk
                  memulai.
                </td>
              </tr>
            )}
          </tbody>

          {teams.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-400/10">
                <td
                  colSpan={2}
                  className="py-3 px-4 text-sm font-semibold text-white"
                >
                  TOTAL
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm font-semibold text-white">
                  {formatRupiah(totalGoods)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm font-semibold text-emerald-400">
                  {formatRupiah(totalDeposited)}
                </td>
                <td
                  className={`py-3 px-4 text-right font-mono text-sm font-bold ${
                    totalBalance > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {formatRupiah(totalBalance)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── MODAL SETORAN ── */}
      {depositModal && (
        <div className="modal-overlay" onClick={() => setDepositModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <HiOutlineCash className="text-emerald-400" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Tambah Setoran
                  </h3>
                  <p className="text-xs text-slate-400">
                    {depositModal.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDepositModal(null)}
                className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            <div className="mb-2">
              <p className="text-xs text-slate-500 mb-1">
                Saldo piutang saat ini
              </p>
              <p className="text-xl font-bold text-amber-400 mb-4">
                {formatRupiah(
                  (depositModal.goodsDropped || 0) -
                    (depositModal.totalDeposited || 0)
                )}
              </p>
            </div>

            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Jumlah Setoran (Rp)
            </label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="mis. 1500000"
              className="input-field mb-5"
              autoFocus
              min="0"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDepositModal(null)}
                className="btn-ghost flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleDeposit}
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? "Menyimpan..." : "Simpan Setoran"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL BARANG TURUN ── */}
      {dropModal && (
        <div className="modal-overlay" onClick={() => setDropModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <HiOutlineCash className="text-blue-400" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Barang Turun
                  </h3>
                  <p className="text-xs text-slate-400">{dropModal.name}</p>
                </div>
              </div>
              <button
                onClick={() => setDropModal(null)}
                className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Pilih Produk
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    setSelectedProductId(prodId);
                    updateCalculatedPrice(prodId, dropQty, dropUnit);
                  }}
                  className="input-field w-full"
                >
                  <option value="">— Pilih produk —</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Jumlah
                    </label>
                    <input
                      type="number"
                      value={dropQty}
                      onChange={(e) => {
                        setDropQty(e.target.value);
                        updateCalculatedPrice(selectedProductId, e.target.value, dropUnit);
                      }}
                      placeholder="mis. 1"
                      className="input-field"
                      min="1"
                      step="any"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Satuan
                    </label>
                    <select
                      value={dropUnit}
                      onChange={(e) => {
                        setDropUnit(e.target.value);
                        updateCalculatedPrice(selectedProductId, dropQty, e.target.value);
                      }}
                      className="input-field"
                    >
                      <option value="Ct">Ct</option>
                      <option value="Slop">Slop</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Total Nilai (Rp)
                  </label>
                  <input
                    type="number"
                    value={dropAmount}
                    onChange={(e) => setDropAmount(e.target.value)}
                    placeholder="mis. 5000000"
                    className="input-field"
                  />
                </div>
              </div>

              {selectedProductId && dropQty > 0 && (
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-300">
                  ⚠️ Barang akan dikurangi dari stok gudang sebanyak **{dropQty} {dropUnit}**.
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setDropModal(null);
                  setSelectedProductId("");
                  setDropQty("");
                  setDropAmount("");
                  setDropUnit("Ct");
                }}
                className="btn-ghost flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleGoodsDrop}
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? "Menyimpan..." : "Simpan Distribusi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TAMBAH TIM ── */}
      {addTeamModal && (
        <div className="modal-overlay" onClick={() => setAddTeamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">
                Tambah Tim Sales Baru
              </h3>
              <button
                onClick={() => setAddTeamModal(false)}
                className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Nama Tim
            </label>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="mis. Tim 8"
              className="input-field mb-5"
              autoFocus
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAddTeamModal(false)}
                className="btn-ghost flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleAddTeam}
                disabled={processing}
                className="btn-primary flex-1"
              >
                {processing ? "Menyimpan..." : "Tambah Tim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
