import { HiOutlineExclamationCircle, HiOutlineCube, HiOutlineUserGroup, HiOutlineShieldCheck, HiOutlineClipboardList, HiOutlineCash } from 'react-icons/hi';
import { getSisaStokSales, getSalesStockBreakdown, getTeamPendingSetoran } from '@/lib/firestore';
import { formatRupiah } from '@/lib/utils';

export default function SalesDashboard() {
  const [user, setUser] = useState(null);
  const [stokBawaan, setStokBawaan] = useState(0);
  const [stockBreakdown, setStockBreakdown] = useState([]);
  const [pendingVerifCount, setPendingVerifCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      const fetchData = async () => {
        try {
          const [stok, breakdown, pending] = await Promise.all([
            getSisaStokSales(parsedUser.id),
            getSalesStockBreakdown(parsedUser.id),
            parsedUser.role === 'captain' ? getTeamPendingSetoran() : Promise.resolve([])
          ]);
          
          setStokBawaan(stok);
          setStockBreakdown(breakdown);
          if (parsedUser.role === 'captain') {
            setPendingVerifCount(pending.length);
          }
        } catch (error) {
          console.error("Gagal memuat data dashboard:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }
  }, []);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-5 animate-fadeIn pb-24 max-w-lg mx-auto">
      {/* Header Profile */}
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-white tracking-tight">Halo, {user.name.split(' ')[0]}!</h1>
            {user.role === 'captain' && (
              <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-amber-500/30">Captain</span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {user.role === 'captain' ? 'Kelola tim & distribusi hari ini' : 'Pantau stok & mulai rute penjualan'}
          </p>
        </div>
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-dark-800 border-2 border-emerald-500/20 overflow-hidden shadow-xl shadow-emerald-900/10">
            <img src="/icon.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-dark-900"></div>
        </div>
      </header>
      
      {/* Quick Summary Card */}
      <div className="relative group mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[2rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
        <div className="relative bg-dark-800 border border-slate-700/50 rounded-[2rem] p-6 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <HiOutlineCube className="text-emerald-400" size={24} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Stok Bawaan Anda</p>
              <h2 className="text-3xl font-black text-white tracking-tight">
                {stokBawaan.toLocaleString('id-ID')} <span className="text-xs text-slate-400 font-bold uppercase ml-1">Pack</span>
              </h2>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-dark-900/50 rounded-2xl p-3 border border-slate-700/30">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Item Berbeda</p>
              <p className="text-sm font-black text-slate-200">{stockBreakdown.length} Produk</p>
            </div>
            <div className="bg-dark-900/50 rounded-2xl p-3 border border-slate-700/30">
              <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Status Sesi</p>
              <p className="text-sm font-black text-emerald-400">Aktif & Live</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Monitor Stok Terkini Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            <h3 className="font-black text-white text-sm uppercase tracking-wider">Monitor Stok Terkini</h3>
          </div>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black uppercase animate-pulse">Live</span>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-dark-800/50 border border-slate-700/50 rounded-2xl animate-pulse"></div>
            ))
          ) : stockBreakdown.length > 0 ? (
            stockBreakdown.map((item, idx) => {
              const fullBals = Math.floor(item.currentStock / 100);
              const remainingSlops = Math.floor((item.currentStock % 100) / 10);
              const remainingPacks = item.currentStock % 10;
              const isLow = item.currentStock < 20;

              return (
                <div key={idx} className={`glass-card p-4 flex items-center gap-4 border transition-all ${isLow ? 'border-rose-500/20 bg-rose-500/5' : 'border-slate-700/50 bg-dark-800/40'}`}>
                  <div className="w-16 h-16 rounded-2xl bg-dark-900 border border-slate-700 flex items-center justify-center shrink-0 relative overflow-hidden group">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <span className="text-2xl opacity-30">📦</span>
                    )}
                    {isLow && <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-bl-lg animate-pulse"></div>}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="font-black text-sm text-white truncate">{item.productName}</h4>
                      <span className="text-[10px] font-black text-emerald-400 font-mono">{formatRupiah(item.pricePerPack || 0)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${isLow ? 'bg-rose-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {isLow ? 'Hampir Habis' : 'Stok Ready'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold">{item.brand}</span>
                    </div>

                    <div className="flex items-end justify-between">
                      <div className="flex gap-2">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Bal</span>
                          <span className="text-sm font-black text-white">{fullBals}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Slop</span>
                          <span className="text-sm font-black text-white">{remainingSlops}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">Pack</span>
                          <span className="text-sm font-black text-emerald-400">{remainingPacks}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Total Sisa</p>
                        <p className="text-base font-black text-white leading-none">{item.currentStock}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-dark-800/30 rounded-3xl border border-dashed border-slate-700">
              <span className="text-4xl mb-3 block opacity-20">📦</span>
              <p className="text-xs text-slate-500 font-medium">Belum ada stok yang didistribusikan ke Anda.</p>
            </div>
          )}
        </div>
      </section>

      {/* Main Actions Grid */}
      <section className="space-y-4">
        <h3 className="font-black text-white text-xs uppercase tracking-widest px-1">Menu Utama</h3>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/sales/transaksi')}
            className="group relative h-32 bg-blue-600 rounded-[2rem] overflow-hidden shadow-xl shadow-blue-900/20 active:scale-[0.97] transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
              <HiOutlineClipboardList size={60} />
            </div>
            <div className="absolute inset-0 p-6 flex flex-col justify-end items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <HiOutlineClipboardList className="text-white" size={20} />
              </div>
              <p className="text-[10px] text-blue-100 uppercase font-black tracking-widest leading-none mb-1">Operasional</p>
              <h4 className="text-sm font-black text-white leading-none uppercase">Rute & Drop</h4>
            </div>
          </button>

          <button 
            onClick={() => router.push('/sales/profil')}
            className="group relative h-32 bg-slate-800 border border-slate-700 rounded-[2rem] overflow-hidden shadow-xl active:scale-[0.97] transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform">
              <HiOutlineCash size={60} />
            </div>
            <div className="absolute inset-0 p-6 flex flex-col justify-end items-start text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3 border border-emerald-500/20">
                <HiOutlineCash className="text-emerald-400" size={20} />
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none mb-1">Keuangan</p>
              <h4 className="text-sm font-black text-white leading-none uppercase">Setoran Saya</h4>
            </div>
          </button>
        </div>

        {/* Captain Special Actions */}
        {user.role === 'captain' && (
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => router.push('/sales/distribusi')}
              className="group relative h-32 bg-amber-600 rounded-[2rem] overflow-hidden shadow-xl shadow-amber-900/20 active:scale-[0.97] transition-all"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                <HiOutlineUserGroup size={60} />
              </div>
              <div className="absolute inset-0 p-6 flex flex-col justify-end items-start text-left">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <HiOutlineUserGroup className="text-white" size={20} />
                </div>
                <p className="text-[10px] text-amber-100 uppercase font-black tracking-widest leading-none mb-1">Manajemen</p>
                <h4 className="text-sm font-black text-white leading-none uppercase">Distribusi Tim</h4>
              </div>
            </button>

            <button 
              onClick={() => router.push('/sales/verifikasi')}
              className="group relative h-32 bg-purple-600 rounded-[2rem] overflow-hidden shadow-xl shadow-purple-900/20 active:scale-[0.97] transition-all"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                <HiOutlineShieldCheck size={60} />
              </div>
              {pendingVerifCount > 0 && (
                <div className="absolute top-4 right-4 bg-rose-500 text-[10px] font-black text-white px-2 py-0.5 rounded-full border border-white/20 shadow-lg animate-bounce">
                  {pendingVerifCount} Antrean
                </div>
              )}
              <div className="absolute inset-0 p-6 flex flex-col justify-end items-start text-left">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <HiOutlineShieldCheck className="text-white" size={20} />
                </div>
                <p className="text-[10px] text-purple-100 uppercase font-black tracking-widest leading-none mb-1">Verifikasi</p>
                <h4 className="text-sm font-black text-white leading-none uppercase">Cek Setoran</h4>
              </div>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
