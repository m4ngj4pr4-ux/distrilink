"use client";

import { useState, useEffect, useMemo } from "react";
import {
  subscribePurchases,
  subscribeAllDistributions,
  subscribeAllSalesTransactions,
  subscribeAllStoreInventory,
  subscribeProducts,
  subscribeRetailStores,
  subscribeSalesTeams,
  deleteStoreInventoryRecord,
  cleanupOrphanStoreInventory,
  updateSalesTeam,
  editDropTransaction,
  subscribeReturns
} from "@/lib/firestore";
import {
  HiOutlineDatabase, HiOutlineTruck, HiOutlineCube,
  HiOutlineExclamationCircle, HiOutlineChartPie,
  HiOutlineTrash, HiOutlineRefresh, HiOutlineTrendingUp,
  HiOutlineUserGroup, HiOutlineFire, HiOutlineSearch,
  HiOutlinePencilAlt, HiOutlineX
} from "react-icons/hi";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";

export default function SupplyChainRadar() {
  const { checkWritePermission } = usePermissions();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCleaning, setIsCleaning] = useState(false);
  const [searchStore, setSearchStore] = useState("");

  const [selectedStoreForHistory, setSelectedStoreForHistory] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({ productId: "", jumlahDrop: 0 });

  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [retailStores, setRetailStores] = useState([]);
  const [salesTeams, setSalesTeams] = useState([]);
  const [returns, setReturns] = useState([]);

  useEffect(() => {
    const unsubs = [
      subscribeProducts(setProducts),
      subscribePurchases(setPurchases),
      subscribeAllDistributions(setDistributions),
      subscribeAllSalesTransactions(setTransactions),
      subscribeAllStoreInventory(setStoreInventory),
      subscribeRetailStores(setRetailStores),
      subscribeSalesTeams(setSalesTeams),
      subscribeReturns(setReturns)
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // ── SUPPLY CHAIN FUNNEL (existing logic, kept intact) ──
  const getRadarData = () => {
    const filteredPOs = purchases.filter(po => {
      if (!po.createdAt) return false;
      const d = po.createdAt.toDate ? po.createdAt.toDate() : new Date(po.createdAt);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    const poIds = filteredPOs.map(po => po.id);
    const pids = [...new Set(filteredPOs.map(po => po.productId))];
    return pids.map(pid => {
      const product = products.find(p => p.id === pid) || { name: "Produk Terhapus" };
      const productPOs = filteredPOs.filter(po => po.productId === pid);
      const totalPO = productPOs.reduce((s, po) => s + (po.totalPack || 0), 0);
      const productDists = distributions.filter(d => poIds.includes(d.poId) && d.productId === pid);
      const totalDist = productDists.reduce((s, d) => s + (d.totalPacksDistributed || 0), 0);
      const diGudang = Math.max(0, totalPO - totalDist);
      const productDrops = transactions.filter(tx => {
        if (tx.tipe !== 'drop' || tx.productId !== pid || !tx.waktu) return false;
        const dt = tx.waktu.toDate ? tx.waktu.toDate() : new Date(tx.waktu);
        return dt.getMonth() === selectedMonth && dt.getFullYear() === selectedYear;
      });
      const totalDropped = productDrops.reduce((s, tx) => s + (tx.jumlahDrop || 0), 0);

      // Sync Market Radar with 3-Tier Distribution Logic (Phase 37)
      // Total Released to Field = Sum of all qty where type === 'admin_to_sales' (source !== 'captain') for this specific product (all-time)
      const totalReleasedToField = distributions
        .filter(d => d.productId === pid && d.source !== "captain")
        .reduce((sum, d) => sum + (d.totalPacksDistributed || 0), 0);

      // Total Dropped to Retail = Sum of all qty where type === 'drop_toko' (tipe === 'drop') for this specific product (all-time)
      const totalDroppedToRetail = transactions
        .filter(tx => tx.tipe === "drop" && tx.productId === pid)
        .reduce((sum, tx) => sum + (tx.jumlahDrop || 0), 0);

      // DI PERJALANAN (SALES) = (Total Released to Field) - (Total Dropped to Retail) - (Total Returned From Sales)
      // This represents the sum of all "Sisa" stock currently held by the Captain and Sales agents combined.
      const totalReturnedFromSales = returns
        .filter(r => r.productId === pid)
        .reduce((sum, r) => sum + (r.totalPacksReturned || 0), 0);
      const diPerjalanan = Math.max(0, totalReleasedToField - totalDroppedToRetail - totalReturnedFromSales);
      const validShelves = storeInventory.filter(inv => inv.productName === product.name && retailStores.some(s => s.id === inv.storeId));
      const diEtalase = validShelves.reduce((s, inv) => s + (inv.currentStock || 0), 0);
      const ludes = Math.max(0, totalDropped - diEtalase);
      return { id: pid, name: product.name, totalPO, diGudang, diPerjalanan, diEtalase, ludes };
    });
  };
  const radarData = getRadarData();

  // ── WIDGET 1: KLASEMEN PENJUALAN TOKO ──
  const storeLeaderboard = useMemo(() => {
    const activeStoreIds = new Set(retailStores.map(s => s.id));
    const drops = transactions.filter(tx => tx.tipe === 'drop' && tx.storeId && activeStoreIds.has(tx.storeId));
    const map = {};
    drops.forEach(tx => {
      const sid = tx.storeId;
      if (!map[sid]) map[sid] = { storeId: sid, namaToko: tx.namaToko || "Toko", totalDrop: 0, brands: {} };
      map[sid].totalDrop += (tx.jumlahDrop || 0);
      const brand = tx.productName || "Lain";
      map[sid].brands[brand] = (map[sid].brands[brand] || 0) + (tx.jumlahDrop || 0);
    });
    return Object.values(map).sort((a, b) => b.totalDrop - a.totalDrop);
  }, [transactions, retailStores]);

  const filteredStoreLeaderboard = useMemo(() => {
    if (!searchStore || typeof searchStore !== 'string' || !searchStore.trim()) return storeLeaderboard;
    return storeLeaderboard.filter(store => {
      const nama = store?.namaToko || "";
      return String(nama).toLowerCase().includes(searchStore.toLowerCase());
    });
  }, [storeLeaderboard, searchStore]);

  // ── WIDGET 2: RADAR KINERJA SALES (3-Tier: Admin → Captain → Sales → Toko) ──
  const salesPerformance = useMemo(() => {
    return salesTeams.map(team => {
      const isCaptain = team.role === 'captain';

      if (isCaptain) {
        // CAPTAIN FORMULA:
        // Gross Received = semua distribusi dari Admin (source !== 'captain')
        const fromAdmin = distributions.filter(d => d.teamId === team.id && d.source !== 'captain');
        const grossReceived = fromAdmin.reduce((s, d) => s + (d.totalPacksDistributed || 0), 0);

        // Dioper ke Tim = semua captain_distribute transactions (Captain → Sales)
        const transferOut = transactions.filter(tx => tx.tipe === 'captain_distribute' && tx.teamId === team.id);
        const totalDioper = transferOut.reduce((s, tx) => s + (tx.jumlahDrop || 0), 0);

        // Bawaan Jual Netto (Stok Tas Lapangan) = Gross - Dioper - Retur
        const teamReturns = returns.filter(r => r.teamId === team.id);
        const totalRetur = teamReturns.reduce((s, r) => s + (r.totalPacksReturned || 0), 0);
        const bawaanNetto = Math.max(0, grossReceived - totalDioper - totalRetur);

        // Terjual = hanya drop ke toko retail (tipe: 'drop')
        const retailDrops = transactions.filter(tx => tx.tipe === 'drop' && tx.teamId === team.id);
        const totalTerjual = retailDrops.reduce((s, tx) => s + (tx.jumlahDrop || 0), 0);

        // Toko Binaan = unique storeId dari drop + toko terdaftar milik captain
        const dropStoreIds = new Set(retailDrops.map(tx => tx.storeId).filter(Boolean));
        const registeredStoreIds = new Set(retailStores.filter(s => s.teamId === team.id).map(s => s.id));
        const tokoBinaan = new Set([...dropStoreIds, ...registeredStoreIds]).size;

        const sisa = Math.max(0, bawaanNetto - totalTerjual);
        const pct = bawaanNetto > 0 ? (totalTerjual / bawaanNetto) * 100 : 0;

        const totalEarnedPoints = Math.floor((totalTerjual || 0) / 10);
        const activePoints = totalEarnedPoints % 200;
        const unclaimedRewards = Math.max(0, Math.floor(totalEarnedPoints / 200) - (team.claimedRewards || 0));

        return {
          id: team.id, name: team.name, role: team.role,
          grossReceived, totalDioper, bawaanNetto, totalTerjual, sisa, pct, tokoBinaan,
          totalEarnedPoints, activePoints, unclaimedRewards, claimedRewards: team.claimedRewards || 0
        };
      } else {
        // REGULAR SALES FORMULA:
        // Bawaan Netto = semua stok yang didistribusikan ke tim sales ini - Retur
        const teamDists = distributions.filter(d => d.teamId === team.id);
        const teamReturns = returns.filter(r => r.teamId === team.id);
        const totalRetur = teamReturns.reduce((s, r) => s + (r.totalPacksReturned || 0), 0);
        const bawaanNetto = Math.max(0, teamDists.reduce((s, d) => s + (d.totalPacksDistributed || 0), 0) - totalRetur);

        // Terjual = drop ke toko retail
        const retailDrops = transactions.filter(tx => tx.tipe === 'drop' && tx.teamId === team.id);
        const totalTerjual = retailDrops.reduce((s, tx) => s + (tx.jumlahDrop || 0), 0);

        // Toko Binaan = unique storeId dari drop + toko terdaftar
        const dropStoreIds = new Set(retailDrops.map(tx => tx.storeId).filter(Boolean));
        const registeredStoreIds = new Set(retailStores.filter(s => s.teamId === team.id).map(s => s.id));
        const tokoBinaan = new Set([...dropStoreIds, ...registeredStoreIds]).size;

        const sisa = Math.max(0, bawaanNetto - totalTerjual);
        const pct = bawaanNetto > 0 ? (totalTerjual / bawaanNetto) * 100 : 0;

        const totalEarnedPoints = Math.floor((totalTerjual || 0) / 10);
        const activePoints = totalEarnedPoints % 200;
        const unclaimedRewards = Math.max(0, Math.floor(totalEarnedPoints / 200) - (team.claimedRewards || 0));

        return {
          id: team.id, name: team.name, role: team.role,
          grossReceived: 0, totalDioper: 0, bawaanNetto, totalTerjual, sisa, pct, tokoBinaan,
          totalEarnedPoints, activePoints, unclaimedRewards, claimedRewards: team.claimedRewards || 0
        };
      }
    }).sort((a, b) => b.totalTerjual - a.totalTerjual);
  }, [salesTeams, distributions, transactions, retailStores]);

  const handleClaimReward = async (agent) => {
    if (!checkWritePermission("klaim reward token")) return;
    const confirmMessage = `Tandai 1 Token Listrik diserahkan ke ${agent.name}?\n\n` +
      `Token Siap Diklaim saat ini: ${agent.unclaimedRewards}\n` +
      `Total yang sudah diserahkan: ${agent.claimedRewards || 0}`;
    
    if (confirm(confirmMessage)) {
      try {
        const nextClaimed = (agent.claimedRewards || 0) + 1;
        await updateSalesTeam(agent.id, { claimedRewards: nextClaimed });
        toast.success(`Berhasil memperbarui reward untuk ${agent.name}!`);
      } catch (err) {
        toast.error("Gagal memperbarui: " + err.message);
      }
    }
  };

  const handleCleanup = async () => {
    if (!checkWritePermission("membersihkan data hantu")) return;
    if (!confirm("Hapus semua data stok dari toko yang sudah tidak ada di database?")) return;
    setIsCleaning(true);
    try {
      const count = await cleanupOrphanStoreInventory(retailStores.map(s => s.id));
      toast.success(`${count} data hantu berhasil dibersihkan!`);
    } catch (err) { toast.error("Gagal: " + err.message); }
    finally { setIsCleaning(false); }
  };

  const handleSaveEditDrop = async (tx) => {
    try {
      const prod = products.find(p => p.id === editForm.productId);
      if (!prod) throw new Error("Produk tidak valid");
      
      const newHargaJual = prod.currentSellingPrice || 0;
      const newTotal = newHargaJual * editForm.jumlahDrop;

      const newData = {
        productId: prod.id,
        productName: prod.name,
        jumlahDrop: editForm.jumlahDrop,
        hargaJual: newHargaJual,
        total: newTotal,
        storeId: tx.storeId,
        namaToko: tx.namaToko
      };

      await editDropTransaction(tx.id, tx, newData);
      toast.success("Transaksi drop berhasil diubah!");
      setEditingTx(null);
    } catch (err) {
      toast.error("Gagal mengubah: " + err.message);
    }
  };

  const getTrend = (total, rank) => {
    if (rank === 0) return { icon: "🏆", label: "Juara 1", color: "text-amber-400" };
    if (rank === 1) return { icon: "🥈", label: "Juara 2", color: "text-slate-300" };
    if (rank === 2) return { icon: "🥉", label: "Juara 3", color: "text-amber-600" };
    if (total >= 100) return { icon: "🔥", label: "Top Seller", color: "text-rose-400" };
    if (total >= 50) return { icon: "⚡", label: "Aktif", color: "text-blue-400" };
    return { icon: "📊", label: "Berkembang", color: "text-slate-400" };
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-10">
      {/* ── HEADER + FILTER ── */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <HiOutlineChartPie size={24} />
          </div>
          <div>
            <h2 className="font-bold text-white leading-tight">Market Radar Analytics</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Supply Chain & Market Absorption</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button onClick={handleCleanup} disabled={isCleaning}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-dark-700 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all border border-slate-700 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50">
            <HiOutlineRefresh className={isCleaning ? "animate-spin" : ""} />
            <span>Bersihkan Data Hantu</span>
          </button>
          <div className="hidden sm:block h-8 w-px bg-slate-700 mx-1" />
          <div className="flex gap-2 w-full sm:w-auto">
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-dark-700 border border-slate-600 rounded-xl px-4 py-2.5 text-[11px] text-white outline-none focus:border-emerald-500 font-bold flex-1 sm:flex-none">
              {["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"].map((m,i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="bg-dark-700 border border-slate-600 rounded-xl px-4 py-2.5 text-[11px] text-white outline-none focus:border-emerald-500 font-bold flex-1 sm:flex-none">
              {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── FUNNEL SECTION (existing) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {radarData.map(item => (
          <div key={item.id} className="glass-card p-5 border-l-4 border-emerald-500 hover:bg-white/[0.02] transition-colors">
            <h3 className="font-black text-white mb-4 uppercase tracking-tight text-lg">{item.name}</h3>
            <div className="space-y-5">
              <FunnelBar icon={<HiOutlineDatabase size={14} className="text-blue-400"/>} label="Di Gudang Admin" value={item.diGudang} total={item.totalPO} color="bg-blue-500" />
              <FunnelBar icon={<HiOutlineTruck size={14} className="text-amber-400"/>} label="DI PERJALANAN (SALES)" value={item.diPerjalanan} total={item.totalPO} color="bg-amber-500" />
              <FunnelBar icon={<HiOutlineCube size={14} className="text-indigo-400"/>} label="Di Etalase Toko" value={item.diEtalase} total={item.totalPO} color="bg-indigo-500" />
              <div className="pt-2">
                <div className="flex justify-between text-[11px] mb-2">
                  <span className="text-emerald-400 uppercase font-black flex items-center gap-2"><span className="animate-bounce">🚀</span> Market Absorption</span>
                  <span className="text-emerald-400 font-black">{Math.round((item.ludes / item.totalPO) * 100) || 0}%</span>
                </div>
                <div className="w-full h-3 bg-dark-900 rounded-full overflow-hidden shadow-inner p-0.5">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    style={{ width: `${(item.ludes / item.totalPO) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {radarData.length === 0 && (
          <div className="col-span-full py-20 text-center glass-card border-dashed border-2 border-slate-700/50">
            <HiOutlineExclamationCircle className="mx-auto text-slate-600 mb-2" size={48} />
            <p className="text-slate-400 text-sm font-medium">Data Supply Chain Kosong</p>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Tidak ada aktivitas PO pada bulan & tahun terpilih</p>
          </div>
        )}
      </div>

      {/* ── WIDGET 1: KLASEMEN PENJUALAN TOKO ── */}
      <div className="glass-card overflow-hidden shadow-2xl border border-slate-700/30">
        <div className="p-4 bg-gradient-to-r from-amber-500/5 to-transparent border-b border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
              <HiOutlineTrendingUp className="text-amber-400" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Klasemen Penjualan Toko</h3>
                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">{filteredStoreLeaderboard.length} Toko</span>
              </div>
              <p className="text-[10px] text-slate-500">Top Performers — Agregasi seluruh transaksi drop</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Cari toko..." 
              value={searchStore}
              onChange={(e) => setSearchStore(e.target.value)}
              className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 pl-9 text-xs text-white focus:border-amber-500 outline-none"
            />
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
        <div className="max-h-[450px] overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10">
              <tr className="bg-dark-900 shadow-md">
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-10">#</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nama Toko</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Total Drop</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rincian per Merek</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredStoreLeaderboard.map((store) => {
                const globalRank = storeLeaderboard.findIndex(s => s.storeId === store.storeId);
                const trend = getTrend(store.totalDrop, globalRank);
                return (
                  <tr key={store.storeId} onClick={() => setSelectedStoreForHistory(store)} className="hover:bg-white/[0.05] transition-colors group cursor-pointer">
                    <td className="p-4 text-xs font-black text-slate-500">{globalRank + 1}</td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{store.namaToko}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block min-w-[50px] px-3 py-1 rounded-lg font-black text-xs bg-emerald-500/20 text-emerald-400">
                        {store.totalDrop.toLocaleString("id-ID")} Pk
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(store.brands).sort((a,b) => b[1]-a[1]).map(([brand, qty]) => (
                          <span key={brand} className="text-[9px] bg-dark-900/80 border border-slate-700/50 px-2 py-0.5 rounded-md text-slate-300">
                            <span className="text-blue-400 font-bold">{brand}</span>: {qty}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[10px] font-bold ${trend.color} flex items-center justify-center gap-1`}>
                        <span>{trend.icon}</span> {trend.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredStoreLeaderboard.length === 0 && (
                <tr><td colSpan="5" className="p-16 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <HiOutlineCube size={40} className="text-slate-500" />
                    <p className="italic text-xs font-medium">
                      {searchStore ? "Tidak ada toko yang cocok dengan pencarian." : "Belum ada data transaksi drop."}
                    </p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── WIDGET 2: RADAR KINERJA & STOK SALES ── */}
      <div className="glass-card overflow-hidden shadow-2xl border border-slate-700/30">
        <div className="p-4 bg-gradient-to-r from-blue-500/5 to-transparent border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <HiOutlineUserGroup className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Radar Kinerja & Stok Sales</h3>
              <p className="text-[10px] text-slate-500">Performa distribusi & sisa stok bawaan setiap agen</p>
            </div>
          </div>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-bold">{salesPerformance.length} Agen</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
          {salesPerformance.map(agent => {
            const isCaptain = agent.role === 'captain';
            return (
            <div key={agent.id} className={`bg-dark-800/60 border rounded-2xl p-4 hover:bg-dark-800 transition-all group ${isCaptain ? "border-amber-500/30 ring-1 ring-amber-500/10" : "border-slate-700/50 hover:border-slate-600"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black ${isCaptain ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-400" : "bg-gradient-to-br from-blue-500/20 to-emerald-500/10 text-blue-400"}`}>
                    {agent.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{agent.name}</p>
                      {agent.tokoBinaan > 0 && (
                        <span className="text-[8px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-black">
                          {agent.tokoBinaan} 🏪
                        </span>
                      )}
                    </div>
                    <p className={`text-[9px] uppercase font-bold tracking-wider ${isCaptain ? "text-amber-500" : "text-slate-500"}`}>
                      {isCaptain ? "⭐ Captain" : "Sales"}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${agent.pct >= 80 ? "bg-emerald-500/20 text-emerald-400" : agent.pct >= 40 ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-400"}`}>
                  {Math.round(agent.pct)}%
                </span>
              </div>

              {/* Captain Extra: Gudang & Dioper */}
              {isCaptain && agent.grossReceived > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-dark-900/60 rounded-lg p-1.5 text-center">
                    <p className="text-[7px] text-blue-400 uppercase font-bold tracking-wider">Gudang (Gross)</p>
                    <p className="text-[11px] font-black text-blue-300">{agent.grossReceived.toLocaleString("id-ID")}</p>
                  </div>
                  <div className="bg-dark-900/60 rounded-lg p-1.5 text-center">
                    <p className="text-[7px] text-purple-400 uppercase font-bold tracking-wider">Dioper ke Tim</p>
                    <p className="text-[11px] font-black text-purple-300">{agent.totalDioper.toLocaleString("id-ID")}</p>
                  </div>
                </div>
              )}

              {/* Progress Bar: Terjual / Bawaan Netto */}
              <div className="mb-3">
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="text-slate-500 font-bold">Retail Performance</span>
                  <span className="text-slate-400">{agent.totalTerjual.toLocaleString("id-ID")} / {agent.bawaanNetto.toLocaleString("id-ID")} Pk</span>
                </div>
                <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ease-out ${agent.pct >= 80 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : agent.pct >= 40 ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "bg-slate-600"}`}
                    style={{ width: `${Math.min(100, agent.pct)}%` }} />
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="bg-dark-900/60 rounded-lg p-2">
                  <p className="text-[7px] text-slate-500 uppercase font-bold tracking-wider">Bawaan</p>
                  <p className="text-sm font-black text-white">{agent.bawaanNetto.toLocaleString("id-ID")}</p>
                </div>
                <div className="bg-dark-900/60 rounded-lg p-2">
                  <p className="text-[7px] text-emerald-500 uppercase font-bold tracking-wider">Terjual</p>
                  <p className="text-sm font-black text-emerald-400">{agent.totalTerjual.toLocaleString("id-ID")}</p>
                </div>
                <div className="bg-dark-900/60 rounded-lg p-2">
                  <p className="text-[7px] text-amber-500 uppercase font-bold tracking-wider">Sisa</p>
                  <p className={`text-sm font-black ${agent.sisa > 0 ? "text-amber-400" : "text-slate-500"}`}>{agent.sisa.toLocaleString("id-ID")}</p>
                </div>
                <div className="bg-dark-900/60 rounded-lg p-2">
                  <p className="text-[7px] text-cyan-400 uppercase font-bold tracking-wider">Toko</p>
                  <p className="text-sm font-black text-cyan-400">{agent.tokoBinaan}</p>
                </div>
                <div className="bg-dark-900/60 rounded-lg p-2 ring-1 ring-blue-500/20 bg-blue-950/20">
                  <p className="text-[7px] text-blue-400 uppercase font-bold tracking-wider">Poin</p>
                  <p className="text-sm font-black text-blue-400">{agent.activePoints.toLocaleString("id-ID")}</p>
                </div>
              </div>

              {/* Rewards Badge & Admin Claim Action */}
              {agent.unclaimedRewards > 0 && (
                <div className="mt-3 p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎁</span>
                    <span className="text-[10px] font-bold text-rose-400">
                      {agent.unclaimedRewards} Token Listrik Siap Diklaim!
                    </span>
                  </div>
                  <button
                    onClick={() => handleClaimReward(agent)}
                    className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white text-[9px] font-bold uppercase tracking-wide transition-all active:scale-95 whitespace-nowrap shadow-lg shadow-rose-950/50"
                  >
                    Tandai 1 Token Diserahkan
                  </button>
                </div>
              )}
            </div>
            );
          })}
          {salesPerformance.length === 0 && (
            <div className="col-span-full py-16 text-center opacity-30">
              <HiOutlineUserGroup size={40} className="text-slate-500 mx-auto mb-2" />
              <p className="italic text-xs font-medium">Belum ada data tim sales.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL RIWAYAT DROP TOKO */}
      {selectedStoreForHistory && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-dark-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-dark-900/50">
              <div>
                <h3 className="font-black text-white">Riwayat Drop: {selectedStoreForHistory.namaToko}</h3>
                <p className="text-[10px] text-slate-400">Total: {selectedStoreForHistory.totalDrop} Pk</p>
              </div>
              <button onClick={() => { setSelectedStoreForHistory(null); setEditingTx(null); }} className="p-2 bg-dark-700 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                <HiOutlineX size={18} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {transactions.filter(tx => tx.storeId === selectedStoreForHistory.storeId && tx.tipe === 'drop')
                .sort((a,b) => (b.waktu?.seconds || 0) - (a.waktu?.seconds || 0))
                .map(tx => (
                <div key={tx.id} className="p-4 bg-dark-900/40 border border-slate-700/30 rounded-xl hover:bg-dark-900/60 transition-colors">
                  {editingTx?.id === tx.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="text-[10px] text-slate-400 font-bold mb-1 block">Produk</label>
                           <select 
                             value={editForm.productId}
                             onChange={(e) => setEditForm({...editForm, productId: e.target.value})}
                             className="w-full bg-dark-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                           >
                             {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="text-[10px] text-slate-400 font-bold mb-1 block">Jumlah Drop (Pack)</label>
                           <input type="number" min="0"
                             value={editForm.jumlahDrop}
                             onChange={(e) => setEditForm({...editForm, jumlahDrop: parseInt(e.target.value) || 0})}
                             className="w-full bg-dark-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                           />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button onClick={() => setEditingTx(null)} className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg font-bold transition-all">Batal</button>
                        <button onClick={() => handleSaveEditDrop(tx)} className="px-4 py-2 text-xs bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20">Simpan Perubahan</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white">{tx.productName}</p>
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-black">{tx.jumlahDrop} Pk</span>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>👤 {tx.namaSales}</span>
                          <span>•</span>
                          <span>🕒 {tx.waktu?.toDate ? tx.waktu.toDate().toLocaleString("id-ID") : "Baru saja"}</span>
                        </p>
                      </div>
                      <button onClick={() => {
                        if (!checkWritePermission("edit transaksi drop")) return;
                        setEditingTx(tx);
                        setEditForm({ productId: tx.productId, jumlahDrop: tx.jumlahDrop });
                      }} className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-sm flex items-center gap-1">
                        <HiOutlinePencilAlt size={16} />
                        <span className="text-[10px] font-bold hidden sm:block">Edit</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {transactions.filter(tx => tx.storeId === selectedStoreForHistory.storeId && tx.tipe === 'drop').length === 0 && (
                 <p className="text-center text-slate-500 text-xs py-8">Tidak ada riwayat drop.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper sub-component for funnel bars ──
function FunnelBar({ icon, label, value, total, color }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1.5">
        <span className="text-slate-400 uppercase font-bold flex items-center gap-1.5">{icon} {label}</span>
        <span className="text-white font-mono">{value} Pk <span className="text-slate-600">/ {total}</span></span>
      </div>
      <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${total > 0 ? Math.min(100, (value / total) * 100) : 0}%` }} />
      </div>
    </div>
  );
}
