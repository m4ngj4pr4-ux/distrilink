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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { formatRupiah, formatNumber, formatInputNumber, parseInputNumber } from "@/lib/utils";
import {
  addPurchaseAtomic,
  addProduct,
  deleteProduct,
} from "@/lib/firestore";
import { usePermissions } from "@/hooks/usePermissions";

export default function FactoryPOForm({ products }) {
  const { checkWritePermission } = usePermissions();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    packsPerSlop: "",
    slopsPerBall: "",
    ballsPerKarton: "",
    ekstraSlopPerKarton: 0,
    imageUrl: "",
  });
  const [imageFile, setImageFile] = useState(null);

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
    const ekstraSlop = product.ekstraSlopPerKarton || 0;
    const packsPerBall = packsPerSlop * slopsPerBall;
    const slopsPerKarton = (slopsPerBall * ballsPerKarton) + ekstraSlop;
    const packsPerKarton = slopsPerKarton * packsPerSlop;
    return {
      packsPerSlop,
      slopsPerBall,
      ballsPerKarton,
      ekstraSlopPerKarton: ekstraSlop,
      slopsPerKarton,
      packsPerBall,
      packsPerKarton,
    };
  }

  function handleChange(e) {
    const { name, value } = e.target;
    // Terapkan parsing khusus untuk input angka
    const numericFields = ["jumlahKarton", "hargaBeliPerPack", "biayaPengiriman", "uangMuka", "targetHargaJual"];
    const valToSave = numericFields.includes(name) ? parseInputNumber(value) : value;
    setForm({ ...form, [name]: valToSave });
  }

  function calculate() {
    if (!selectedProduct) {
      toast.error("Pilih produk terlebih dahulu");
      return;
    }

    const conv = getConversion(selectedProduct);
    const jumlahKarton = parseFloat(form.jumlahKarton);
    const hargaBeliPerPack = parseFloat(form.hargaBeliPerPack);
    const targetHargaJual = parseFloat(form.targetHargaJual);
    const biayaPengiriman = parseFloat(form.biayaPengiriman);
    const uangMuka = parseFloat(form.uangMuka);

    // VALIDASI KETAT
    if (!form.jumlahKarton || isNaN(jumlahKarton) || jumlahKarton <= 0) {
      toast.error("Jumlah Karton harus berupa angka lebih dari 0");
      return;
    }
    if (!form.hargaBeliPerPack || isNaN(hargaBeliPerPack) || hargaBeliPerPack <= 0) {
      toast.error("Harga Beli harus berupa angka lebih dari 0");
      return;
    }
    if (isNaN(biayaPengiriman) || biayaPengiriman < 0) {
      toast.error("Biaya Pengiriman tidak boleh negatif");
      return;
    }
    if (isNaN(uangMuka) || uangMuka < 0) {
      toast.error("Uang Muka tidak boleh negatif");
      return;
    }
    if (!form.targetHargaJual || isNaN(targetHargaJual) || targetHargaJual <= 0) {
      toast.error("Target Harga Jual harus lebih dari 0");
      return;
    }

    const totalBall = jumlahKarton * conv.ballsPerKarton;
    const totalSlop = jumlahKarton * conv.slopsPerKarton;
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
    if (!checkWritePermission("membuat PO baru")) return;
    if (!result) {
      toast.error("Silakan hitung HPP terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      // 1. Simpan data pembelian (Atomik: update Stok, Product, Summary, dan Finance Ledger otomatis)
      const packsPerSlop = selectedProduct?.packsPerSlop || 10;
      const slopsPerKarton = ((selectedProduct?.slopsPerBall || 20) * (selectedProduct?.ballsPerKarton || 5)) + (selectedProduct?.ekstraSlopPerKarton || 0);
      const totalPacksPurchased = result.jumlahKarton * slopsPerKarton * packsPerSlop;

      await addPurchaseAtomic({
        productId: selectedProductId,
        productName: result.productName,
        jumlahKarton: result.jumlahKarton,
        totalBall: result.totalBall,
        totalSlop: result.totalSlop,
        totalPack: result.totalPack,
        totalPackPurchased: totalPacksPurchased, // Required by addPurchaseAtomic
        hargaBeliPerPack: result.hargaBeliPerPack,
        targetHargaJual: result.targetHargaJual,
        biayaPengiriman: result.biayaPengiriman,
        uangMuka: result.uangMuka,
        hpp: result.hpp,
        totalFaktur: result.totalFaktur,
        sisaHutang: result.sisaHutang,
        conversion: result.conversion,
        status: "pengiriman",
      });

      toast.success("PO berhasil disimpan secara atomik!");

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
    if (!checkWritePermission("menambah produk baru")) return;
    const { name, packsPerSlop, slopsPerBall, ballsPerKarton } = newProduct;
    if (!name.trim()) return toast.error("Nama produk wajib diisi");
    if (!packsPerSlop || !slopsPerBall || !ballsPerKarton)
      return toast.error("Semua konversi satuan wajib diisi");

    setSavingProduct(true);
    let finalImageUrl = newProduct.imageUrl.trim();

    // LOGIKA UPLOAD KE FIREBASE STORAGE
    if (imageFile) {
      toast.loading("Mengunggah foto...", { id: "uploadToast" });
      try {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(snapshot.ref);
        toast.dismiss("uploadToast");
      } catch (err) {
        toast.dismiss("uploadToast");
        setSavingProduct(false);
        return toast.error("Gagal mengunggah foto: " + err.message);
      }
    }

    try {
      await addProduct({
        name: name.trim(),
        packsPerSlop: parseInt(packsPerSlop),
        slopsPerBall: parseInt(slopsPerBall),
        ballsPerKarton: parseInt(ballsPerKarton),
        ekstraSlopPerKarton: parseInt(newProduct.ekstraSlopPerKarton) || 0,
        imageUrl: finalImageUrl,
      });
      toast.success(`Produk "${name.trim()}" berhasil ditambahkan!`);
      setNewProduct({
        name: "",
        packsPerSlop: "",
        slopsPerBall: "",
        ballsPerKarton: "",
        ekstraSlopPerKarton: 0,
        imageUrl: "",
      });
      setImageFile(null);
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
            type="text"
            name="jumlahKarton"
            value={formatInputNumber(form.jumlahKarton)}
            onChange={handleChange}
            placeholder="0"
            className="input-field"
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
            type="text"
            name="hargaBeliPerPack"
            value={formatInputNumber(form.hargaBeliPerPack)}
            onChange={handleChange}
            placeholder="0"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Target Harga Jual per Pack (Rp)
          </label>
          <input
            type="text"
            name="targetHargaJual"
            value={formatInputNumber(form.targetHargaJual)}
            onChange={handleChange}
            placeholder="0"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Biaya Pengiriman (Rp)
          </label>
          <input
            type="text"
            name="biayaPengiriman"
            value={formatInputNumber(form.biayaPengiriman)}
            onChange={handleChange}
            placeholder="0"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Uang Muka / DP (Rp)
          </label>
          <input
            type="text"
            name="uangMuka"
            value={formatInputNumber(form.uangMuka)}
            onChange={handleChange}
            placeholder="0"
            className="input-field"
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

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Foto Produk (Opsional)
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setImageFile(e.target.files[0])} 
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <div>
                  <label className="block text-xs font-medium text-amber-500 mb-1.5">
                    Eks. Slop/Ktn
                  </label>
                  <input
                    type="number"
                    value={newProduct.ekstraSlopPerKarton}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        ekstraSlopPerKarton: e.target.value,
                      })
                    }
                    placeholder="0"
                    className="input-field border-amber-500/30 focus:border-amber-500 text-amber-400"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-dark-800 border border-slate-700/50">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Preview Konversi</p>
                <p className="text-xs text-white leading-relaxed">
                  1 Karton = {(parseInt(newProduct.ballsPerKarton) || 0)} Ball 
                  {parseInt(newProduct.ekstraSlopPerKarton) > 0 && ` + ${newProduct.ekstraSlopPerKarton} Slop (Ekstra)`}
                  {" "}= <span className="text-emerald-400 font-bold">
                    {((parseInt(newProduct.slopsPerBall) || 0) * (parseInt(newProduct.ballsPerKarton) || 0)) + (parseInt(newProduct.ekstraSlopPerKarton) || 0)} Slop
                  </span>
                  {" "}= <span className="text-emerald-400 font-bold">
                    {(((parseInt(newProduct.slopsPerBall) || 0) * (parseInt(newProduct.ballsPerKarton) || 0)) + (parseInt(newProduct.ekstraSlopPerKarton) || 0)) * (parseInt(newProduct.packsPerSlop) || 0)} Pack
                  </span>
                </p>
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
                    if (!checkWritePermission("menghapus produk")) return;
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
