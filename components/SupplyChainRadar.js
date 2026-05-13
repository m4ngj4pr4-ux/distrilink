"use client";

import { useState, useEffect } from "react";
import { 
  subscribePurchases, 
  subscribeAllDistributions, 
  subscribeAllSalesTransactions, 
  subscribeAllStoreInventory,
  subscribeProducts,
  subscribeRetailStores,
  deleteStoreInventoryRecord,
  cleanupOrphanStoreInventory
} from "@/lib/firestore";
import { HiOutlineDatabase, HiOutlineTruck, HiOutlineCube, HiOutlineExclamationCircle, HiOutlineChartPie, HiOutlineTrash, HiOutlineRefresh } from "react-icons/hi";
import toast from "react-hot-toast";

export default function SupplyChainRadar() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCleaning, setIsCleaning] = useState(false);
  
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [storeInventory, setStoreInventory] = useState([]);
  const [retailStores, setRetailStores] = useState([]);

  useEffect(() => {
    const unsubs = [
      subscribeProducts(setProducts),
      subscribePurchases(setPurchases),
      subscribeAllDistributions(setDistributions),
      subscribeAllSalesTransactions(setTransactions),
      subscribeAllStoreInventory(setStoreInventory),
      subscribeRetailStores(setRetailStores)
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  // Filter and Aggregate Logic
  const getRadarData = () => {
    // 1. Get POs for the selected month
    const filteredPOs = purchases.filter(po => {
      if (!po.createdAt) return false;
      const date = po.createdAt.toDate ? po.createdAt.toDate() : new Date(po.createdAt);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    const poIds = filteredPOs.map(po => po.id);
    const productIdsInMonth = [...new Set(filteredPOs.map(po => po.productId))];

    return productIdsInMonth.map(pid => {
      const product = products.find(p => p.id === pid) || { name: "Produk Terhapus" };
      const productPOs = filteredPOs.filter(po => po.productId === pid);
      
      const totalPO = productPOs.reduce((sum, po) => sum + (po.totalPack || 0), 0);
      
      // Di Gudang: (Total PO) - (Distributions from those specific POs)
      const productDists = distributions.filter(d => poIds.includes(d.poId) && d.productId === pid);
      const totalDist = productDists.reduce((sum, d) => sum + (d.totalPacksDistributed || 0), 0);
      const diGudang = Math.max(0, totalPO - totalDist);

      // Di Perjalanan (Sales): (Distributions) - (Drops to Stores)
      // Filter drops that occurred in the same month for this product
      const productDrops = transactions.filter(tx => {
        if (tx.tipe !== 'drop' || tx.productId !== pid || !tx.waktu) return false;
        const date = tx.waktu.toDate ? tx.waktu.toDate() : new Date(tx.waktu);
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      });
      const totalDropped = productDrops.reduce((sum, tx) => sum + (tx.jumlahDrop || 0), 0);
      const diPerjalanan = Math.max(0, totalDist - totalDropped);

      // Di Etalase Toko: The LATEST audited stock from stores (all time, but only for this product)
      const productShelves = storeInventory.filter(inv => inv.productName === product.name);
      // Auto-filter orphans: only count stock for stores that still exist
      const validShelves = productShelves.filter(inv => retailStores.some(s => s.id === inv.storeId));
      const diEtalase = validShelves.reduce((sum, inv) => sum + (inv.currentStock || 0), 0);

      // Ludes: (Total Dropped in month) - (Di Etalase currently)
      // User Logic: (Total dropped to stores) - (Di Etalase Toko)
      const ludes = Math.max(0, totalDropped - diEtalase);

      return {
        id: pid,
        name: product.name,
        totalPO,
        diGudang,
        diPerjalanan,
        diEtalase,
        ludes
      };
    });
  };

  const radarData = getRadarData();

  // Restock Warning List
  const restockWarnings = storeInventory
    .filter(inv => inv.currentStock <= 5) // Critical threshold
    .filter(inv => retailStores.some(s => s.id === inv.storeId)) // Auto-filter orphans
    .map(inv => {
      const store = retailStores.find(s => s.id === inv.storeId);
      return {
        ...inv,
        namaToko: store?.namaToko || "Toko Tidak Dikenal",
        lastAuditDate: inv.lastAuditAt?.toDate ? inv.lastAuditAt.toDate().toLocaleDateString("id-ID") : "-"
      };
    })
    .sort((a, b) => a.currentStock - b.currentStock);

  const handleCleanup = async () => {
    if (!confirm("Hapus semua data stok dari toko yang sudah tidak ada di database?")) return;
    setIsCleaning(true);
    try {
      const storeIds = retailStores.map(s => s.id);
      const count = await cleanupOrphanStoreInventory(storeIds);
      toast.success(`${count} data hantu berhasil dibersihkan!`);
    } catch (err) {
      toast.error("Gagal membersihkan: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDeleteRecord = async (id, name) => {
    if (!confirm(`Hapus catatan stok ${name} ini secara permanen?`)) return;
    try {
      await deleteStoreInventoryRecord(id);
      toast.success("Catatan dihapus");
    } catch (err) {
      toast.error("Gagal: " + err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-10">
      {/* Month Filter */}
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
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCleanup}
            disabled={isCleaning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all border border-slate-700 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            <HiOutlineRefresh className={isCleaning ? "animate-spin" : ""} />
            Bersihkan Data Hantu
          </button>

          <div className="h-8 w-px bg-slate-700 mx-1"></div>

          <div className="flex gap-2">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-dark-700 border border-slate-600 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500 font-bold"
            >
              {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="bg-dark-700 border border-slate-600 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500 font-bold"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Funnel Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {radarData.map(item => (
          <div key={item.id} className="glass-card p-5 border-l-4 border-emerald-500 hover:bg-white/[0.02] transition-colors">
            <h3 className="font-black text-white mb-4 uppercase tracking-tight text-lg">{item.name}</h3>
            
            <div className="space-y-5">
              {/* Pipeline Step 1: Gudang */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <HiOutlineDatabase size={14} className="text-blue-400" /> Di Gudang Admin
                  </span>
                  <span className="text-white font-mono">{item.diGudang} Pk <span className="text-slate-600">/ {item.totalPO}</span></span>
                </div>
                <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${(item.diGudang / item.totalPO) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pipeline Step 2: Sales */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <HiOutlineTruck size={14} className="text-amber-400" /> Di Perjalanan (Sales)
                  </span>
                  <span className="text-white font-mono">{item.diPerjalanan} Pk</span>
                </div>
                <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${(item.diPerjalanan / item.totalPO) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pipeline Step 3: Etalase */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <HiOutlineCube size={14} className="text-indigo-400" /> Di Etalase Toko
                  </span>
                  <span className="text-white font-mono">{item.diEtalase} Pk</span>
                </div>
                <div className="w-full h-2 bg-dark-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${(item.diEtalase / item.totalPO) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pipeline Step 4: Ludes */}
              <div className="pt-2">
                <div className="flex justify-between text-[11px] mb-2">
                  <span className="text-emerald-400 uppercase font-black flex items-center gap-2">
                    <span className="animate-bounce">🚀</span> Market Absorption (Ludes)
                  </span>
                  <span className="text-emerald-400 font-black">{Math.round((item.ludes / item.totalPO) * 100) || 0}%</span>
                </div>
                <div className="w-full h-3 bg-dark-900 rounded-full overflow-hidden shadow-inner p-0.5">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
                    style={{ width: `${(item.ludes / item.totalPO) * 100}%` }}
                  />
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

      {/* Restock Warning Table */}
      <div className="glass-card overflow-hidden shadow-2xl border border-slate-700/30">
        <div className="p-4 bg-slate-800/40 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center">
              <HiOutlineExclamationCircle className="text-rose-500" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Radar Toko Kosong</h3>
              <p className="text-[10px] text-slate-500">Daftar retail yang membutuhkan restock segera (Stok ≤ 5)</p>
            </div>
          </div>
          <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-1 rounded font-bold uppercase">Critical Area</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-900/40">
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Retail Store</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Brand</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Shelf Stock</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Audit</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pembina (Sales)</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {restockWarnings.map((warn, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{warn.namaToko}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">ID: {warn.storeId?.substring(0,8)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-slate-300 font-medium">{warn.productName}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-block min-w-[50px] px-3 py-1 rounded-lg font-black text-xs ${warn.currentStock === 0 ? "bg-rose-500 text-white shadow-lg shadow-rose-900/40" : "bg-amber-500/20 text-amber-400"}`}>
                      {warn.currentStock} Pk
                    </span>
                  </td>
                  <td className="p-4 text-[11px] text-slate-400">{warn.lastAuditDate}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      {warn.lastAuditBy || warn.lastDropBy || "System"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleDeleteRecord(warn.id, warn.productName)}
                      className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                      title="Hapus Catatan Stok"
                    >
                      <HiOutlineTrash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {restockWarnings.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-16 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <HiOutlineCube size={40} className="text-slate-500" />
                      <p className="italic text-xs font-medium">Semua toko masih memiliki stok yang mencukupi.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
