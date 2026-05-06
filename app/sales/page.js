"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStokBawaanSales } from '@/lib/firestore';

export default function SalesDashboard() {
  const [user, setUser] = useState(null);
  const [stokBawaan, setStokBawaan] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      const fetchStok = async () => {
        const stok = await getStokBawaanSales(parsedUser.id);
        setStokBawaan(stok);
      };
      fetchStok();
    }
  }, []);

  if (!user) return <div className="p-4 text-center text-slate-500 text-xs mt-10">Memuat profil...</div>;

  return (
    <div className="p-4 animate-fadeIn">
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Halo, {user.name}! 👋</h1>
        <p className="text-xs text-slate-400 mt-1">Siap mendistribusikan barang hari ini?</p>
      </header>
      
      {/* Stok Widget */}
      <div className="bg-dark-800 border border-slate-700 rounded-2xl p-5 mb-4 shadow-lg relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
        
        <h2 className="text-xs font-medium text-slate-400 mb-1 relative z-10">Total Stok Bawaan Anda</h2>
        <div className="flex items-baseline gap-1 relative z-10">
          <div className="text-4xl font-black text-emerald-400">{stokBawaan}</div>
          <div className="text-sm font-medium text-slate-500">Pack</div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button 
          onClick={() => router.push('/sales/toko')}
          className="bg-blue-600 hover:bg-blue-500 transition-colors p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95"
        >
          <span className="text-2xl">🗺️</span>
          <span className="text-xs font-bold text-white">Drop ke Toko</span>
        </button>
        <button className="bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95">
          <span className="text-2xl">📝</span>
          <span className="text-xs font-bold text-slate-300">Setoran</span>
        </button>
      </div>
    </div>
  );
}
