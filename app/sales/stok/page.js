"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineSearch, HiCube, HiChevronDown, HiChevronUp, HiOutlineRefresh } from 'react-icons/hi';
import { subscribeProducts, subscribePurchases } from '@/lib/firestore';

export default function StokGudangPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProducts, setExpandedProducts] = useState({});

  useEffect(() => {
    const userStr = localStorage.getItem('sales_user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
        // Proteksi: Hanya Admin Gudang yang boleh masuk halaman ini
        if (parsed.role !== 'admin_gudang') {
          router.replace('/sales');
        }
      } catch (e) {
        console.error(e);
        router.replace('/sales/login');
      }
    } else {
      router.replace('/sales/login');
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    const unsubProducts = subscribeProducts((data) => {
      setProducts(data);
    });

    const unsubPurchases = subscribePurchases((data) => {
      setPurchases(data);
      setIsLoading(false);
    });

    return () => {
      unsubProducts();
      unsubPurchases();
    };
  }, [user]);

  const formatRp = (num) => {
    return num ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num) : "-";
  };

  const getProductStockData = (p) => {
    // 1. Ambil semua PO untuk produk ini, urutkan dari yang TERBARU (Descending)
    const productPOs = purchases
      .filter(po => po.productId === p.id)
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
    // 2. Hitung stok aktual Gudang berdasarkan PO dan barang terdistribusi
    const totalPurchased = productPOs.reduce((sum, po) => sum + (po.totalPack || 0), 0);
    const totalPacks = Math.max(0, totalPurchased - (p.adminDistributedPacks || 0));
    
    // 3. Alokasikan sisa stok global ke batch PO secara FIFO (dari PO terlama)
    // Untuk alokasi sisa stok per batch, kita urutkan PO dari yang TERBARU agar stok tersisa dialokasikan ke PO paling baru dulu
    let remainingGlobalStock = totalPacks;
    const batches = [];
    if (remainingGlobalStock > 0) {
      productPOs.forEach(po => {
        if (remainingGlobalStock <= 0) return;
        const poOriginalCapacity = po.totalPack || 0;
        const allocated = Math.min(remainingGlobalStock, poOriginalCapacity);
        if (allocated > 0) {
          batches.push({
            ...po,
            realSisa: allocated
          });
          remainingGlobalStock -= allocated;
        }
      });
    }

    const packsPerSlop = p.packsPerSlop || 10;
    const totalSlops = Math.floor(totalPacks / packsPerSlop);
    const fullBals = Math.floor(totalSlops / 10);
    const remainingSlops = totalSlops % 10;
    const remainingPacks = totalPacks % packsPerSlop;

    return {
      totalPacks,
      stockText: `${fullBals} Bal - ${remainingSlops} Slop - ${remainingPacks} Pk`,
      batches,
      latestActiveBatch: batches[0]
    };
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (productId) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  if (!user) return null;

  return (
    <div className="p-5 pb-24 w-full max-w-md mx-auto">
      {/* Header */}
      <header className="mb-6 mt-2">
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <span>📦</span> Stok Gudang Utama
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Pantau stok produk dan rincian alokasi per batch PO masuk
        </p>
      </header>

      {/* Search Bar */}
      <div className="mb-5 relative">
        <input 
          type="text" 
          placeholder="Cari produk di gudang..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-xs text-slate-200 focus:border-blue-500 outline-none shadow-inner"
        />
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
          <HiOutlineSearch size={16} />
        </div>
      </div>

      {/* Product List */}
      <div className="space-y-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-28 bg-dark-800 border border-slate-700 rounded-2xl animate-pulse"></div>
          ))
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((p) => {
            const { totalPacks, stockText, batches, latestActiveBatch } = getProductStockData(p);
            const isExpanded = !!expandedProducts[p.id];
            const displayHPP = latestActiveBatch ? latestActiveBatch.hpp : p.lastHPP;
            const displaySellingPrice = latestActiveBatch ? latestActiveBatch.targetHargaJual : p.currentSellingPrice;

            return (
              <div key={p.id} className="bg-dark-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
                {/* Main Product Info */}
                <div className="flex gap-3 items-start">
                  {/* Product Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-dark-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-black text-slate-500 uppercase">NO PIC</span>
                    )}
                  </div>

                  {/* Name and Stocks */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm text-white truncate leading-tight mb-1">{p.name}</h3>
                    <p className="text-xs font-black text-emerald-400 font-mono tracking-tight">{stockText}</p>
                    <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                      Total: {totalPacks.toLocaleString("id-ID")} Pk
                    </p>
                  </div>
                </div>

                {/* HPP and Selling Price */}
                <div className="grid grid-cols-2 gap-2 bg-dark-900 border border-slate-700/60 rounded-xl p-2.5 text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold block uppercase text-[8px] tracking-wider mb-0.5">HPP Terakhir</span>
                    <span className="font-mono font-bold text-slate-300">
                      {totalPacks > 0 ? formatRp(displayHPP) : "-"}
                    </span>
                    {latestActiveBatch && totalPacks > 0 && (
                      <span className="text-[7.5px] text-slate-500 font-mono block">
                        Batch {latestActiveBatch.id.slice(-6).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-blue-400 font-bold block uppercase text-[8px] tracking-wider mb-0.5">Target Jual / Pk</span>
                    <span className="font-mono font-bold text-blue-400">
                      {totalPacks > 0 ? formatRp(displaySellingPrice) : "-"}
                    </span>
                    {latestActiveBatch && totalPacks > 0 && (
                      <span className="text-[7.5px] text-blue-500/50 font-mono block">
                        Batch {latestActiveBatch.id.slice(-6).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expander Button for Batches */}
                {batches.length > 0 && (
                  <button 
                    onClick={() => toggleExpand(p.id)}
                    className="w-full py-2 border border-slate-700/80 hover:bg-slate-700/30 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    <span>Rincian Batch PO ({batches.length})</span>
                    {isExpanded ? <HiChevronUp size={14} /> : <HiChevronDown size={14} />}
                  </button>
                )}

                {/* Collapsible Active Batches List (Solid layout for stability) */}
                {isExpanded && batches.length > 0 && (
                  <div className="border border-slate-700 bg-dark-900 rounded-xl p-3 space-y-2.5 mt-1">
                    <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-800 pb-1.5">
                      Urutan Alokasi Batch PO Gudang (FIFO)
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5">
                      {batches.map((batch) => {
                        const batchPacks = batch.realSisa || 0;
                        const bSlops = Math.floor(batchPacks / (p.packsPerSlop || 10));
                        const bBals = Math.floor(bSlops / 10);
                        const bRemainingSlops = bSlops % 10;
                        const bRemainingPacks = batchPacks % (p.packsPerSlop || 10);

                        return (
                          <div key={batch.id} className="border-b border-slate-800 pb-2 last:border-0 last:pb-0 text-[10px]">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-mono font-bold text-slate-300">
                                Batch {batch.id.slice(-6).toUpperCase()}
                              </span>
                              <span className="text-[8.5px] text-slate-500 font-semibold">
                                {batch.createdAt ? new Date(batch.createdAt.toDate()).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" }) : "-"}
                              </span>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400">
                              <span>HPP: <span className="text-emerald-400 font-bold font-mono">{formatRp(batch.hpp)}</span></span>
                              <span>Target: <span className="text-blue-400 font-bold font-mono">{formatRp(batch.targetHargaJual)}</span></span>
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[9px]">
                              <span className="text-slate-400 font-semibold">
                                {bBals} Bal - {bRemainingSlops} Slop - {bRemainingPacks} Pack
                              </span>
                              <span className="text-slate-500 font-bold font-mono">
                                {batchPacks.toLocaleString("id-ID")} Pk
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-dark-800 border border-dashed border-slate-700 rounded-2xl">
            <p className="text-xs text-slate-500 font-medium">Produk tidak ditemukan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
