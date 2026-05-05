"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HiOutlineSearch, HiOutlineLocationMarker, HiOutlinePlus, HiOutlinePhone, HiOutlineUser, HiOutlineTrash } from "react-icons/hi";
import { subscribeRetailStores, addRetailStore, deleteRetailStore } from "@/lib/firestore";
import toast from "react-hot-toast";

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
  
  // Form State
  const [newStore, setNewStore] = useState({
    namaToko: "",
    pemilik: "",
    alamat: "",
    nomorHp: "",
    latitude: "",
    longitude: ""
  });

  useEffect(() => {
    const unsub = subscribeRetailStores(setStores);
    return () => unsub();
  }, []);

  const filteredStores = stores.filter(s => 
    s.namaToko?.toLowerCase().includes(search.toLowerCase()) ||
    s.pemilik?.toLowerCase().includes(search.toLowerCase()) ||
    s.alamat?.toLowerCase().includes(search.toLowerCase())
  );

  const handleMapClick = (latlng) => {
    if (showAddForm) {
      setNewStore(prev => ({
        ...prev,
        latitude: latlng.lat.toFixed(6),
        longitude: latlng.lng.toFixed(6)
      }));
      setTempCoords(latlng);
      toast.success("Koordinat ditangkap!", { id: "map-click", duration: 1000 });
    }
  };

  async function handleAddStore(e) {
    e.preventDefault();
    if (!newStore.latitude || !newStore.longitude) return toast.error("Klik peta untuk menentukan lokasi");

    try {
      await addRetailStore({
        namaToko: newStore.namaToko,
        pemilik: newStore.pemilik,
        alamat: newStore.alamat,
        nomorHp: newStore.nomorHp,
        latitude: newStore.latitude,
        longitude: newStore.longitude
      });
      toast.success("Toko berhasil didaftarkan");
      setNewStore({ namaToko: "", pemilik: "", alamat: "", nomorHp: "", latitude: "", longitude: "" });
      setTempCoords(null);
      setShowAddForm(false);
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus toko ini dari database?")) return;
    await deleteRetailStore(id);
    toast.success("Toko dihapus");
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-180px)] gap-6 animate-fadeIn">
      {/* Sidebar List */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        <div className="glass-card p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white flex items-center gap-2">
              <HiOutlineLocationMarker className="text-blue-400" />
              Titik Retail
            </h2>
            <button 
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) setTempCoords(null);
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
                onClick={() => setMapCenter([parseFloat(store.latitude), parseFloat(store.longitude)])}
                className="p-3 rounded-xl bg-dark-700/50 border border-slate-400/5 hover:border-blue-500/30 cursor-pointer group transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{store.namaToko}</h4>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(store.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all"
                  >
                    <HiOutlineTrash size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <HiOutlineUser size={12} className="text-slate-500" /> {store.pemilik}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{store.alamat}</p>
              </div>
            ))}
            {filteredStores.length === 0 && (
              <div className="text-center py-10 text-slate-500 italic text-sm">Toko tidak ditemukan.</div>
            )}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative min-h-[400px]">
        <RetailMap 
          stores={stores} 
          center={mapCenter} 
          onMarkerClick={(s) => setMapCenter([parseFloat(s.latitude), parseFloat(s.longitude)])}
          onMapClick={handleMapClick}
          tempMarker={tempCoords}
        />

        {/* Floating Add Form */}
        {showAddForm && (
          <div className="absolute top-4 right-4 z-[1000] w-80 glass-card p-5 border-t-4 border-blue-500 shadow-2xl animate-slideIn">
            <h3 className="font-bold text-white mb-1 flex items-center justify-between">
              Registrasi Toko Baru
            </h3>
            <p className="text-[10px] text-amber-500 mb-4 font-medium animate-pulse">
              📍 Klik lokasi pada peta untuk mengisi koordinat otomatis
            </p>
            <form onSubmit={handleAddStore} className="space-y-3">
              <input 
                type="text" placeholder="Nama Toko" required
                value={newStore.namaToko} onChange={e => setNewStore({...newStore, namaToko: e.target.value})}
                className="input-field text-xs" 
              />
              <input 
                type="text" placeholder="Nama Pemilik" required
                value={newStore.pemilik} onChange={e => setNewStore({...newStore, pemilik: e.target.value})}
                className="input-field text-xs" 
              />
              <input 
                type="text" placeholder="Alamat / Wilayah" required
                value={newStore.alamat} onChange={e => setNewStore({...newStore, alamat: e.target.value})}
                className="input-field text-xs" 
              />
              <input 
                type="text" placeholder="Nomor HP (WhatsApp)" required
                value={newStore.nomorHp} onChange={e => setNewStore({...newStore, nomorHp: e.target.value})}
                className="input-field text-xs" 
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" placeholder="Lat" readOnly
                  value={newStore.latitude}
                  className="input-field text-xs bg-dark-700/50 cursor-default" 
                />
                <input 
                  type="text" placeholder="Lng" readOnly
                  value={newStore.longitude}
                  className="input-field text-xs bg-dark-700/50 cursor-default" 
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2 text-xs">Simpan Toko</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
