"use client";
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HiOutlineExclamationCircle, 
  HiOutlineCube, 
  HiOutlineUserGroup, 
  HiOutlineShieldCheck, 
  HiOutlineClipboardList, 
  HiOutlineCash,
  HiOutlinePlus,
  HiOutlineReply,
  HiOutlineX,
  HiOutlineChevronRight,
  HiOutlineCalendar,
  HiOutlinePrinter,
  HiOutlineRefresh
} from 'react-icons/hi';
import { 
  getSisaStokSales, 
  getSalesStockBreakdown, 
  getTeamPendingSetoran, 
  getAgentPerformanceData,
  subscribeSalesTeams,
  subscribeProducts,
  subscribePurchases,
  subscribePendingSetoran,
  addGoodsDropTransaction,
  addReturnTransaction,
  addSetoranDana,
  getSalesLedgerBookData,
  acceptCashDeposit,
  captainDepositToAdmin
} from '@/lib/firestore';
import { formatRupiah, formatNumber, formatInputNumber, parseInputNumber } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SalesDashboard() {
  const [user, setUser] = useState(null);
  const [stokBawaan, setStokBawaan] = useState(0);
  const [stockBreakdown, setStockBreakdown] = useState([]);
  const [pendingVerifCount, setPendingVerifCount] = useState(0);
  const [agentPerformance, setAgentPerformance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      const fetchData = async () => {
        try {
          const [stok, breakdown, pending, performance] = await Promise.all([
            getSisaStokSales(parsedUser.id),
            getSalesStockBreakdown(parsedUser.id),
            parsedUser.role === 'captain' ? getTeamPendingSetoran() : Promise.resolve([]),
            getAgentPerformanceData(parsedUser.id, parsedUser.role)
          ]);
          
          setStokBawaan(stok);
          setStockBreakdown(breakdown);
          if (parsedUser.role === 'captain') {
            setPendingVerifCount(pending.length);
          }
          if (performance) {
            setAgentPerformance(performance);
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

  if (user && user.role === 'admin_gudang') {
    return <AdminGudangDashboard user={user} router={router} />;
  }

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
          <div className="w-14 h-14 rounded-2xl bg-dark-800 border-2 border-emerald-500/20 overflow-hidden shadow-xl shadow-emerald-900/10 flex items-center justify-center">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-black text-white">{user.name.charAt(0).toUpperCase()}</span>
            )}
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
      
      {/* Kinerja Saya Card */}
      {agentPerformance && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
              <h3 className="font-black text-white text-sm uppercase tracking-wider">Kinerja Saya</h3>
            </div>
            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-black uppercase">Statistik Poin</span>
          </div>

          <div className="bg-dark-800/60 border border-slate-700/50 rounded-3xl p-5 shadow-2xl relative overflow-hidden group">
            {user.role === 'captain' && <div className="absolute inset-0 bg-amber-500/5 rounded-3xl pointer-events-none"></div>}
            
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${user.role === 'captain' ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400 border border-amber-500/20" : "bg-gradient-to-br from-blue-500/20 to-emerald-500/10 text-blue-400 border border-blue-500/20"}`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{user.name}</p>
                <p className={`text-[10px] uppercase font-black tracking-wider ${user.role === 'captain' ? "text-amber-500" : "text-slate-500"}`}>
                  {user.role === 'captain' ? "⭐ Captain" : "Sales"}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4 relative z-10">
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-slate-500 font-black uppercase tracking-wider">Retail Performance</span>
                <span className="text-slate-400 font-bold">{agentPerformance.totalTerjual.toLocaleString("id-ID")} / {agentPerformance.bawaanNetto.toLocaleString("id-ID")} Pk</span>
              </div>
              <div className="w-full h-2.5 bg-dark-900 rounded-full overflow-hidden shadow-inner">
                <div className={`h-full rounded-full transition-all duration-1000 ease-out ${agentPerformance.pct >= 80 ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : agentPerformance.pct >= 40 ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]" : "bg-slate-600"}`}
                  style={{ width: `${Math.min(100, agentPerformance.pct)}%` }} />
              </div>
            </div>

            {/* Stats Breakdown (Responsive Grid Rows to prevent overlapping on high numbers) */}
            <div className="flex flex-col gap-2 relative z-10">
              {/* Row 1: Stock Flow Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-dark-900/60 rounded-xl p-2.5 border border-slate-800/50 flex flex-col justify-center min-w-0">
                  <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5 truncate">Bawaan</p>
                  <p className="text-sm font-black text-white truncate">{agentPerformance.bawaanNetto.toLocaleString("id-ID")}</p>
                </div>
                <div className="bg-dark-900/60 rounded-xl p-2.5 border border-slate-800/50 flex flex-col justify-center min-w-0">
                  <p className="text-[8px] text-emerald-500 uppercase font-black tracking-widest mb-0.5 truncate">Terjual</p>
                  <p className="text-sm font-black text-emerald-400 truncate">{agentPerformance.totalTerjual.toLocaleString("id-ID")}</p>
                </div>
                <div className="bg-dark-900/60 rounded-xl p-2.5 border border-slate-800/50 flex flex-col justify-center min-w-0">
                  <p className="text-[8px] text-amber-500 uppercase font-black tracking-widest mb-0.5 truncate">Sisa</p>
                  <p className={`text-sm font-black truncate ${agentPerformance.sisa > 0 ? "text-amber-400" : "text-slate-500"}`}>{agentPerformance.sisa.toLocaleString("id-ID")}</p>
                </div>
              </div>
              
              {/* Row 2: Engagement & Points Metrics */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-dark-900/60 rounded-xl p-2.5 border border-slate-800/50 flex flex-col justify-center min-w-0">
                  <p className="text-[8px] text-cyan-400 uppercase font-black tracking-widest mb-0.5 truncate">Toko Binaan</p>
                  <p className="text-sm font-black text-cyan-400 truncate">{agentPerformance.tokoBinaan} Toko</p>
                </div>
                <div className="bg-dark-900/60 rounded-xl p-2.5 ring-1 ring-blue-500/30 bg-blue-500/5 shadow-inner flex flex-col justify-center min-w-0">
                  <p className="text-[8px] text-blue-400 uppercase font-black tracking-widest mb-0.5 truncate">Total Poin</p>
                  <p className="text-sm font-black text-blue-400 truncate">{agentPerformance.activePoints.toLocaleString("id-ID")} Pts</p>
                </div>
              </div>
            </div>

            {/* Glowing Reward Celebration Banner */}
            {agentPerformance.unclaimedRewards > 0 && (
              <div className="mt-4 p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between animate-pulse relative z-10 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl filter drop-shadow-md">🎁</span>
                  <div>
                    <span className="text-[11px] font-black text-rose-400 block tracking-wide">
                      {agentPerformance.unclaimedRewards} Token Listrik Siap Diklaim!
                    </span>
                    <span className="text-[8px] text-rose-500/80 uppercase font-bold tracking-widest block mt-0.5">Tunjukkan ke Admin</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
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
                        {item.currentStock === 0 ? 'Habis' : isLow ? 'Hampir Habis' : 'Stok Ready'}
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

function AdminGudangDashboard({ user, router }) {
  const [salesTeams, setSalesTeams] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [pendingSetorans, setPendingSetorans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [activeLedgerSales, setActiveLedgerSales] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  const [dropSales, setDropSales] = useState(null);
  const [dropProduct, setDropProduct] = useState("");
  const [dropQty, setDropQty] = useState("");
  const [dropUnit, setDropUnit] = useState("Ct");
  const [dropPrice, setDropPrice] = useState("");
  const [dropPoId, setDropPoId] = useState("");
  const [isDropping, setIsDropping] = useState(false);

  const [returSales, setReturSales] = useState(null);
  const [returProduct, setReturProduct] = useState("");
  const [returQty, setReturQty] = useState("");
  const [returUnit, setReturUnit] = useState("Ct");
  const [returReason, setReturReason] = useState("Sisa Tarikan Sales");
  const [isReturing, setIsReturing] = useState(false);

  const [bayarSales, setBayarSales] = useState(null);
  const [bayarNominal, setBayarNominal] = useState("");
  const [bayarMetode, setBayarMetode] = useState("Tunai ke Admin Gudang");
  const [bayarCatatan, setBayarCatatan] = useState("");
  const [isBayaring, setIsBayaring] = useState(false);

  const [isBulkDepositing, setIsBulkDepositing] = useState(false);

  // Subscriptions
  useEffect(() => {
    setIsLoading(true);
    const unsubTeams = subscribeSalesTeams((data) => {
      // Exclude admin_gudang role from the sales list
      setSalesTeams(data.filter(t => t.role !== 'admin_gudang'));
      setIsLoading(false);
    });
    const unsubProducts = subscribeProducts(setProducts);
    const unsubPurchases = subscribePurchases(setPurchases);
    const unsubPendingSetorans = subscribePendingSetoran(setPendingSetorans);

    return () => {
      unsubTeams();
      unsubProducts();
      unsubPurchases();
      unsubPendingSetorans();
    };
  }, []);

  // Ledger fetcher
  useEffect(() => {
    if (!activeLedgerSales) {
      setLedgerData([]);
      return;
    }
    setIsLedgerLoading(true);
    getSalesLedgerBookData(activeLedgerSales.id)
      .then(data => {
        setLedgerData(data);
        setIsLedgerLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error("Gagal memuat buku besar");
        setIsLedgerLoading(false);
      });
  }, [activeLedgerSales]);

  // FIFO available batches calculation (identical to SalesLedger.js)
  const availableBatches = useMemo(() => {
    if (!purchases || !products) return [];
    let resultBatches = [];
    products.forEach(product => {
      const productPOs = purchases
        .filter(po => po.productId === product.id)
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        
      const totalPurchased = productPOs.reduce((sum, po) => sum + (po.totalPack || 0), 0);
      let remainingGlobalStock = totalPurchased - (product.adminDistributedPacks || 0);
      
      if (remainingGlobalStock <= 0) return;
      
      productPOs.forEach(po => {
        if (remainingGlobalStock <= 0) return;
        const poOriginalCapacity = po.totalPack || 0;
        const allocated = Math.min(remainingGlobalStock, poOriginalCapacity);
        if (allocated > 0) {
          resultBatches.push({
            ...po,
            realSisa: allocated
          });
          remainingGlobalStock -= allocated;
        }
      });
    });
    return resultBatches;
  }, [purchases, products]);

  // Drop amount auto-fill when selection/qty changes
  const computedDropAmount = useMemo(() => {
    if (!dropPoId || !dropQty || !dropPrice) return 0;
    const po = purchases.find(p => p.id === dropPoId);
    if (!po) return 0;
    const product = products.find(p => p.id === po.productId);
    if (!product) return 0;

    const qtyNum = parseFloat(dropQty) || 0;
    const priceNum = parseFloat(dropPrice.replace(/\D/g, "")) || 0;
    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerBall = product.slopsPerBall || 20;
    const ballsPerKarton = product.ballsPerKarton || 5;
    
    let totalPacks = 0;
    if (dropUnit === "Ct") {
      totalPacks = qtyNum * (ballsPerKarton * slopsPerBall * packsPerSlop);
    } else if (dropUnit === "Bal") {
      totalPacks = qtyNum * (slopsPerBall * packsPerSlop);
    } else if (dropUnit === "Slop") {
      totalPacks = qtyNum * packsPerSlop;
    } else {
      totalPacks = qtyNum;
    }
    return Math.round(totalPacks * priceNum);
  }, [dropPoId, dropQty, dropUnit, dropPrice, purchases, products]);

  // Drop stock handler
  const handleDropSubmit = async (e) => {
    e.preventDefault();
    if (!dropSales || !dropPoId || !dropQty || !dropPrice) return toast.error("Lengkapi form dropping!");
    
    const po = purchases.find(p => p.id === dropPoId);
    if (!po) return toast.error("PO tidak valid!");
    
    const product = products.find(p => p.id === po.productId);
    if (!product) return toast.error("Produk tidak ditemukan!");

    const rawQty = parseFloat(dropQty) || 0;
    const price = parseInt(dropPrice.replace(/\D/g, "")) || 0;

    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerBall = product.slopsPerBall || 20;
    const ballsPerKarton = product.ballsPerKarton || 5;
    const slopsPerKarton = slopsPerBall * ballsPerKarton;

    let totalPacks = 0;
    if (dropUnit === "Ct") {
      totalPacks = rawQty * slopsPerKarton * packsPerSlop;
    } else if (dropUnit === "Bal") {
      totalPacks = rawQty * slopsPerBall * packsPerSlop;
    } else if (dropUnit === "Slop") {
      totalPacks = rawQty * packsPerSlop;
    } else {
      totalPacks = rawQty;
    }
    totalPacks = Math.round(totalPacks);

    if (totalPacks <= 0) return toast.error("Jumlah tidak valid");
    if (price <= 0) return toast.error("Harga tidak valid");

    // Check warehouse stock
    const batch = availableBatches.find(b => b.id === dropPoId);
    if (!batch || totalPacks > batch.realSisa) {
      return toast.error(`Stok gudang tidak cukup! Sisa batch ini hanya ${batch?.realSisa || 0} Pk.`);
    }

    setIsDropping(true);
    try {
      await addGoodsDropTransaction({
        teamId: dropSales.id,
        teamName: dropSales.name,
        productId: po.productId,
        productName: po.productName,
        totalPacksDistributed: totalPacks,
        jumlahKarton: totalPacks / (slopsPerKarton * packsPerSlop),
        amount: totalPacks * price,
        unit: dropUnit,
        qtyOriginal: rawQty,
        pricePerPack: price,
        hppSnapshot: po.hpp || 0,
        poId: po.id,
        source: 'admin_gudang'
      });
      toast.success(`Berhasil dropping ${rawQty} ${dropUnit} ${product.name} ke ${dropSales.name}`);
      setDropSales(null);
      setDropProduct("");
      setDropQty("");
      setDropPrice("");
      setDropPoId("");
    } catch (err) {
      toast.error("Gagal dropping: " + err.message);
    } finally {
      setIsDropping(false);
    }
  };

  // Return handler
  const handleReturSubmit = async (e) => {
    e.preventDefault();
    if (!returSales || !returProduct || !returQty) return toast.error("Lengkapi data retur!");
    
    const product = products.find(p => p.id === returProduct);
    if (!product) return toast.error("Produk tidak ditemukan!");

    const qty = parseFloat(returQty) || 0;
    if (qty <= 0) return toast.error("Jumlah tidak valid");

    const packsPerSlop = product.packsPerSlop || 10;
    const slopsPerKarton = (product.slopsPerBall || 20) * (product.ballsPerKarton || 5);

    let totalPacksReturned = returUnit === "Ct" ? qty * slopsPerKarton * packsPerSlop : returUnit === "Bal" ? qty * 10 * packsPerSlop : qty * packsPerSlop;
    totalPacksReturned = Math.round(totalPacksReturned);
    const returnAmount = totalPacksReturned * (product.currentSellingPrice || 0);

    setIsReturing(true);
    try {
      await addReturnTransaction({
        teamId: returSales.id,
        teamName: returSales.name,
        productId: product.id,
        productName: product.name,
        qtyOriginal: qty,
        unit: returUnit,
        totalPacksReturned,
        returnAmount,
        reason: returReason || "Sisa Tarikan Sales",
        hppSnapshot: product.lastHPP || product.currentSellingPrice || 0
      });
      toast.success(`Berhasil retur ${qty} ${returUnit} ${product.name} dari ${returSales.name}`);
      setReturSales(null);
      setReturProduct("");
      setReturQty("");
      setReturReason("Sisa Tarikan Sales");
    } catch (err) {
      toast.error("Gagal retur: " + err.message);
    } finally {
      setIsReturing(false);
    }
  };

  // Payment handler
  const handleBayarSubmit = async (e) => {
    e.preventDefault();
    const nominal = parseInt(bayarNominal.replace(/\D/g, ""));
    if (!nominal || nominal <= 0) return toast.error("Masukkan nominal yang valid");

    setIsBayaring(true);
    try {
      await addSetoranDana(
        bayarSales.id,
        bayarSales.name,
        nominal,
        bayarMetode,
        bayarCatatan
      );
      toast.success(`Berhasil mencatat setoran Rp ${nominal.toLocaleString('id-ID')} untuk ${bayarSales.name}`);
      setBayarSales(null);
      setBayarNominal("");
      setBayarCatatan("");
    } catch (err) {
      toast.error("Gagal mencatat setoran");
    } finally {
      setIsBayaring(false);
    }
  };

  // Cash acceptance
  const handleAcceptCash = async (item) => {
    if (!confirm(`Terima uang tunai Rp ${item.nominal?.toLocaleString('id-ID')} dari ${item.namaSales}?`)) return;
    try {
      await acceptCashDeposit(item.id);
      toast.success("Uang tunai diterima!");
    } catch (error) {
      toast.error("Gagal menerima uang.");
    }
  };

  // Cash bulk deposit to BCA center
  const handleBulkSetor = async () => {
    const cashList = pendingSetorans.filter(s => s.status === 'Kas di Captain');
    const total = cashList.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
    if (total === 0) return toast.error("Tidak ada kas di tangan");
    if (!confirm(`Setor total kas Rp ${total.toLocaleString('id-ID')} ke Pusat?`)) return;

    setIsBulkDepositing(true);
    try {
      const ids = cashList.map(i => i.id);
      await captainDepositToAdmin(ids);
      toast.success("Setoran kas berhasil dilaporkan ke Pusat (BCA)!");
    } catch (error) {
      toast.error("Gagal mengirim setoran.");
    } finally {
      setIsBulkDepositing(false);
    }
  };

  // Calculations
  const totalKasDiTangan = pendingSetorans
    .filter(s => s.status === 'Kas di Captain')
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const pendingAcceptanceCount = pendingSetorans
    .filter(s => s.status === 'Menunggu Diterima Captain').length;

  const totalPiutangSales = salesTeams
    .reduce((sum, sales) => sum + ((sales.goodsDropped || 0) - (sales.totalDeposited || 0)), 0);

  return (
    <div className="p-5 animate-fadeIn pb-24 w-full max-w-md">
      {/* Header Profile */}
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-white tracking-tight">Halo, {user.name.split(' ')[0]}!</h1>
            <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-blue-500/30">Admin Gudang</span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Kelola dropping, setoran, retur & buku besar sales</p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-dark-800 border-2 border-blue-500/20 overflow-hidden shadow-xl flex items-center justify-center shrink-0">
          {user.photoURL ? (
            <img src={user.photoURL} alt="Foto Profil" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-black text-white">{user.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Kas di Tangan */}
        <div className="bg-dark-800 border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-8 -mt-8 blur-xl"></div>
          <div>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1">Kas Tunai di Tangan</p>
            <h3 className="text-base font-black text-emerald-400 truncate">Rp {totalKasDiTangan.toLocaleString('id-ID')}</h3>
          </div>
          {totalKasDiTangan > 0 && (
            <button 
              onClick={handleBulkSetor}
              disabled={isBulkDepositing}
              className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] uppercase font-black py-2 rounded-lg transition-all shadow-md tracking-wider disabled:opacity-50"
            >
              {isBulkDepositing ? "Memproses..." : "Setor ke BCA"}
            </button>
          )}
        </div>

        {/* Total Piutang */}
        <div className="bg-dark-800 border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-8 -mt-8 blur-xl"></div>
          <div>
            <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1">Piutang Sales Aktif</p>
            <h3 className="text-base font-black text-amber-500 truncate">Rp {totalPiutangSales.toLocaleString('id-ID')}</h3>
          </div>
          <div className="text-[8px] text-slate-500 font-bold mt-3">Tersebar di {salesTeams.length} Sales</div>
        </div>
      </div>

      {/* Pending Action Banner */}
      {pendingAcceptanceCount > 0 && (
        <div className="mb-6 p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg animate-pulse">💵</span>
              <div>
                <p className="text-xs font-black text-purple-300">Konfirmasi Terima Tunai</p>
                <p className="text-[9px] text-purple-400">Ada {pendingAcceptanceCount} setoran tunai sales butuh verifikasi uang fisik</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            {pendingSetorans.filter(s => s.status === 'Menunggu Diterima Captain').map(item => (
              <div key={item.id} className="flex justify-between items-center bg-dark-900/80 p-2.5 rounded-xl border border-slate-700/40 text-xs">
                <div>
                  <span className="font-bold text-white block">{item.namaSales}</span>
                  <span className="text-[8px] text-slate-500">{item.catatan || 'Titipan Tunai'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 font-bold mr-1">Rp {item.nominal?.toLocaleString('id-ID')}</span>
                  <button 
                    onClick={() => handleAcceptCash(item)}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg shadow-md active:scale-95 transition-all"
                  >
                    Terima
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daftar Sales Ledger List */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
            <h3 className="font-black text-white text-xs uppercase tracking-wider">Buku Besar Sales Agent</h3>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-dark-800/50 border border-slate-700/50 rounded-2xl animate-pulse"></div>
            ))
          ) : salesTeams.length > 0 ? (
            salesTeams.map((sales) => {
              const balance = (sales.goodsDropped || 0) - (sales.totalDeposited || 0);
              return (
                <div key={sales.id} className="bg-dark-800 border border-slate-700/50 rounded-2xl p-4 shadow-md flex flex-col gap-4">
                  {/* Info Header */}
                  <div 
                    onClick={() => setActiveLedgerSales(sales)}
                    className="flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-dark-900 border border-slate-700 flex items-center justify-center text-lg font-bold text-blue-400 shrink-0">
                        {sales.photoURL ? (
                          <img src={sales.photoURL} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          sales.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-white group-hover:text-blue-400 transition-colors">{sales.name}</h4>
                          <span className={`text-[7px] px-1 py-0.2 rounded font-bold uppercase ${sales.role === 'captain' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-700 text-slate-400'}`}>
                            {sales.role === 'captain' ? 'Captain' : 'Sales'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5">{sales.phone || "Tidak ada nomor WhatsApp"}</p>
                      </div>
                    </div>
                    
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase font-black">Saldo Piutang</p>
                        <p className={`text-sm font-black font-mono ${balance > 0 ? "text-amber-500" : "text-emerald-400"}`}>
                          Rp {balance.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <HiOutlineChevronRight className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" size={18} />
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-700/40 pt-3">
                    <button 
                      onClick={() => {
                        setDropSales(sales);
                        setDropProduct("");
                        setDropQty("");
                        setDropPrice("");
                        setDropPoId("");
                      }}
                      className="bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                      <HiOutlinePlus size={12}/> Drop Stok
                    </button>
                    <button 
                      onClick={() => {
                        setReturSales(sales);
                        setReturProduct("");
                        setReturQty("");
                        setReturReason("Sisa Tarikan Sales");
                      }}
                      className="bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 text-[10px] font-black py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                      <HiOutlineReply size={12}/> Tarik Retur
                    </button>
                    <button 
                      onClick={() => {
                        setBayarSales(sales);
                        setBayarNominal("");
                        setBayarMetode("Tunai ke Admin Gudang");
                        setBayarCatatan("");
                      }}
                      className="bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 text-[10px] font-black py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                      <HiOutlineCash size={12}/> Catat Bayar
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-dark-800/30 rounded-3xl border border-dashed border-slate-700">
              <p className="text-xs text-slate-500 font-medium">Belum ada tim sales terdaftar.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── MODAL BUKU BESAR (LEDGER BOOK) ── */}
      {activeLedgerSales && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[150] pb-0 backdrop-blur-sm" onClick={() => setActiveLedgerSales(null)}>
          <div className="bg-dark-900 w-full max-w-md rounded-t-3xl p-6 border-t border-slate-700 animate-slideIn max-h-[85vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  📖 Buku Besar Sales
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{activeLedgerSales.name}</p>
              </div>
              <button onClick={() => setActiveLedgerSales(null)} className="text-slate-500 hover:text-white transition-colors p-1">
                <HiOutlineX size={24}/>
              </button>
            </div>

            {/* Current Balance card */}
            <div className="bg-dark-800 rounded-2xl p-4 border border-slate-700/50 mb-4 flex justify-between items-center">
              <div>
                <span className="text-[8px] text-slate-500 font-black uppercase tracking-wider block">Saldo Akhir</span>
                <span className={`text-xl font-mono font-black ${((activeLedgerSales.goodsDropped || 0) - (activeLedgerSales.totalDeposited || 0)) > 0 ? "text-amber-500" : "text-emerald-400"}`}>
                  Rp {((activeLedgerSales.goodsDropped || 0) - (activeLedgerSales.totalDeposited || 0)).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-[8px] bg-dark-900 text-slate-400 border border-slate-700 rounded-lg px-2 py-1 font-bold">
                Live Sinkron
              </div>
            </div>

            {/* Ledger Table */}
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              {isLedgerLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-500">Menyusun baris buku besar...</p>
                </div>
              ) : ledgerData.length === 0 ? (
                <p className="text-center py-10 text-slate-500 text-xs italic">Belum ada riwayat transaksi.</p>
              ) : (
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50 bg-dark-800/30">
                      <th className="py-2.5 px-2">Tgl</th>
                      <th className="py-2.5 px-2">Keterangan</th>
                      <th className="py-2.5 px-2 text-right">Nilai</th>
                      <th className="py-2.5 px-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/35">
                    {ledgerData.map((item) => {
                      const isMinus = item.nilai < 0;
                      return (
                        <tr key={item.id} className="text-[11px] hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap">
                            {item.tanggal ? new Date(item.tanggal.toDate()).toLocaleDateString('id-ID', {
                              day: '2-digit', month: '2-digit', year: '2-digit'
                            }) : '--/--/--'}
                          </td>
                          <td className="py-2.5 px-2 text-slate-200">
                            <span className="font-bold block">{item.keterangan}</span>
                            {item.qty && (
                              <span className="text-[8px] text-slate-500">
                                {item.qty} @{item.harga?.toLocaleString('id-ID')}
                              </span>
                            )}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-bold font-mono ${
                            item.tipe === 'setoran_pending' ? 'text-slate-500' :
                            isMinus ? (item.tipe === 'retur' ? 'text-amber-400/80' : 'text-rose-400') : 'text-emerald-400'
                          }`}>
                            {isMinus ? '-' : '+'} Rp {Math.abs(item.nilai).toLocaleString('id-ID')}
                            {item.tipe === 'setoran_pending' && (
                              <span className="text-[7px] text-slate-500 font-bold block uppercase tracking-tighter">Pending</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-300 font-semibold">
                            Rp {item.saldo.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            <button 
              onClick={() => setActiveLedgerSales(null)}
              className="mt-6 w-full py-4 bg-dark-800 border border-slate-700 hover:bg-slate-800 text-slate-300 font-black rounded-2xl text-xs uppercase tracking-widest active:scale-98 transition-all shrink-0"
            >
              Tutup Buku Besar
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DROP STOK ── */}
      {dropSales && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[150] pb-0 backdrop-blur-sm" onClick={() => setDropSales(null)}>
          <div className="bg-dark-900 w-full max-w-md rounded-t-3xl p-6 border-t border-slate-700 animate-slideIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Drop Barang ke Sales</h3>
                <p className="text-xs text-slate-400 mt-0.5">{dropSales.name}</p>
              </div>
              <button onClick={() => setDropSales(null)} className="text-slate-500 hover:text-white transition-colors p-1"><HiOutlineX size={24}/></button>
            </div>

            <form onSubmit={handleDropSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Pilih Batch PO (Gudang)</label>
                <select 
                  value={dropPoId} 
                  onChange={(e) => {
                    const newPoId = e.target.value;
                    setDropPoId(newPoId);
                    const po = purchases.find(p => p.id === newPoId);
                    if (po) {
                      setDropPrice(po.targetHargaJual ? po.targetHargaJual.toString() : "");
                    }
                  }}
                  className="input-field w-full text-xs"
                  required
                >
                  <option value="">-- Pilih Batch Stok PO --</option>
                  {availableBatches.map(batch => (
                    <option key={batch.id} value={batch.id}>
                      {batch.productName} [Tgl PO: {batch.createdAt?.toDate().toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}] (Sisa: {batch.realSisa} Pk)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Jumlah</label>
                  <input 
                    type="number" step="any" inputMode="decimal"
                    value={dropQty} onChange={(e) => setDropQty(e.target.value)}
                    placeholder="0" className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-amber-500 focus:border-amber-500 outline-none text-center h-[50px]"
                    required
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Satuan</label>
                  <select 
                    value={dropUnit} onChange={(e) => setDropUnit(e.target.value)}
                    className="input-field w-full text-xs h-[50px]"
                    required
                  >
                    <option value="Ct">Ct</option>
                    <option value="Bal">Bal</option>
                    <option value="Slop">Slop</option>
                    <option value="Pk">Pk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Harga per Pack (Rp)</label>
                <input 
                  type="text" inputMode="numeric"
                  value={dropPrice} onChange={(e) => setDropPrice(e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                  placeholder="0" className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-white focus:border-blue-500 outline-none text-center h-[50px]"
                  required
                />
              </div>

              {computedDropAmount > 0 && (
                <div className="bg-dark-800 rounded-xl p-3 border border-slate-700/50 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400">Total Nilai Dropping</span>
                  <span className="font-black text-emerald-400 text-sm font-mono">Rp {computedDropAmount.toLocaleString('id-ID')}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setDropSales(null)} className="flex-1 py-3 text-slate-400 font-bold uppercase text-[10px]">Batal</button>
                <button type="submit" disabled={isDropping} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {isDropping ? "Dropping..." : "Konfirmasi Drop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TARIK RETUR ── */}
      {returSales && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[150] pb-0 backdrop-blur-sm" onClick={() => setReturSales(null)}>
          <div className="bg-dark-900 w-full max-w-md rounded-t-3xl p-6 border-t border-slate-700 animate-slideIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Tarik Retur dari Sales</h3>
                <p className="text-xs text-slate-400 mt-0.5">{returSales.name}</p>
              </div>
              <button onClick={() => setReturSales(null)} className="text-slate-500 hover:text-white transition-colors p-1"><HiOutlineX size={24}/></button>
            </div>

            <form onSubmit={handleReturSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Pilih Produk</label>
                <select 
                  value={returProduct} onChange={(e) => setReturProduct(e.target.value)}
                  className="input-field w-full text-xs"
                  required
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Jumlah</label>
                  <input 
                    type="number" step="any" inputMode="decimal"
                    value={returQty} onChange={(e) => setReturQty(e.target.value)}
                    placeholder="0" className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-amber-500 focus:border-amber-500 outline-none text-center h-[50px]"
                    required
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Satuan</label>
                  <select 
                    value={returUnit} onChange={(e) => setReturUnit(e.target.value)}
                    className="input-field w-full text-xs h-[50px]"
                    required
                  >
                    <option value="Ct">Ct</option>
                    <option value="Bal">Bal</option>
                    <option value="Slop">Slop</option>
                    <option value="Pk">Pk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Keterangan / Kondisi</label>
                <select 
                  value={returReason} onChange={(e) => setReturReason(e.target.value)}
                  className="input-field w-full text-xs"
                >
                  <option value="Sisa Tarikan Sales">Sisa Tarikan Sales</option>
                  <option value="Barang Cacat/Rusak">Barang Cacat / Rusak</option>
                  <option value="Salah Bawa Barang">Salah Bawa Barang</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setReturSales(null)} className="flex-1 py-3 text-slate-400 font-bold uppercase text-[10px]">Batal</button>
                <button type="submit" disabled={isReturing} className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {isReturing ? "Memproses..." : "Konfirmasi Retur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CATAT BAYAR ── */}
      {bayarSales && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-[150] pb-0 backdrop-blur-sm" onClick={() => setBayarSales(null)}>
          <div className="bg-dark-900 w-full max-w-md rounded-t-3xl p-6 border-t border-slate-700 animate-slideIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Catat Bayaran (Setoran)</h3>
                <p className="text-xs text-slate-400 mt-0.5">{bayarSales.name}</p>
              </div>
              <button onClick={() => setBayarSales(null)} className="text-slate-500 hover:text-white transition-colors p-1"><HiOutlineX size={24}/></button>
            </div>

            <form onSubmit={handleBayarSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Nominal Bayar (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-lg">Rp</span>
                  <input 
                    type="text" inputMode="numeric"
                    value={bayarNominal}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setBayarNominal(val ? parseInt(val).toLocaleString('id-ID') : "");
                    }}
                    placeholder="0" className="w-full bg-dark-800 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-emerald-400 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Metode Setor</label>
                <select 
                  value={bayarMetode} onChange={(e) => setBayarMetode(e.target.value)}
                  className="input-field w-full text-xs"
                  required
                >
                  <option value="Tunai ke Admin Gudang">Tunai ke Admin Gudang</option>
                  <option value="Transfer Bank">Transfer Bank (BCA)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Catatan / Keterangan (Opsional)</label>
                <input 
                  type="text" value={bayarCatatan} onChange={(e) => setBayarCatatan(e.target.value)}
                  placeholder="Contoh: Titipan Setoran BCA" className="input-field w-full text-xs"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setBayarSales(null)} className="flex-1 py-3 text-slate-400 font-bold uppercase text-[10px]">Batal</button>
                <button type="submit" disabled={isBayaring} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {isBayaring ? "Menyimpan..." : "Simpan Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
