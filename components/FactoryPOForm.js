"use client";

import { useState } from "react";
import {
  HiOutlineCalculator,
  HiOutlineSave,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlineInformationCircle,
  HiOutlineExclamation,
} from "react-icons/hi";
import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  addPurchase,
  updateInventoryStock,
  incrementSummaryField,
  addProduct,
  deleteProduct,
  updateProduct,
  updateProductPackStock,
} from "@/lib/firestore";
import toast from "react-hot-toast";

export default function FactoryPOForm({ products }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    packsPerSlop: "",
    slopsPerBall: "",
    ballsPerKarton: "",
  });

  const [form, setForm] = useState({
    jumlahKarton: "",
    hargaBeliPerPack: "",
    targetHargaJual: "",
    biayaPengiriman: "",
    uangMuka: "",
  });
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cari produk yang dipilih
  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  // Hitung konversi dari produk terpilih
  function getConversion(product) {
    if (!product) return null;
    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerBall = product.slopsPerBall || 20;
    const ballsPerKarton = product.ballsPerKarton || 5;
    const packsPerBall = packsPerSlop * slopsPerBall;
    const packsPerKarton = packsPerBall * ballsPerKarton;
    return {
      packsPerSlop,
      slopsPerBall,
      ballsPerKarton,
      packsPerBall,
      packsPerKarton,
    };
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function calculate() {
    if (!selectedProduct) {
      toast.error("Pilih produk terlebih dahulu");
      return;
    }

    const conv = getConversion(selectedProduct);
    const jumlahKarton = parseInt(form.jumlahKarton) || 0;
    const hargaBeliPerPack = parseFloat(form.hargaBeliPerPack) || 0;
    const targetHargaJual = parseFloat(form.targetHargaJual) || 0;
    const biayaPengiriman = parseFloat(form.biayaPengiriman) || 0;
    const uangMuka = parseFloat(form.uangMuka) || 0;

    if (jumlahKarton <= 0 || hargaBeliPerPack <= 0) {
      toast.error("Jumlah karton dan harga per pack harus lebih dari 0");
      return;
    }

    const totalBall = jumlahKarton * conv.ballsPerKarton;
    const totalSlop = totalBall * conv.slopsPerBall;
    const totalPack = jumlahKarton * conv.packsPerKarton;
    const totalPembelian = totalPack * hargaBeliPerPack;
    const ongkirPerPack = totalPack > 0 ? biayaPengiriman / totalPack : 0;
    const hpp = hargaBeliPerPack + ongkirPerPack; // HPP per pack
    const totalFaktur = totalPembelian + biayaPengiriman;
    const sisaHutang = totalFaktur - uangMuka;
    const marginPerPack = targetHargaJual - hpp;
    const marginPersen = hpp > 0 ? (marginPerPack / hpp) * 100 : 0;

    setResult({
      productName: selectedProduct.name,
      conversion: conv,
      jumlahKarton,
      totalBall,
      totalSlop,
      totalPack,
      hargaBeliPerPack,
      totalPembelian,
      biayaPengiriman,
      ongkirPerPack,
      hpp,
      totalFaktur,
      uangMuka,
      sisaHutang,
      targetHargaJual,
      marginPerPack,
      marginPersen,
    });
  }

  async function handleSubmit() {
    if (!result) return;
    setSaving(true);
    try {
      // 1. Simpan data pembelian
      await addPurchase({
        productName: result.productName,
        jumlahKarton: result.jumlahKarton,
        totalBall: result.totalBall,
        totalSlop: result.totalSlop,
        totalPack: result.totalPack,
        hargaBeliPerPack: result.hargaBeliPerPack,
        targetHargaJual: result.targetHargaJual,
        biayaPengiriman: result.biayaPengiriman,
        uangMuka: result.uangMuka,
        hpp: result.hpp,
        totalFaktur: result.totalFaktur,
        sisaHutang: result.sisaHutang,
        conversion: result.conversion,
      });

      // 1.5 Update Harga Jual di Master Produk
      await updateProduct(selectedProductId, {
        currentSellingPrice: result.targetHargaJual,
      });

      // 2. Tambah stok gudang (global & per produk pack)
      await updateInventoryStock(result.jumlahKarton);
      
      const packsPerSlop = selectedProduct?.packsPerSlop || 10;
      const slopsPerKarton = (selectedProduct?.slopsPerBall || 20) * (selectedProduct?.ballsPerKarton || 5);
      const totalPacksPurchased = result.jumlahKarton * slopsPerKarton * packsPerSlop;
      
      await updateProductPackStock(selectedProductId, totalPacksPurchased);

      // 3. Tambah hutang pabrik
      await incrementSummaryField("factoryDebt", result.sisaHutang);

      // 4. Tambah total aset
      await incrementSummaryField("totalAssets", result.totalFaktur);

      toast.success("PO berhasil disimpan ke database!");

      // Reset
      setForm({
        jumlahKarton: "",
        hargaBeliPerPack: "",
        targetHargaJual: "",
        biayaPengiriman: "",
        uangMuka: "",
      });
      setResult(null);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm({
      jumlahKarton: "",
      hargaBeliPerPack: "",
      targetHargaJual: "",
      biayaPengiriman: "",
      uangMuka: "",
    });
    setResult(null);
  }

  async function handleAddProduct() {
    const { name, packsPerSlop, slopsPerBall, ballsPerKarton } = newProduct;
    if (!name.trim()) return toast.error("Nama produk wajib diisi");
    if (!packsPerSlop || !slopsPerBall || !ballsPerKarton)
      return toast.error("Semua konversi satuan wajib diisi");

    setSavingProduct(true);
    try {
      await addProduct({
        name: name.trim(),
        packsPerSlop: parseInt(packsPerSlop),
        slopsPerBall: parseInt(slopsPerBall),
        ballsPerKarton: parseInt(ballsPerKarton),
      });
      toast.success(`Produk "${name.trim()}" berhasil ditambahkan!`);
      setNewProduct({
        name: "",
        packsPerSlop: "",
        slopsPerBall: "",
        ballsPerKarton: "",
      });
      setShowAddProduct(false);
    } catch (err) {
      toast.error("Gagal menambah produk: " + err.message);
    } finally {
      setSavingProduct(false);
    }
  }

  const conv = selectedProduct ? getConversion(selectedProduct) : null;

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <HiOutlineCalculator className="text-blue-400" size={22} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">
            PO Pabrik & Kalkulator HPP
          </h2>
          <p className="text-xs text-slate-400">
            Hitung Harga Pokok Penjualan per pack termasuk ongkir
          </p>
        </div>
      </div>

      {/* Pilihan Produk */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Pilih Produk
        </label>
        <div className="flex gap-3">
          <select
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              setResult(null);
            }}
            className="input-field flex-1"
          >
            <option value="">— Pilih produk —</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddProduct(true)}
            className="btn-emerald whitespace-nowrap"
          >
            <HiOutlinePlus size={16} />
            <span className="hidden sm:inline">Produk Baru</span>
          </button>
          {selectedProductId && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
              title="Hapus produk ini"
            >
              <HiOutlineTrash size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Info Konversi Produk */}
      {conv && (
        <div className="mb-5 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <div className="flex items-start gap-2 mb-2">
            <HiOutlineInformationCircle
              className="text-blue-400 flex-shrink-0 mt-0.5"
              size={16}
            />
            <p className="text-xs font-semibold text-blue-300">
              Konversi Satuan — {selectedProduct.name}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-dark-800/50 rounded-lg p-2.5">
              <span className="text-slate-500">1 Slop</span>
              <p className="text-white font-semibold">
                {conv.packsPerSlop} Pack
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-2.5">
              <span className="text-slate-500">1 Ball</span>
              <p className="text-white font-semibold">
                {conv.slopsPerBall} Slop = {conv.packsPerBall} Pack
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-2.5">
              <span className="text-slate-500">1 Karton</span>
              <p className="text-white font-semibold">
                {conv.ballsPerKarton} Ball
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-2.5">
              <span className="text-slate-500">1 Karton</span>
              <p className="text-emerald-400 font-bold">
                {formatNumber(conv.packsPerKarton)} Pack
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Input */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Jumlah Karton
          </label>
          <input
            type="number"
            name="jumlahKarton"
            value={form.jumlahKarton}
            onChange={handleChange}
            placeholder="mis. 10"
            className="input-field"
            min="1"
          />
          {conv && form.jumlahKarton > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              = {formatNumber(parseInt(form.jumlahKarton) * conv.ballsPerKarton)}{" "}
              Ball ={" "}
              {formatNumber(parseInt(form.jumlahKarton) * conv.packsPerKarton)}{" "}
              Pack
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Harga Beli per Pack (Rp)
          </label>
          <input
            type="number"
            name="hargaBeliPerPack"
            value={form.hargaBeliPerPack}
            onChange={handleChange}
            placeholder="mis. 15000"
            className="input-field"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Target Harga Jual per Pack (Rp)
          </label>
          <input
            type="number"
            name="targetHargaJual"
            value={form.targetHargaJual}
            onChange={handleChange}
            placeholder="mis. 18000"
            className="input-field"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Biaya Pengiriman (Rp)
          </label>
          <input
            type="number"
            name="biayaPengiriman"
            value={form.biayaPengiriman}
            onChange={handleChange}
            placeholder="mis. 500000"
            className="input-field"
            min="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Uang Muka / DP (Rp)
          </label>
          <input
            type="number"
            name="uangMuka"
            value={form.uangMuka}
            onChange={handleChange}
            placeholder="mis. 5000000"
            className="input-field"
            min="0"
          />
        </div>

        {/* Tombol aksi */}
        <div className="flex items-end gap-3">
          <button
            onClick={calculate}
            disabled={!selectedProduct}
            className="btn-primary flex-1"
          >
            <HiOutlineCalculator size={16} />
            Hitung HPP
          </button>
          <button onClick={handleReset} className="btn-ghost">
            <HiOutlineRefresh size={16} />
          </button>
        </div>
      </div>

      {/* Hasil Perhitungan */}
      {result && (
        <div className="border-t border-slate-400/8 pt-5 mt-2">
          <h3 className="text-sm font-semibold text-white mb-4">
            📊 Hasil Perhitungan — {result.productName}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-5">
            <ResultItem
              label="Jumlah Karton"
              value={formatNumber(result.jumlahKarton)}
              suffix="karton"
            />
            <ResultItem
              label="Total Ball"
              value={formatNumber(result.totalBall)}
              suffix="ball"
            />
            <ResultItem
              label="Total Slop"
              value={formatNumber(result.totalSlop)}
              suffix="slop"
            />
            <ResultItem
              label="Total Pack"
              value={formatNumber(result.totalPack)}
              suffix="pack"
            />
            <ResultItem
              label="Total Pembelian"
              value={formatRupiah(result.totalPembelian)}
            />
            <ResultItem
              label="Ongkir per Pack"
              value={formatRupiah(result.ongkirPerPack)}
            />
            <ResultItem
              label="HPP per Pack"
              value={formatRupiah(result.hpp)}
              highlight
            />
            <ResultItem
              label="Total Faktur"
              value={formatRupiah(result.totalFaktur)}
            />
            <ResultItem
              label="Uang Muka (DP)"
              value={formatRupiah(result.uangMuka)}
            />
            <ResultItem
              label="Sisa Hutang"
              value={formatRupiah(result.sisaHutang)}
              alert={result.sisaHutang > 0}
            />
            <ResultItem
              label="Margin per Pack"
              value={formatRupiah(result.marginPerPack)}
              suffix={`(${result.marginPersen.toFixed(1)}%)`}
              highlight={result.marginPerPack > 0}
              alert={result.marginPerPack <= 0}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            <HiOutlineSave size={16} />
            {saving ? "Menyimpan..." : "Simpan ke Database"}
          </button>
        </div>
      )}

      {/* ── MODAL TAMBAH PRODUK ── */}
      {showAddProduct && (
        <div
          className="modal-overlay"
          onClick={() => setShowAddProduct(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">
                Tambah Produk Baru
              </h3>
              <button
                onClick={() => setShowAddProduct(false)}
                className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, name: e.target.value })
                  }
                  placeholder="mis. SURYA 12"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Pack / Slop
                  </label>
                  <input
                    type="number"
                    value={newProduct.packsPerSlop}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        packsPerSlop: e.target.value,
                      })
                    }
                    placeholder="10"
                    className="input-field"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Slop / Ball
                  </label>
                  <input
                    type="number"
                    value={newProduct.slopsPerBall}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        slopsPerBall: e.target.value,
                      })
                    }
                    placeholder="20"
                    className="input-field"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Ball / Karton
                  </label>
                  <input
                    type="number"
                    value={newProduct.ballsPerKarton}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        ballsPerKarton: e.target.value,
                      })
                    }
                    placeholder="5"
                    className="input-field"
                    min="1"
                  />
                </div>
              </div>

              {/* Preview konversi */}
              {newProduct.packsPerSlop &&
                newProduct.slopsPerBall &&
                newProduct.ballsPerKarton && (
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs">
                    <p className="text-emerald-400 font-semibold mb-1">
                      Preview Konversi:
                    </p>
                    <p className="text-slate-300">
                      1 Karton = {newProduct.ballsPerKarton} Ball ={" "}
                      {formatNumber(
                        parseInt(newProduct.ballsPerKarton) *
                          parseInt(newProduct.slopsPerBall)
                      )}{" "}
                      Slop ={" "}
                      <span className="text-emerald-400 font-bold">
                        {formatNumber(
                          parseInt(newProduct.ballsPerKarton) *
                            parseInt(newProduct.slopsPerBall) *
                            parseInt(newProduct.packsPerSlop)
                        )}{" "}
                        Pack
                      </span>
                    </p>
                  </div>
                )}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setShowAddProduct(false)}
                className="btn-ghost flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleAddProduct}
                disabled={savingProduct}
                className="btn-primary flex-1"
              >
                {savingProduct ? "Menyimpan..." : "Simpan Produk"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI HAPUS PRODUK ── */}
      {showDeleteConfirm && selectedProduct && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
                <HiOutlineExclamation className="text-rose-400" size={28} />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Hapus Produk?
              </h3>
              <p className="text-sm text-slate-400 mb-5">
                Produk <span className="text-white font-semibold">"{selectedProduct.name}"</span> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-ghost flex-1"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await deleteProduct(selectedProductId);
                      toast.success(`Produk "${selectedProduct.name}" berhasil dihapus`);
                      setSelectedProductId("");
                      setResult(null);
                      setShowDeleteConfirm(false);
                    } catch (err) {
                      toast.error("Gagal menghapus: " + err.message);
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <HiOutlineTrash size={16} />
                  {deleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultItem({ label, value, suffix, highlight, alert }) {
  return (
    <div className="bg-dark-800/60 rounded-xl p-3 border border-slate-400/5">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p
        className={`text-sm font-bold ${
          alert
            ? "text-rose-400"
            : highlight
            ? "text-emerald-400"
            : "text-white"
        }`}
      >
        {value}
        {suffix && (
          <span className="text-xs font-normal text-slate-500 ml-1">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
