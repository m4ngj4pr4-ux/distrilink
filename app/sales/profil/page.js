"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    setUser(JSON.parse(storedUser));
  }, [router]);

  const handleLogout = () => {
    if(confirm("Yakin ingin keluar dari aplikasi?")) {
      localStorage.removeItem('sales_user');
      toast.success("Berhasil keluar");
      router.push('/sales/login');
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-6 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">Profil Sales</h1>
      </header>

      {/* Profile Card */}
      <div className="bg-dark-800 border border-slate-700 p-6 rounded-2xl mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg transform rotate-3">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 mt-1 border border-emerald-500/20 uppercase tracking-wider">
              ID: {user.id.slice(-6).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Setoran (Placeholder) */}
      <div className="bg-dark-800 border border-slate-700 p-6 rounded-2xl mb-8 relative shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 text-lg">💰</div>
          <h3 className="text-sm font-bold text-white">Menu Setoran</h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-6 leading-relaxed italic">
          Fitur rekapitulasi uang tunai dan bukti transfer ke Admin sedang dalam tahap pengembangan.
        </p>
        <button disabled className="w-full bg-slate-700 text-slate-500 font-bold py-3.5 rounded-xl transition-all text-xs opacity-50 cursor-not-allowed border border-slate-600">
          Buat Laporan Setoran
        </button>
      </div>

      {/* Logout Button */}
      <button 
        onClick={handleLogout}
        className="w-full bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-500 border border-rose-500/30 font-bold py-4 rounded-xl transition-all text-sm flex justify-center items-center gap-2 shadow-lg shadow-rose-950/10"
      >
        <span>🚪</span> Keluar Aplikasi (Logout)
      </button>

      <div className="mt-10 text-center">
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">DistriLink v1.0.0</p>
      </div>
    </div>
  );
}
