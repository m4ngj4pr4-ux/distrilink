"use client";
import { useEffect, useState } from 'react';
import { getRetailStoresList, addDropTransaction, getSisaStokSales } from '@/lib/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SalesTokoPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);
  const [sisaStok, setSisaStok] = useState(0);
  
  // Modal State
  const [selectedStore, setSelectedStore] = useState(null);
  const [jumlahDrop, setJumlahDrop] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleDropSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(jumlahDrop);
    
    if (!qty || qty <= 0) return toast.error("Masukkan jumlah yang valid!");
    if (qty > sisaStok) return toast.error("Stok bawaan tidak cukup!");

    setIsSubmitting(true);
    try {
      await addDropTransaction({
        teamId: user.id,
        namaSales: user.name,
        storeId: selectedStore.id,
        namaToko: selectedStore.namaToko,
        jumlahDrop: qty,
        catatan: "Via Aplikasi Sales"
      });
      
      toast.success("Drop barang berhasil dicatat!");
      setSelectedStore(null);
      setJumlahDrop("");
      
      // Refresh stock
      const updatedStok = await getSisaStokSales(user.id);
      setSisaStok(updatedStok);
    } catch (error) {
      toast.error("Gagal menyimpan data.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-4 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">Daftar Toko</h1>
        <p className="text-xs text-slate-400 mt-1">Sisa Stok Anda: <span className="text-emerald-400 font-bold">{sisaStok} Pack</span></p>
      </header>

      <div className="relative mb-4">
        <input 
          type="text" 
          placeholder="🔍 Cari nama toko atau wilayah..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-sm text-slate-200 focus:border-emerald-500 outline-none shadow-inner"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</div>
      </div>

      <div className="flex flex-col gap-3">
        {filteredStores.map(store => (
          <div key={store.id} onClick={() => setSelectedStore(store)} className="bg-dark-800 border border-slate-700 p-4 rounded-xl active:bg-dark-700 transition-all cursor-pointer flex justify-between items-center shadow-sm active:scale-[0.98]">
            <div>
              <h3 className="font-bold text-sm text-emerald-400">{store.namaToko}</h3>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{store.alamat}</p>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
              <span className="text-lg">📦</span>
            </div>
          </div>
        ))}
        {filteredStores.length === 0 && <p className="text-center text-xs text-slate-500 mt-6 italic">Toko tidak ditemukan.</p>}
      </div>

      {selectedStore && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-slate-700 animate-slideIn">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Drop Barang</h2>
              <button onClick={() => setSelectedStore(null)} className="text-slate-400 font-bold text-xl px-2 hover:text-white transition-colors">&times;</button>
            </div>
            
            <div className="bg-dark-800 rounded-xl p-4 mb-5 border border-slate-700/50 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 text-lg">🏪</div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Toko Tujuan</p>
                <p className="text-sm font-bold text-white mt-0.5">{selectedStore.namaToko}</p>
              </div>
            </div>

            <form onSubmit={handleDropSubmit}>
              <div className="mb-6">
                <label className="block text-xs font-medium text-slate-400 mb-2 text-center">Jumlah Drop (Pack)</label>
                <input 
                  type="number" 
                  inputMode="numeric"
                  value={jumlahDrop}
                  onChange={(e) => setJumlahDrop(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-4 text-3xl font-black text-emerald-400 focus:border-emerald-500 outline-none text-center shadow-inner"
                  placeholder="0"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Menyimpan...' : 'Konfirmasi Drop'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
