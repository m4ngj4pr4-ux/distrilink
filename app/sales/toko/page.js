"use client";
import { useEffect, useState } from 'react';
import { getRetailStoresList, addRetailStore, updateRetailStore } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SalesTokoPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add/Edit Store State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [formData, setFormData] = useState({ namaToko: "", alamat: "", latitude: "", longitude: "" });
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    setUser(JSON.parse(storedUser));
    getRetailStoresList().then(setStores);
  }, [router]);

  const filteredStores = stores.filter(store => 
    store.namaToko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.alamat?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGetLocation = (e) => {
    e.preventDefault();
    if (!navigator.geolocation) return toast.error("Browser tidak mendukung GPS.");
    setIsLocating(true);
    toast.loading("Mengunci lokasi...", { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setIsLocating(false);
        toast.success("Lokasi berhasil dikunci!", { id: 'gps' });
      },
      () => { setIsLocating(false); toast.error("Gagal mengambil lokasi.", { id: 'gps' }); }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = {
        namaToko: formData.namaToko,
        alamat: formData.alamat,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
        diinputOleh: user.name,
        teamId: user.id
      };
      if (editingStoreId) {
        await updateRetailStore(editingStoreId, data);
        toast.success("Data toko diperbarui!");
      } else {
        await addRetailStore(data);
        toast.success("Toko baru didaftarkan!");
      }
      closeModal();
      getRetailStoresList().then(setStores);
    } catch (error) {
      toast.error("Gagal memproses data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingStoreId(null);
    setFormData({ namaToko: "", alamat: "", latitude: "", longitude: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (e, store) => {
    e.stopPropagation();
    setEditingStoreId(store.id);
    setFormData({ namaToko: store.namaToko, alamat: store.alamat, latitude: store.latitude, longitude: store.longitude });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStoreId(null);
    setFormData({ namaToko: "", alamat: "", latitude: "", longitude: "" });
  };

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-4 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">📒 Direktori Toko</h1>
        <p className="text-xs text-slate-400 mt-1">Kelola daftar warung & toko retail Anda</p>
      </header>

      {/* Search + Add */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Cari nama atau wilayah..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-sm text-slate-200 focus:border-emerald-500 outline-none shadow-inner"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</div>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-1 active:scale-95 shrink-0"
        >
          <span className="text-lg leading-none">+</span> <span className="text-sm">Baru</span>
        </button>
      </div>

      {/* Store List */}
      <div className="flex flex-col gap-3">
        {filteredStores.map(store => (
          <div key={store.id} className="bg-dark-800 border border-slate-700 p-4 rounded-xl flex justify-between items-center shadow-sm">
            <div className="flex-1 overflow-hidden pr-2">
              <h3 className="font-bold text-sm text-emerald-400 truncate">{store.namaToko}</h3>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{store.alamat}</p>
              {store.diinputOleh && (
                <p className="text-[9px] text-slate-600 mt-0.5">Didaftarkan oleh: {store.diinputOleh}</p>
              )}
            </div>
            <button 
              onClick={(e) => openEditModal(e, store)}
              className="p-2.5 bg-slate-700/50 rounded-xl border border-slate-600 active:scale-90 transition-all text-xs shrink-0"
            >
              ✏️
            </button>
          </div>
        ))}
        {filteredStores.length === 0 && (
          <div className="text-center py-10 opacity-50">
            <span className="text-4xl mb-3 block">🏪</span>
            <p className="text-xs text-slate-500 italic">Toko tidak ditemukan.</p>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-slate-600 mt-6">
        Total: {stores.length} toko terdaftar
      </p>

      {/* ── MODAL ADD / EDIT TOKO ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[110] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-slate-700 animate-slideIn max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">{editingStoreId ? "Edit Detail Toko" : "Daftar Toko Baru"}</h2>
                <p className="text-[10px] text-slate-400">{editingStoreId ? "Perbarui informasi warung/toko" : "Tambahkan lokasi warung/toko baru"}</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar pr-1 pb-4 flex-1">
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Toko / Warung</label>
                <input 
                  type="text" required value={formData.namaToko}
                  onChange={(e) => setFormData({...formData, namaToko: e.target.value})}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="Contoh: Warung Barokah"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Alamat Lengkap</label>
                <textarea required value={formData.alamat}
                  onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none h-20 resize-none custom-scrollbar"
                  placeholder="Nama jalan, RT/RW, Patokan..."
                ></textarea>
              </div>
              
              <div className="mb-6 bg-dark-800 p-3 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1">📡 Titik Koordinat</label>
                  <button 
                    onClick={handleGetLocation} type="button"
                    className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1.5 rounded font-bold hover:bg-blue-500/20 active:scale-95 transition-all"
                  >
                    {isLocating ? 'Mencari...' : '📍 Ambil GPS Saya'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input type="text" readOnly value={formData.latitude} placeholder="Latitude"
                    className="w-1/2 bg-dark-900 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400 outline-none opacity-70" />
                  <input type="text" readOnly value={formData.longitude} placeholder="Longitude"
                    className="w-1/2 bg-dark-900 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400 outline-none opacity-70" />
                </div>
              </div>

              <button 
                type="submit" disabled={isSubmitting} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? 'Menyimpan...' : (editingStoreId ? 'Simpan Perubahan' : 'Simpan Toko')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
