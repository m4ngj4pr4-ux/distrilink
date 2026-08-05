"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamPendingSetoran, acceptCashDeposit, captainDepositToAdmin } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function CaptainVerifikasiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("terima"); // terima, setor
  const [pendingList, setPendingList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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

  const handleAcceptCash = async (item) => {
    if (!confirm(`Terima uang tunai Rp ${item.nominal?.toLocaleString('id-ID')} dari ${item.teamName || item.namaSales || "Sales"}?`)) return;
    setProcessingId(item.id);
    try {
      await acceptCashDeposit(item.id);
      toast.success("Uang tunai diterima!");
      await loadData();
    } catch (error) {
      toast.error("Gagal menerima uang.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkSetor = async (items) => {
    const total = items.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
    if (!confirm(`Setor total kas Rp ${total.toLocaleString('id-ID')} ke Pusat? Status semua setoran ini akan berubah menjadi 'Menunggu Verifikasi Admin'.`)) return;
    
    setIsBulkProcessing(true);
    try {
      const ids = items.map(i => i.id);
      await captainDepositToAdmin(ids);
      toast.success("Setoran kas berhasil dilaporkan ke Admin!");
      await loadData();
    } catch (error) {
      toast.error("Gagal mengirim setoran.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const filteredList = pendingList.filter(item => {
    if (activeTab === "terima") return item.status === "Menunggu Diterima Captain";
    if (activeTab === "setor") return item.status === "Kas di Captain";
    return false;
  });

  const totalKasDiCaptain = pendingList
    .filter(i => i.status === "Kas di Captain")
    .reduce((acc, curr) => acc + (curr.nominal || 0), 0);

  if (!user) return null;

  return (
    <div className="p-4 pb-20">
      <header className="mb-5 mt-2">
        <button onClick={() => router.back()} className="text-xs text-slate-500 mb-2 hover:text-white transition-colors">← Kembali</button>
        <h1 className="text-xl font-bold text-white tracking-tight">✅ Pengelolaan Setoran</h1>
        <p className="text-xs text-slate-400 mt-1">Kelola aliran uang tunai & transfer dari tim Sales</p>
      </header>

      {/* Tabs */}
      <div className="flex bg-dark-800 p-1 rounded-xl mb-6 border border-slate-700">
        <button onClick={() => setActiveTab("terima")} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === "terima" ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'}`}>
          Terima Tunai
        </button>
        <button onClick={() => setActiveTab("setor")} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all relative ${activeTab === "setor" ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'}`}>
          Setor Kas
          {totalKasDiCaptain > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat data setoran...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === "setor" && filteredList.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-2">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">Total Kas di Tangan Anda</p>
              <div className="flex justify-between items-end">
                <p className="text-2xl font-black text-white">Rp {totalKasDiCaptain.toLocaleString('id-ID')}</p>
                <button 
                  onClick={() => handleBulkSetor(filteredList)}
                  disabled={isBulkProcessing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {isBulkProcessing ? "Memproses..." : "🚀 Setor ke Pusat"}
                </button>
              </div>
            </div>
          )}

          {filteredList.length > 0 ? (
            filteredList.map(item => (
              <div key={item.id} className="bg-dark-800 border border-slate-700 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">{item.namaSales || item.teamName}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {item.waktu ? new Date(item.waktu.toDate()).toLocaleString('id-ID', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                      }) : 'Baru saja'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-400">Rp {item.nominal?.toLocaleString('id-ID')}</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter ${
                      item.metode === "Tunai ke Captain" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-400"
                    }`}>
                      {item.metode || "Transfer"}
                    </span>
                  </div>
                </div>
                
                {item.catatan && (
                  <p className="text-[10px] text-slate-500 bg-dark-900/50 rounded-lg p-2 mb-3 italic">
                    💬 {item.catatan}
                  </p>
                )}

                {activeTab === "terima" && (
                  <button 
                    onClick={() => handleAcceptCash(item)}
                    disabled={processingId === item.id}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold active:scale-[0.98] transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50"
                  >
                    🤝 Terima Uang Fisik
                  </button>
                )}


                {activeTab === "setor" && (
                  <div className="text-[10px] text-center text-slate-500 font-medium py-1">
                    ✅ Uang Fisik Sudah Diterima
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-20 opacity-40">
              <span className="text-5xl mb-4 block">✨</span>
              <p className="text-sm text-slate-500 font-medium">Tidak ada data di tab ini</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
