"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HiOutlineSearch, HiOutlineLocationMarker, HiOutlinePlus, HiOutlinePhone, HiOutlineUser, HiOutlineTrash, HiOutlinePencilAlt, HiOutlineChartPie } from "react-icons/hi";
import { subscribeRetailStores, addRetailStore, deleteRetailStore, updateRetailStore } from "@/lib/firestore";
import SupplyChainRadar from "@/components/SupplyChainRadar";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

// Import Map with SSR disabled
const RetailMap = dynamic(() => import("./RetailMap"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-dark-800 animate-pulse flex items-center justify-center text-slate-500">
      Memuat Peta...
    </div>
  )
});

export default function RetailMarketing() {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState("");
  const [mapCenter, setMapCenter] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [tempCoords, setTempCoords] = useState(null);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [activeTab, setActiveTab] = useState("map"); // "map" or "radar"
  const { checkWritePermission } = usePermissions();
  
  // Form State
  const [newStore, setNewStore] = useState({
    namaToko: "",
    alamat: "",
    coordinates: ""
  });

  useEffect(() => {
    const unsub = subscribeRetailStores(setStores);
    return () => unsub();
  }, []);

  const filteredStores = stores.filter(s => 
    s.namaToko?.toLowerCase().includes(search.toLowerCase()) ||
    s.alamat?.toLowerCase().includes(search.toLowerCase())
  );

  const handleMapClick = (latlng) => {
    if (showAddForm) {
      const coordsString = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
      setNewStore(prev => ({
        ...prev,
        coordinates: coordsString
      }));
      setTempCoords(latlng);
      toast.success("Koordinat ditangkap!", { id: "map-click", duration: 1000 });
    }
  };

  async function handleAddStore(e) {
    e.preventDefault();
    if (!checkWritePermission(editingStoreId ? "mengedit toko" : "menambah toko retail")) return;
    
    // Parse Koordinat (Lat, Lng) — opsional
    let lat = null;
    let lng = null;
    if (newStore.coordinates && newStore.coordinates.trim()) {
      const parts = newStore.coordinates.split(",");
      if (parts.length === 2) {
        const parsedLat = parseFloat(parts[0].trim());
        const parsedLng = parseFloat(parts[1].trim());
        if (!isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
          lat = parsedLat;
          lng = parsedLng;
        }
      }
    }

    const storeData = {
      namaToko: newStore.namaToko,
      alamat: newStore.alamat,
      latitude: lat,
      longitude: lng
    };

    try {
      if (editingStoreId) {
        await updateRetailStore(editingStoreId, storeData);
        toast.success("Toko berhasil diperbarui");
      } else {
        await addRetailStore(storeData);
        toast.success("Toko berhasil didaftarkan");
      }
      
      setNewStore({ namaToko: "", alamat: "", coordinates: "" });
      setTempCoords(null);
      setShowAddForm(false);
      setEditingStoreId(null);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  }

  function handleEdit(store) {
    const hasCoords = store.latitude != null && store.longitude != null;
    setNewStore({
      namaToko: store.namaToko,
      alamat: store.alamat,
      coordinates: hasCoords ? `${store.latitude}, ${store.longitude}` : ""
    });
    setEditingStoreId(store.id);
    if (hasCoords) {
      setTempCoords({ lat: parseFloat(store.latitude), lng: parseFloat(store.longitude) });
      setMapCenter([parseFloat(store.latitude), parseFloat(store.longitude)]);
    } else {
      setTempCoords(null);
    }
    setShowAddForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("Hapus toko ini dari database?")) return;
    await deleteRetailStore(id);
    toast.success("Toko dihapus");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-dark-800 p-1 rounded-xl w-full sm:w-fit border border-slate-700 shadow-xl">
        <button 
          onClick={() => setActiveTab("map")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "map" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
        >
          <HiOutlineLocationMarker size={16} />
          <span>Peta Lokasi</span>
        </button>
        <button 
          onClick={() => setActiveTab("radar")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "radar" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"}`}
        >
          <HiOutlineChartPie size={16} />
          <span>Supply Chain</span>
        </button>
      </div>

      {activeTab === "map" ? (
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-230px)] gap-6 animate-fadeIn">
          {/* Sidebar List */}
          <div className="w-full lg:w-96 flex flex-col gap-4 h-[350px] lg:h-full shrink-0">
        <div className="glass-card p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white flex items-center gap-2">
              <HiOutlineLocationMarker className="text-blue-400" />
              Titik Retail
              <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20 ml-1.5 font-black">
                {stores.length}
              </span>
            </h2>
            <button 
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  setTempCoords(null);
                  setEditingStoreId(null);
                  setNewStore({ namaToko: "", alamat: "", coordinates: "" });
                }
              }}
              className={`p-1.5 rounded-lg transition-colors ${showAddForm ? "bg-rose-500/10 text-rose-400" : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"}`}
            >
              {showAddForm ? <HiOutlinePlus className="rotate-45" size={18} /> : <HiOutlinePlus size={18} />}
            </button>
          </div>

          {/* ... (Search input and list remain same) ... */}
          <div className="relative mb-4">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Cari toko atau wilayah..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredStores.map((store) => (
              <div 
                key={store.id}
                onClick={() => {
                  if (store.latitude != null && store.longitude != null) {
                    setMapCenter([parseFloat(store.latitude), parseFloat(store.longitude)]);
                  } else {
                    toast("Toko ini belum memiliki koordinat GPS.", { icon: '📍' });
                  }
                }}
                className="p-3 rounded-xl bg-dark-700/50 border border-slate-400/5 hover:border-blue-500/30 cursor-pointer group transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{store.namaToko}</h4>
                  <div className="flex gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEdit(store); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-emerald-400 transition-all"
                    >
                      <HiOutlinePencilAlt size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(store.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all"
                    >
                      <HiOutlineTrash size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{store.alamat}</p>
                <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-black uppercase">
                  📋 Pembina: {store.diinputOleh || "Admin"}
                </span>
              </div>
            ))}
            {filteredStores.length === 0 && (
              <div className="text-center py-10 text-slate-500 italic text-sm">Toko tidak ditemukan.</div>
            )}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="h-[450px] lg:h-full lg:flex-1 relative border border-slate-400/5 rounded-2xl overflow-hidden shadow-2xl">
        <RetailMap 
          stores={stores} 
          center={mapCenter} 
          onMarkerClick={(s) => {
            if (s.latitude != null && s.longitude != null) {
              setMapCenter([parseFloat(s.latitude), parseFloat(s.longitude)]);
            }
          }}
          onMapClick={handleMapClick}
          tempMarker={tempCoords}
        />

        {/* Floating Add Form */}
        {showAddForm && (
          <div className="absolute top-4 right-4 z-[1000] w-[90%] sm:w-80 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 glass-card p-5 border-t-4 border-blue-500 shadow-2xl animate-slideIn">
            <h3 className="font-bold text-white mb-1 flex items-center justify-between">
              {editingStoreId ? "Edit Toko" : "Registrasi Toko Baru"}
            </h3>
            <p className="text-[10px] text-amber-500 mb-4 font-medium animate-pulse">
              📍 Klik lokasi pada peta untuk mengisi koordinat otomatis
            </p>
            <form onSubmit={handleAddStore} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Nama Toko / Warung</label>
                <input 
                  type="text" placeholder="Contoh: Toko Berkah" required
                  value={newStore.namaToko} onChange={e => setNewStore({...newStore, namaToko: e.target.value})}
                  className="input-field text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Alamat Lengkap</label>
                <textarea 
                  placeholder="Nama jalan, RT/RW, Patokan..." required
                  value={newStore.alamat} onChange={e => setNewStore({...newStore, alamat: e.target.value})}
                  className="input-field text-xs h-20 resize-none custom-scrollbar" 
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Titik Koordinat (Lat, Lng)</label>
                <input 
                  type="text" placeholder="-7.9666, 112.6326"
                  value={newStore.coordinates} 
                  onChange={e => {
                    const val = e.target.value;
                    setNewStore({...newStore, coordinates: val});
                    
                    // Update temp marker if format is correct
                    const parts = val.split(",");
                    if (parts.length === 2) {
                      const lat = parseFloat(parts[0].trim());
                      const lng = parseFloat(parts[1].trim());
                      if (!isNaN(lat) && !isNaN(lng)) setTempCoords({ lat, lng });
                    }
                  }}
                  className="input-field text-xs" 
                />
                <p className="text-[9px] text-slate-500 italic px-1">
                  Klik pada peta untuk otomatis, atau paste dari Google Maps.
                </p>
              </div>
              <button type="submit" className="btn-primary w-full py-3 text-xs mt-2 font-black uppercase tracking-widest">
                {editingStoreId ? "Simpan Perubahan" : "Simpan Toko"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
    ) : (
      <SupplyChainRadar />
    )}
  </div>
  );
}
