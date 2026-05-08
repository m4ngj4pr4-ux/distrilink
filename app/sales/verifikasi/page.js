"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamPendingSetoran, captainVerifikasiSetoran } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function CaptainVerifikasiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [pendingList, setPendingList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'captain') {
      toast.error("Akses ditolak. Hanya Captain.");
      return router.push('/sales');
    }
    
    setUser(parsedUser);
    loadData();
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    const data = await getTeamPendingSetoran();
    setPendingList(data);
    setIsLoading(false);
  };

  const handleVerifikasi = async (item) => {
    if (!confirm(`Verifikasi setoran Rp ${item.nominal?.toLocaleString('id-ID')} dari ${item.namaSales}?`)) return;
    
    setVerifyingId(item.id);
    try {
      await captainVerifikasiSetoran(item.id, item.teamId, item.nominal);
      toast.success(`Setoran ${item.namaSales} berhasil diverifikasi!`);
      await loadData();
    } catch (error) {
      toast.error("Gagal memverifikasi.");
      console.error(error);
    } finally {
      setVerifyingId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-5 mt-2">
        <button onClick={() => router.back()} className="text-xs text-slate-500 mb-2 hover:text-white transition-colors">← Kembali</button>
        <h1 className="text-xl font-bold text-white tracking-tight">✅ Verifikasi Setoran Tim</h1>
        <p className="text-xs text-slate-400 mt-1">Setujui laporan setoran yang dikirim oleh anggota tim</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat data setoran...</p>
        </div>
      ) : pendingList.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 mb-1">
            <p className="text-[10px] text-purple-400 font-bold text-center">
              {pendingList.length} setoran menunggu verifikasi Anda
            </p>
          </div>

          {pendingList.map(item => (
            <div key={item.id} className="bg-dark-800 border border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-white text-sm">{item.namaSales}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {item.waktu ? new Date(item.waktu.toDate()).toLocaleString('id-ID', { 
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    }) : 'Baru saja'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-400">Rp {item.nominal?.toLocaleString('id-ID')}</p>
                  <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                    Menunggu
                  </span>
                </div>
              </div>
              
              {item.catatan && (
                <p className="text-[10px] text-slate-500 bg-dark-900/50 rounded-lg p-2 mb-3 italic">
                  💬 {item.catatan}
                </p>
              )}

              <button 
                onClick={() => handleVerifikasi(item)}
                disabled={verifyingId === item.id}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold active:scale-[0.98] transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifyingId === item.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Memverifikasi...
                  </>
                ) : (
                  "✅ Verifikasi & Setujui"
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 opacity-50">
          <span className="text-5xl mb-4 block">🎉</span>
          <p className="text-sm text-slate-500 font-medium">Semua bersih!</p>
          <p className="text-[10px] text-slate-600 mt-1">Tidak ada setoran yang perlu diverifikasi.</p>
        </div>
      )}
    </div>
  );
}
