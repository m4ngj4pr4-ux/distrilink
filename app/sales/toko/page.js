"use client";
import { useEffect, useState } from 'react';
import { getRetailStoresList, addRetailStore, updateRetailStore } from '@/lib/firestore';
import { getCurrentLocation, getGPSStatusMessage } from '@/lib/geolocation';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { HiOutlineMap, HiOutlineViewList, HiOutlineSearch, HiOutlinePlus, HiOutlineLocationMarker } from 'react-icons/hi';

const RetailMap = dynamic(() => import("@/components/RetailMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-dark-800 animate-pulse flex items-center justify-center text-slate-500 rounded-2xl border border-slate-700">
      Memuat Peta...
    </div>
  )
});

export default function SalesTokoPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState("saya"); // "saya" or "semua"
  const [viewTab, setViewTab] = useState("list"); // "list" or "map"
  const [mapCenter, setMapCenter] = useState(null);
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add/Edit Store State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [formData, setFormData] = useState({ namaToko: "", alamat: "", koordinat: "" });
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState(null); // null | 'loading' | 'ok' | 'failed'

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    setUser(JSON.parse(storedUser));
    getRetailStoresList().then(setStores);
  }, [router]);

  const myStoresCount = stores.filter(s => s.diinputOleh === user?.name).length;

  const displayedStores = stores.filter(store => {
    const matchesSearch = 
      store.namaToko?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.alamat?.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterTab === "saya") {
      return matchesSearch && store.diinputOleh === user?.name;
    }
    return matchesSearch;
  });

  const handleFocusOnMap = (store) => {
    if (store.latitude && store.longitude) {
      setMapCenter([parseFloat(store.latitude), parseFloat(store.longitude)]);
      setViewTab("map");
    } else {
      toast.error("Toko ini belum memiliki koordinat GPS.");
    }
  };

  // ── Auto-Fetch GPS saat modal baru dibuka (hanya untuk tambah, bukan edit) ──
  useEffect(() => {
    if (isModalOpen && !editingStoreId) {
      fetchGPS(true);
    }
  }, [isModalOpen, editingStoreId]);

  const fetchGPS = async (isAutoFetch = false) => {
    setIsLocating(true);
    setGpsStatus('loading');
    if (!isAutoFetch) toast.loading("Mengunci lokasi...", { id: 'gps' });

    const loc = await getCurrentLocation(10000);

    if (loc.status === 'OK') {
      setFormData(prev => ({ ...prev, koordinat: `${loc.latitude}, ${loc.longitude}` }));
      setGpsStatus('ok');
      if (isAutoFetch) {
        toast.success("Lokasi otomatis berhasil dikunci!", { id: 'gps-auto' });
      } else {
        toast.success(getGPSStatusMessage(loc.status), { id: 'gps' });
      }
    } else {
      setGpsStatus('failed');
      if (!isAutoFetch) {
        if (loc.status === 'GPS_DENIED') {
          toast.error(getGPSStatusMessage(loc.status), { id: 'gps' });
        } else {
          toast(getGPSStatusMessage(loc.status), { id: 'gps', icon: '⚠️' });
        }
      }
    }
    setIsLocating(false);
  };

  const handleGetLocation = async (e) => {
    e.preventDefault();
    await fetchGPS(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Graceful: jika koordinat kosong, simpan null (bukan 0)
      let lat = null;
      let lng = null;
      if (formData.koordinat && formData.koordinat.trim()) {
        const koorArr = formData.koordinat.split(",");
        const parsedLat = parseFloat(koorArr[0]?.trim());
        const parsedLng = parseFloat(koorArr[1]?.trim());
        if (!isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
          lat = parsedLat;
          lng = parsedLng;
        }
      }

      const data = {
        namaToko: formData.namaToko,
        alamat: formData.alamat,
        latitude: lat,
        longitude: lng,
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
    setFormData({ namaToko: "", alamat: "", koordinat: "" });
    setGpsStatus(null);
    setIsModalOpen(true);
    // Auto-fetch GPS dipicu oleh useEffect di atas
  };

  const openEditModal = (e, store) => {
    e.stopPropagation();
    setEditingStoreId(store.id);
    setFormData({ 
      namaToko: store.namaToko, 
      alamat: store.alamat, 
      koordinat: (store.latitude && store.longitude) ? `${store.latitude}, ${store.longitude}` : "" 
    });
    setGpsStatus(store.latitude && store.longitude ? 'ok' : null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStoreId(null);
    setFormData({ namaToko: "", alamat: "", koordinat: "" });
    setGpsStatus(null);
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

      {/* View & Filter Toggles */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex bg-dark-800 p-1 rounded-xl border border-slate-700 shadow-lg">
          <button 
            onClick={() => setViewTab("list")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${viewTab === "list" ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            <HiOutlineViewList size={16} /> Daftar
          </button>
          <button 
            onClick={() => setViewTab("map")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${viewTab === "map" ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            <HiOutlineMap size={16} /> Peta
          </button>
        </div>

        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          <button 
            onClick={() => setFilterTab("saya")}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${filterTab === "saya" ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
          >
            Toko Saya ({myStoresCount})
          </button>
          <button 
            onClick={() => setFilterTab("semua")}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${filterTab === "semua" ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
          >
            Semua Toko ({stores.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex flex-col gap-6 animate-fadeIn ${viewTab === "map" ? "h-auto" : ""}`}>
        
        {/* Store List (Scrollable if in Map View) */}
        <div className={`${viewTab === "map" ? "h-[300px] overflow-y-auto pr-1 custom-scrollbar shrink-0" : "flex flex-col gap-3"}`}>
          {displayedStores.map(store => {
            const isMine = store.diinputOleh === user?.name;
            return (
              <div 
                key={store.id} 
                onClick={() => viewTab === "map" ? handleFocusOnMap(store) : null}
                className={`bg-dark-800 border p-4 rounded-xl flex justify-between items-center shadow-sm transition-all active:scale-[0.98] ${isMine ? 'border-slate-700' : 'border-slate-700/50'} ${viewTab === "map" ? 'cursor-pointer hover:border-blue-500/30' : ''}`}
              >
                <div className="flex-1 overflow-hidden pr-2">
                  <h3 className="font-bold text-sm text-emerald-400 truncate">{store.namaToko}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{store.alamat}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {!isMine && (
                      <span className="text-[8px] bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold">
                        Binaan: {store.diinputOleh || "Admin"}
                      </span>
                    )}
                    {store.latitude && (
                      <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-0.5">
                        <HiOutlineLocationMarker size={8} /> GPS Aktif
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {viewTab === "list" && (
                    <button 
                      onClick={() => handleFocusOnMap(store)}
                      className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20 active:scale-90 transition-all text-xs shrink-0"
                      title="Lihat di Peta"
                    >
                      <HiOutlineMap size={14} />
                    </button>
                  )}
                  {isMine && (
                    <button 
                      onClick={(e) => openEditModal(e, store)}
                      className="p-2.5 bg-slate-700/50 rounded-xl border border-slate-600 active:scale-90 transition-all text-xs shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {displayedStores.length === 0 && (
            <div className="text-center py-10 opacity-50">
              <span className="text-4xl mb-3 block">{filterTab === "saya" ? "📭" : "🏪"}</span>
              <p className="text-xs text-slate-500 italic">
                {filterTab === "saya" ? "Anda belum mendaftarkan toko." : "Toko tidak ditemukan."}
              </p>
            </div>
          )}
        </div>

        {/* Map View Area */}
        {viewTab === "map" && (
          <div className="h-[450px] relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700 animate-slideUp shrink-0">
            <RetailMap 
              stores={displayedStores} 
              center={mapCenter} 
              onMarkerClick={(s) => handleFocusOnMap(s)}
            />
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-slate-600 mt-6 pb-4 uppercase tracking-widest font-medium">
        Terdata {displayedStores.length} dari {stores.length} toko
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
              
              <div className={`mb-6 p-3 rounded-xl border transition-colors ${gpsStatus === 'ok' ? 'bg-emerald-500/5 border-emerald-500/30' : gpsStatus === 'failed' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-dark-800 border-slate-700'}`}>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    {gpsStatus === 'ok' ? '✅' : gpsStatus === 'loading' ? '🔄' : '📡'} Titik Koordinat
                    {gpsStatus === 'loading' && (
                      <span className="text-[9px] text-blue-400 animate-pulse font-bold">Mencari lokasi...</span>
                    )}
                  </label>
                  <button 
                    onClick={handleGetLocation} type="button" disabled={isLocating}
                    className={`text-[10px] px-2 py-1.5 rounded font-bold active:scale-95 transition-all border disabled:opacity-50 ${
                      gpsStatus === 'ok' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                    }`}
                  >
                    {isLocating ? '⏳ Mencari...' : gpsStatus === 'ok' ? '🔄 Perbarui GPS' : '📍 Ambil GPS Saya'}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <input type="text" 
                    value={formData.koordinat} 
                    onChange={(e) => setFormData({...formData, koordinat: e.target.value})}
                    placeholder="Otomatis atau paste: -3.154722, 114.573095"
                    className={`w-full bg-dark-900 rounded-lg px-3 py-2 text-xs outline-none transition-colors border ${
                      gpsStatus === 'ok' ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700/50 text-slate-200 focus:border-blue-500'
                    }`}
                  />
                  {gpsStatus === 'failed' && (
                    <p className="text-[9px] text-amber-400 px-1 flex items-center gap-1">
                      ⚠️ GPS gagal — toko tetap bisa disimpan tanpa lokasi peta.
                    </p>
                  )}
                  {gpsStatus !== 'failed' && (
                    <p className="text-[9px] text-slate-500 px-1">
                      {gpsStatus === 'ok' ? 'Koordinat berhasil dikunci.' : 'Otomatis dari GPS atau paste manual (Lat, Lng)'}
                    </p>
                  )}
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
