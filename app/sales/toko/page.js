"use client";
import { useEffect, useState } from 'react';
import { 
  getRetailStoresList, addDropTransaction, getSisaStokSales, 
  addRetailStore, updateRetailStore, getSalesCarriedBrands,
  getStoreInventory, updateStoreShelfStock
} from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SalesTokoPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const [sisaStok, setSisaStok] = useState(0);
  
  // Store Detail Modal State
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeInventory, setStoreInventory] = useState([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  
  // Drop Modal State
  const [showDropForm, setShowDropForm] = useState(false);
  const [carriedBrands, setCarriedBrands] = useState({});
  const [selectedBrand, setSelectedBrand] = useState("");
  const [jumlahDrop, setJumlahDrop] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audit State
  const [auditItem, setAuditItem] = useState(null);
  const [auditQty, setAuditQty] = useState("");

  // Add/Edit Store State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [newToko, setNewToko] = useState({ namaToko: "", alamat: "", latitude: "", longitude: "" });
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    
    // Fetch Stores and Stock
    getRetailStoresList().then(setStores);
    getSisaStokSales(parsedUser.id).then(setSisaStok);
  }, [router]);

  const filteredStores = stores.filter(store => 
    store.namaToko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.alamat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── STORE DETAIL HANDLER ──
  const handleOpenStore = async (store) => {
    setSelectedStore(store);
    setShowDropForm(false);
    setIsLoadingInventory(true);
    
    const [inv, brands] = await Promise.all([
      getStoreInventory(store.id),
      user ? getSalesCarriedBrands(user.id) : {}
    ]);
    
    setStoreInventory(inv);
    setCarriedBrands(brands);
    setIsLoadingInventory(false);
  };

  // ── DROP HANDLER (MULTI-BRAND) ──
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
        storeId: selectedStore.id,
        namaToko: selectedStore.namaToko,
        productId: brandData.productId,
        productName: selectedBrand,
        jumlahDrop: qty,
        catatan: "Via Aplikasi Sales"
      });
      
      toast.success(`Drop ${qty} Pk ${selectedBrand} berhasil!`);
      setJumlahDrop("");
      setSelectedBrand("");
      setShowDropForm(false);
      
      // Refresh data
      const [updatedStok, inv, brands] = await Promise.all([
        getSisaStokSales(user.id),
        getStoreInventory(selectedStore.id),
        getSalesCarriedBrands(user.id)
      ]);
      setSisaStok(updatedStok);
      setStoreInventory(inv);
      setCarriedBrands(brands);
    } catch (error) {
      toast.error("Gagal menyimpan data.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── AUDIT HANDLER ──
  const handleAuditSubmit = async () => {
    const newStock = parseInt(auditQty);
    if (isNaN(newStock) || newStock < 0) return toast.error("Masukkan angka yang valid!");
    
    setIsSubmitting(true);
    try {
      await updateStoreShelfStock(
        selectedStore.id, 
        auditItem.productName, 
        newStock, 
        user.name
      );
      toast.success(`Stok ${auditItem.productName} diperbarui → ${newStock} Pk`);
      setAuditItem(null);
      setAuditQty("");
      
      // Refresh
      const inv = await getStoreInventory(selectedStore.id);
      setStoreInventory(inv);
    } catch (error) {
      toast.error("Gagal memperbarui stok.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── GPS & STORE CRUD ──
  const handleGetLocation = (e) => {
    e.preventDefault();
    if (!navigator.geolocation) return toast.error("Browser tidak mendukung GPS.");
    
    setIsLocating(true);
    toast.loading("Mengunci lokasi...", { id: 'gps' });
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewToko(prev => ({ 
          ...prev, 
          latitude: position.coords.latitude, 
          longitude: position.coords.longitude 
        }));
        setIsLocating(false);
        toast.success("Lokasi berhasil dikunci!", { id: 'gps' });
      },
      (error) => {
        setIsLocating(false);
        toast.error("Gagal mengambil lokasi. Pastikan GPS aktif.", { id: 'gps' });
      }
    );
  };

  const handleAddTokoSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const storeData = {
        namaToko: newToko.namaToko,
        alamat: newToko.alamat,
        latitude: parseFloat(newToko.latitude) || 0,
        longitude: parseFloat(newToko.longitude) || 0,
        diinputOleh: user.name,
        teamId: user.id
      };

      if (editingStoreId) {
        await updateRetailStore(editingStoreId, storeData);
        toast.success("Data toko berhasil diperbarui!");
      } else {
        await addRetailStore(storeData);
        toast.success("Toko baru berhasil didaftarkan!");
      }
      
      setIsAddModalOpen(false);
      setEditingStoreId(null);
      setNewToko({ namaToko: "", alamat: "", latitude: "", longitude: "" });
      
      const updatedStores = await getRetailStoresList();
      setStores(updatedStores);
    } catch (error) {
      toast.error("Gagal memproses data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditToko = (e, store) => {
    e.stopPropagation();
    setNewToko({
      namaToko: store.namaToko,
      alamat: store.alamat,
      latitude: store.latitude,
      longitude: store.longitude
    });
    setEditingStoreId(store.id);
    setIsAddModalOpen(true);
  };

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-4 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">Daftar Toko</h1>
        <p className="text-xs text-slate-400 mt-1">Sisa Stok Anda: <span className="text-emerald-400 font-bold">{sisaStok} Pack</span></p>
      </header>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="🔍 Cari nama atau wilayah..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-sm text-slate-200 focus:border-emerald-500 outline-none shadow-inner"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</div>
        </div>
        <button 
          onClick={() => { setEditingStoreId(null); setNewToko({ namaToko: "", alamat: "", latitude: "", longitude: "" }); setIsAddModalOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-1 active:scale-95 shrink-0"
        >
          <span className="text-lg leading-none">+</span> <span className="text-sm">Baru</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {filteredStores.map(store => (
          <div key={store.id} className="bg-dark-800 border border-slate-700 p-4 rounded-xl active:bg-dark-700 transition-all cursor-pointer flex justify-between items-center shadow-sm active:scale-[0.98]">
            <div className="flex-1 overflow-hidden pr-2" onClick={() => handleOpenStore(store)}>
              <h3 className="font-bold text-sm text-emerald-400 truncate">{store.namaToko}</h3>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{store.alamat}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => handleEditToko(e, store)}
                className="p-2 bg-slate-700/50 rounded-lg border border-slate-600 active:scale-90 transition-all text-xs"
              >
                ✏️
              </button>
              <button 
                onClick={() => handleOpenStore(store)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl text-[11px] active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
              >
                📦 Detail
              </button>
            </div>
          </div>
        ))}
        {filteredStores.length === 0 && <p className="text-center text-xs text-slate-500 mt-6 italic">Toko tidak ditemukan.</p>}
      </div>

      {/* ── MODAL DETAIL TOKO + INVENTORI ── */}
      {selectedStore && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl border-t border-slate-700 animate-slideIn max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 pb-0 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedStore.namaToko}</h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">{selectedStore.alamat}</p>
                </div>
                <button onClick={() => { setSelectedStore(null); setShowDropForm(false); setAuditItem(null); }} className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors">&times;</button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
              
              {/* Inventori Rak Toko */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">📊 Stok di Rak Toko</p>
                </div>
                
                {isLoadingInventory ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                  </div>
                ) : storeInventory.length > 0 ? (
                  <div className="space-y-2">
                    {storeInventory.map((item, idx) => (
                      <div key={idx} className="bg-dark-800 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">{item.productName}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            {item.lastDropBy ? `Drop terakhir oleh ${item.lastDropBy}` : ""}
                            {item.lastAuditBy ? ` · Audit: ${item.lastAuditBy}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-lg font-black text-emerald-400">{item.currentStock}</p>
                            <p className="text-[8px] text-slate-500 uppercase font-bold">Pack</p>
                          </div>
                          <button 
                            onClick={() => { setAuditItem(item); setAuditQty(item.currentStock?.toString() || "0"); }}
                            className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 active:scale-90 transition-all"
                            title="Update Sisa"
                          >
                            <span className="text-xs">🔄</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-dark-800 rounded-xl border border-dashed border-slate-700">
                    <p className="text-xs text-slate-500 italic">Belum ada riwayat drop ke toko ini.</p>
                  </div>
                )}
              </div>

              {/* Audit Inline Modal */}
              {auditItem && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4 animate-fadeIn">
                  <p className="text-xs font-bold text-amber-400 mb-3">🔄 Audit Stok: {auditItem.productName}</p>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="number" inputMode="numeric"
                      value={auditQty}
                      onChange={(e) => setAuditQty(e.target.value)}
                      className="flex-1 bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-xl font-black text-amber-400 focus:border-amber-500 outline-none text-center"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500 font-bold">Pk</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setAuditItem(null); setAuditQty(""); }} className="flex-1 py-2.5 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all">
                      Batal
                    </button>
                    <button onClick={handleAuditSubmit} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg disabled:opacity-50">
                      {isSubmitting ? "Menyimpan..." : "Simpan Audit"}
                    </button>
                  </div>
                </div>
              )}

              {/* Drop Form (Multi-Brand) */}
              {showDropForm ? (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-4 animate-fadeIn">
                  <p className="text-xs font-bold text-blue-400 mb-3">📦 Tambah Stok ke Toko</p>
                  <form onSubmit={handleDropSubmit}>
                    <div className="mb-3">
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
                    <div className="mb-4">
                      <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Jumlah Drop (Pack)</label>
                      <input 
                        type="number" inputMode="numeric"
                        value={jumlahDrop}
                        onChange={(e) => setJumlahDrop(e.target.value)}
                        className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-xl font-black text-blue-400 focus:border-blue-500 outline-none text-center"
                        placeholder="0"
                        required
                      />
                      {selectedBrand && carriedBrands[selectedBrand] && (
                        <p className="text-[9px] text-slate-500 text-center mt-1">
                          Maks: {carriedBrands[selectedBrand].sisa} Pk
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowDropForm(false)} className="flex-1 py-3 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all">
                        Batal
                      </button>
                      <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50">
                        {isSubmitting ? "Menyimpan..." : "Konfirmasi Drop"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button 
                  onClick={() => setShowDropForm(true)}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-900/50 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>📦</span> Drop Barang ke Toko Ini
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ADD/EDIT TOKO ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[110] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-slate-700 animate-slideIn max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">{editingStoreId ? "Edit Detail Toko" : "Daftar Toko Baru"}</h2>
                <p className="text-[10px] text-slate-400">{editingStoreId ? "Perbarui informasi warung/toko" : "Tambahkan lokasi warung/toko baru"}</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handleAddTokoSubmit} className="overflow-y-auto custom-scrollbar pr-1 pb-4">
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Toko / Warung</label>
                <input 
                  type="text" required
                  value={newToko.namaToko}
                  onChange={(e) => setNewToko({...newToko, namaToko: e.target.value})}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="Contoh: Warung Barokah"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Alamat Lengkap</label>
                <textarea required
                  value={newToko.alamat}
                  onChange={(e) => setNewToko({...newToko, alamat: e.target.value})}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none h-20 resize-none custom-scrollbar"
                  placeholder="Nama jalan, RT/RW, Patokan..."
                ></textarea>
              </div>
              
              {/* Koordinat GPS */}
              <div className="mb-6 bg-dark-800 p-3 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <span>📡</span> Titik Koordinat
                  </label>
                  <button 
                    onClick={handleGetLocation} type="button"
                    className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1.5 rounded font-bold hover:bg-blue-500/20 active:scale-95 transition-all flex items-center gap-1"
                  >
                    {isLocating ? 'Mencari...' : '📍 Ambil GPS Saya'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" readOnly value={newToko.latitude} placeholder="Latitude"
                    className="w-1/2 bg-dark-900 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400 outline-none opacity-70"
                  />
                  <input 
                    type="text" readOnly value={newToko.longitude} placeholder="Longitude"
                    className="w-1/2 bg-dark-900 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400 outline-none opacity-70"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isSubmitting ? 'Menyimpan...' : (editingStoreId ? 'Simpan Perubahan' : 'Simpan Toko & Lanjut')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
