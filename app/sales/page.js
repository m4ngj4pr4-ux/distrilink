"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSisaStokSales, getSalesStockBreakdown } from '@/lib/firestore';

export default function SalesDashboard() {
  const [user, setUser] = useState(null);
  const [stokBawaan, setStokBawaan] = useState(0);
  const [stockBreakdown, setStockBreakdown] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      const fetchStok = async () => {
        const stok = await getSisaStokSales(parsedUser.id);
        setStokBawaan(stok);
      };
      fetchStok();
    }
  }, []);

  const handleOpenBreakdown = async () => {
    setIsModalOpen(true);
    if (stockBreakdown.length === 0) {
      setIsLoadingBreakdown(true);
      const breakdown = await getSalesStockBreakdown(user.id);
      setStockBreakdown(breakdown);
      setIsLoadingBreakdown(false);
    }
  };

  if (!user) return <div className="p-4 text-center text-slate-500 text-xs mt-10">Memuat profil...</div>;

  return (
    <div className="p-4 animate-fadeIn pb-20">
      <header className="mb-6 mt-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Halo, {user.name}! 👋</h1>
          <p className="text-xs text-slate-400 mt-1">Siap mendistribusikan barang hari ini?</p>
        </div>
        <img 
          src="/icon.png" 
          alt="Logo" 
          className="w-12 h-12 rounded-xl shadow-lg border border-slate-700/50 object-cover" 
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </header>
      
      {/* Stok Widget - Now Clickable */}
      <div 
        onClick={handleOpenBreakdown}
        className="bg-dark-800 border border-slate-700 rounded-2xl p-5 mb-4 shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-all"
      >
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-800/50 p-2 rounded-full border border-slate-700">
          <span className="text-emerald-500 text-xl">ℹ️</span>
        </div>
        
        <h2 className="text-xs font-medium text-slate-400 mb-1 relative z-10">Total Stok Bawaan Anda</h2>
        <div className="flex items-baseline gap-1 relative z-10">
          <div className="text-4xl font-black text-emerald-400">{stokBawaan}</div>
          <div className="text-sm font-medium text-slate-500">Pack</div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button 
          onClick={() => router.push('/sales/transaksi')}
          className="bg-blue-600 hover:bg-blue-500 transition-colors p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95"
        >
          <span className="text-2xl">📦</span>
          <span className="text-xs font-bold text-white">Rute & Drop</span>
        </button>
        <button 
          onClick={() => router.push('/sales/profil')}
          className="bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95"
        >
          <span className="text-2xl">📝</span>
          <span className="text-xs font-bold text-slate-300">Setoran</span>
        </button>
      </div>

      {/* Stock Breakdown Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-6 border-t border-slate-700 animate-slideIn flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-lg font-bold text-white">Rincian Barang Bawaan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold text-2xl px-2 hover:text-white">&times;</button>
            </div>
            
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4 shrink-0">
              * Total stok yang ditugaskan oleh Admin
            </p>

            <div className="overflow-y-auto custom-scrollbar pr-1 flex-1">
              {isLoadingBreakdown ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-500">Memuat rincian...</p>
                </div>
              ) : stockBreakdown.length > 0 ? (
                <div className="flex flex-col gap-3 pb-6">
                  {stockBreakdown.map((item, idx) => (
                    <div key={idx} className="bg-dark-800 border border-slate-700/50 p-3 rounded-xl flex items-center gap-4">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-14 h-14 object-cover rounded-lg bg-slate-800" />
                      ) : (
                        <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-2xl border border-slate-700">
                          🚬
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-sm text-white">{item.productName}</h3>
                        {item.brand && (
                          <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-widest mt-0.5">{item.brand}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white">{item.totalAssigned}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Pack</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 opacity-50">
                  <span className="text-5xl mb-4 block">📦</span>
                  <p className="text-xs text-slate-500">Belum ada barang yang didistribusikan ke Anda.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
