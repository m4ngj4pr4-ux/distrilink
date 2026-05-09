"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addSetoranDana, getRiwayatSetoran, getSalesProfile } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  
  // Setoran States
  const [isSetorModalOpen, setIsSetorModalOpen] = useState(false);
  const [nominalSetor, setNominalSetor] = useState("");
  const [metodeSetor, setMetodeSetor] = useState("Transfer Bank");
  const [catatanSetor, setCatatanSetor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [riwayatSetoran, setRiwayatSetoran] = useState([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    
    // Fetch deposit history and latest profile data
    getRiwayatSetoran(parsedUser.id).then(setRiwayatSetoran);
    getSalesProfile(parsedUser.id).then(setProfileData);
  }, [router]);

  const handleLogout = () => {
    if(confirm("Yakin ingin keluar dari aplikasi?")) {
      localStorage.removeItem('sales_user');
      toast.success("Berhasil keluar");
      router.push('/sales/login');
    }
  };

  const handleSetorSubmit = async (e) => {
    e.preventDefault();
    const nominal = parseInt(nominalSetor.replace(/\D/g, ""));
    if (!nominal || nominal <= 0) return toast.error("Masukkan nominal yang valid");

    setIsSubmitting(true);
    try {
      await addSetoranDana(
        user.id,
        user.name,
        nominal,
        metodeSetor,
        catatanSetor
      );
      
      const msg = metodeSetor === "Tunai ke Captain" 
        ? "Laporan terkirim! Serahkan uang tunai ke Captain."
        : "Setoran berhasil dikirim ke Admin!";
      
      toast.success(msg);
      setIsSetorModalOpen(false);
      setNominalSetor("");
      setMetodeSetor("Transfer Bank");
      setCatatanSetor("");
      
      // Refresh history
      getRiwayatSetoran(user.id).then(setRiwayatSetoran);
    } catch (error) {
      toast.error("Gagal mengirim laporan setoran.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  const hutang = profileData ? (profileData.goodsDropped || 0) - (profileData.totalDeposited || 0) : 0;

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
        
        {profileData && (
          <div className="mt-6 pt-5 border-t border-slate-700/50 flex justify-between items-center relative z-10">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tagihan</p>
              <p className={`text-lg font-black ${hutang > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                Rp {hutang.toLocaleString('id-ID')}
              </p>
            </div>
            {hutang <= 0 && (
              <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
                <span className="text-xl">✅</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Menu Setoran */}
      <div className="bg-dark-800 border border-slate-700 p-6 rounded-2xl mb-8 relative shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 text-lg">💰</div>
          <h3 className="text-sm font-bold text-white">Menu Setoran</h3>
        </div>
        
        <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
          Gunakan fitur ini untuk melaporkan uang hasil penjualan yang telah Anda setor ke admin atau bank.
        </p>

        <button 
          onClick={() => setIsSetorModalOpen(true)}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-xs shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2"
        >
          Buat Laporan Setoran
        </button>

        {riwayatSetoran.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Riwayat Setoran Lengkap</p>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {riwayatSetoran.map(item => (
                <div key={item.id} className="flex justify-between items-start bg-dark-900/50 p-2.5 rounded-lg border border-slate-700/30">
                  <div>
                    <p className="text-[10px] text-slate-400">
                      {item.waktu ? new Date(item.waktu.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Baru saja'}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-0.5 truncate max-w-[120px]">{item.catatan}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-400">Rp {item.nominal?.toLocaleString('id-ID')}</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter mt-1 inline-block ${
                      item.status === "Diverifikasi Admin" || item.status === "Selesai (Sistem Lama)" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {item.status === "Diverifikasi Admin" || item.status === "Selesai (Sistem Lama)" ? "Selesai" : "Proses"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <button 
        onClick={handleLogout}
        className="w-full bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-500 border border-red-500/30 font-bold py-4 rounded-xl transition-all text-sm flex justify-center items-center gap-2 shadow-lg shadow-rose-950/10"
      >
        <span>🚪</span> Keluar Aplikasi (Logout)
      </button>

      {/* Setoran Modal */}
      {isSetorModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[100] pb-0 backdrop-blur-sm">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-6 border-t border-slate-700 animate-slideIn">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white">Lapor Setoran</h2>
              <button onClick={() => setIsSetorModalOpen(false)} className="text-slate-400 font-bold text-2xl px-2 hover:text-white">&times;</button>
            </div>
            
            <form onSubmit={handleSetorSubmit}>
              <div className="mb-5">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Nominal Setoran (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={nominalSetor}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setNominalSetor(val ? parseInt(val).toLocaleString('id-ID') : "");
                    }}
                    className="w-full bg-dark-800 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-2xl font-black text-emerald-400 focus:border-emerald-500 outline-none shadow-inner"
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-5">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Metode Pembayaran</label>
                <select 
                  value={metodeSetor}
                  onChange={(e) => setMetodeSetor(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 outline-none h-[54px]"
                >
                  <option value="Transfer Bank">Transfer Bank (Langsung ke Pusat)</option>
                  <option value="Tunai ke Captain">Tunai ke Captain (Titip Fisik)</option>
                </select>
              </div>

              <div className="mb-8">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Catatan / Bukti (Opsional)</label>
                <input 
                  type="text" 
                  value={catatanSetor}
                  onChange={(e) => setCatatanSetor(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder={metodeSetor === "Transfer Bank" ? "Contoh: Transfer via BCA" : "Contoh: Serah terima di kantor"}
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-900/50 disabled:opacity-50"
              >
                {isSubmitting ? 'Mengirim...' : 'Konfirmasi Setoran'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">DistriLink v1.1.0</p>
      </div>
    </div>
  );
}
