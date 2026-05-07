"use client";
import { useEffect, useState } from 'react';
import { 
  getGroupedStoreInventory, getSalesCarriedBrands, 
  addDropTransaction, updateStoreShelfStock, getSisaStokSales 
} from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function TransaksiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [groupedStores, setGroupedStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sisaStok, setSisaStok] = useState(0);

  // Drop (Restock) Modal State
  const [restockStore, setRestockStore] = useState(null);
  const [carriedBrands, setCarriedBrands] = useState({});
  const [selectedBrand, setSelectedBrand] = useState("");
  const [jumlahDrop, setJumlahDrop] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audit Modal State
  const [auditItem, setAuditItem] = useState(null);
  const [auditQty, setAuditQty] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    loadData(parsedUser.id);
  }, [router]);

  const loadData = async (teamId) => {
    setIsLoading(true);
    const [stores, stok] = await Promise.all([
      getGroupedStoreInventory(teamId),
      getSisaStokSales(teamId)
    ]);
    setGroupedStores(stores);
    setSisaStok(stok);
    setIsLoading(false);
  };

  // ── RESTOCK (DROP) HANDLER ──
  const handleOpenRestock = async (store) => {
    setRestockStore(store);
    setSelectedBrand("");
    setJumlahDrop("");
    const brands = await getSalesCarriedBrands(user.id);
    setCarriedBrands(brands);
  };

  const handleDropSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(jumlahDrop);
    if (!selectedBrand) return toast.error("Pilih merek barang!");
    if (!qty || qty <= 0) return toast.error("Masukkan jumlah yang valid!");
    
    const brandData = carriedBrands[selectedBrand];
    if (!brandData) return toast.error("Merek tidak ditemukan!");
    if (qty > brandData.sisa) return toast.error(`Stok ${selectedBrand} Anda hanya ${brandData.sisa} Pk!`);

    setIsSubmitting(true);
    try {
      await addDropTransaction({
        teamId: user.id,
        namaSales: user.name,
        storeId: restockStore.storeId,
        namaToko: restockStore.namaToko,
        productId: brandData.productId,
        productName: selectedBrand,
        jumlahDrop: qty,
        catatan: "Via Aplikasi Sales"
      });
      
      toast.success(`Drop ${qty} Pk ${selectedBrand} ke ${restockStore.namaToko} berhasil!`);
      setRestockStore(null);
      await loadData(user.id);
    } catch (error) {
      toast.error("Gagal menyimpan data.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── AUDIT HANDLER ──
  const handleOpenAudit = (store, prod) => {
    setAuditItem({ storeId: store.storeId, namaToko: store.namaToko, ...prod });
    setAuditQty(prod.currentStock?.toString() || "0");
  };

  const handleAuditSubmit = async () => {
    const newStock = parseInt(auditQty);
    if (isNaN(newStock) || newStock < 0) return toast.error("Masukkan angka valid!");
    
    setIsSubmitting(true);
    try {
      await updateStoreShelfStock(auditItem.storeId, auditItem.productName, newStock, user.name);
      toast.success(`Stok ${auditItem.productName} di ${auditItem.namaToko} → ${newStock} Pk`);
      setAuditItem(null);
      await loadData(user.id);
    } catch (error) {
      toast.error("Gagal memperbarui stok.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-5 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">📊 Rute & Stok Toko</h1>
        <p className="text-xs text-slate-400 mt-1">
          Stok Bawaan Anda: <span className="text-emerald-400 font-bold">{sisaStok} Pack</span>
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat data toko...</p>
        </div>
      ) : groupedStores.length > 0 ? (
        <div className="flex flex-col gap-4">
          {groupedStores.map(store => (
            <div key={store.storeId} className="bg-dark-800 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
              {/* Store Header */}
              <div className="flex justify-between items-center p-4 pb-3 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center text-lg">🏪</div>
                  <div>
                    <h3 className="font-bold text-emerald-400 text-sm">{store.namaToko}</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Total drop: {Math.abs(store.totalDropped)} Pk</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleOpenRestock(store)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg active:scale-95 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-1"
                >
                  📦 <span>Isi Ulang</span>
                </button>
              </div>

              {/* Product List */}
              <div className="p-3">
                {store.products.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {store.products.map((prod, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-dark-900/60 p-3 rounded-xl border border-slate-700/30">
                        <div className="flex-1 pr-2">
                          <p className="text-xs font-bold text-white">{prod.productName}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            Drop: {Math.abs(prod.totalDropped)} Pk
                            {prod.lastAuditBy && <span className="text-amber-500"> · Audit: {prod.lastAuditBy}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Sisa Rak</p>
                            <p className="text-base font-black text-amber-400">{prod.currentStock}</p>
                          </div>
                          <button 
                            onClick={() => handleOpenAudit(store, prod)}
                            className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 active:scale-90 transition-all"
                            title="Update Sisa"
                          >
                            <span className="text-[10px]">🔄</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic text-center py-2">Belum ada data produk.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 opacity-50">
          <span className="text-5xl mb-4 block">📦</span>
          <p className="text-sm text-slate-500 font-medium">Belum ada aktivitas drop.</p>
          <p className="text-[10px] text-slate-600 mt-1">Mulai drop barang ke toko dari menu "Daftar Toko".</p>
        </div>
      )}

      {/* ── MODAL RESTOCK (DROP) ── */}
      {restockStore && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-blue-500 animate-slideIn max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">📦 Drop Barang</h2>
                <p className="text-[10px] text-slate-400">ke: <span className="text-emerald-400 font-bold">{restockStore.namaToko}</span></p>
              </div>
              <button onClick={() => setRestockStore(null)} className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors">&times;</button>
            </div>

            <form onSubmit={handleDropSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="mb-4">
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Pilih Merek Barang</label>
                <select 
                  value={selectedBrand} 
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  required
                >
                  <option value="">-- Pilih Merek yang Anda Bawa --</option>
                  {Object.keys(carriedBrands).map(brand => (
                    <option key={brand} value={brand}>{brand} (Tersisa: {carriedBrands[brand].sisa} Pk)</option>
                  ))}
                </select>
                {Object.keys(carriedBrands).length === 0 && (
                  <p className="text-[9px] text-rose-400 mt-1 italic">Anda belum memiliki stok bawaan. Hubungi admin.</p>
                )}
              </div>
              <div className="mb-5">
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Jumlah Drop (Pack)</label>
                <input 
                  type="number" inputMode="numeric"
                  value={jumlahDrop}
                  onChange={(e) => setJumlahDrop(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-4 text-2xl font-black text-blue-400 focus:border-blue-500 outline-none text-center shadow-inner"
                  placeholder="0"
                  required
                />
                {selectedBrand && carriedBrands[selectedBrand] && (
                  <p className="text-[9px] text-slate-500 text-center mt-1">Maks: {carriedBrands[selectedBrand].sisa} Pk</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRestockStore(null)} className="flex-1 py-3.5 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50">
                  {isSubmitting ? "Menyimpan..." : "Konfirmasi Drop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AUDIT STOK ── */}
      {auditItem && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-amber-500 animate-slideIn">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">🔄 Audit Stok</h2>
                <p className="text-[10px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{auditItem.productName}</span> di {auditItem.namaToko}
                </p>
              </div>
              <button onClick={() => setAuditItem(null)} className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors">&times;</button>
            </div>

            <div className="bg-dark-800 rounded-xl p-4 mb-5 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Stok Tercatat Sekarang</p>
              <p className="text-3xl font-black text-slate-500">{auditItem.currentStock} <span className="text-sm font-medium">Pk</span></p>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-medium text-slate-400 mb-2 text-center uppercase tracking-wider">Stok Fisik di Rak (Hasil Hitung)</label>
              <input 
                type="number" inputMode="numeric"
                value={auditQty}
                onChange={(e) => setAuditQty(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-4 text-3xl font-black text-amber-400 focus:border-amber-500 outline-none text-center shadow-inner"
                placeholder="0"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAuditItem(null)} className="flex-1 py-3.5 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all">
                Batal
              </button>
              <button onClick={handleAuditSubmit} disabled={isSubmitting} className="flex-1 py-3.5 rounded-xl bg-amber-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50">
                {isSubmitting ? "Menyimpan..." : "Simpan Audit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
