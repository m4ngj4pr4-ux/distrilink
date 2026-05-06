"use client";
import { useEffect, useState } from 'react';
import { getSalesHistory } from '@/lib/firestore';
import { useRouter } from 'next/navigation';

export default function TransaksiPage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');

    const parsedUser = JSON.parse(storedUser);
    getSalesHistory(parsedUser.name).then(data => {
      setHistory(data);
      setIsLoading(false);
    });
  }, [router]);

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-6 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">Riwayat Drop</h1>
        <p className="text-xs text-slate-400 mt-1">Aktivitas distribusi barang Anda</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat riwayat...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map(item => (
            <div key={item.id} className="bg-dark-800 border border-slate-700 p-4 rounded-xl flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center text-lg">🏪</div>
                <div>
                  <h3 className="font-bold text-sm text-white">{item.namaToko}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {item.waktu ? new Date(item.waktu.toDate()).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                  </p>
                </div>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg font-black text-sm">
                -{item.jumlahDrop} <span className="text-[10px] font-medium">Pk</span>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div className="text-center py-20 opacity-50">
              <span className="text-5xl mb-4 block">📝</span>
              <p className="text-xs text-slate-500">Belum ada transaksi hari ini.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
