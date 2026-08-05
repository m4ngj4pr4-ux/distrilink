"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineSearch, HiCube, HiChevronDown, HiChevronUp, HiOutlineRefresh } from 'react-icons/hi';
import { 
  subscribeProducts, 
  subscribePurchases, 
  receivePurchaseAtomic,
  subscribeAllDistributions,
  subscribeReturns,
  calculatePOBatchesWithRealSisa
} from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function StokGudangPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [allDistributions, setAllDistributions] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProducts, setExpandedProducts] = useState({});
  const [receivingPO, setReceivingPO] = useState(null);
  const [actualCartonsInput, setActualCartonsInput] = useState("");
  const [qtyMatches, setQtyMatches] = useState(true);
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);

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

    const unsubAllDist = subscribeAllDistributions(setAllDistributions);
    const unsubReturns = subscribeReturns(setReturns);

    return () => {
      unsubProducts();
      unsubPurchases();
      unsubAllDist();
      unsubReturns();
    };
  }, [user]);

  const formatRp = (num) => {
    return num ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num) : "-";
  };

  const getProductStockData = (p) => {
    // 1. Ambil semua batch PO aktif untuk produk ini dengan sisa stok riil, urutkan dari yang TERBARU (Descending)
    const batches = calculatePOBatchesWithRealSisa(purchases, allDistributions, returns)
      .filter(b => b.productId === p.id && b.realSisa > 0)
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
    // 2. Total pack sisa di gudang adalah jumlah sisa dari seluruh batch aktif
    const totalPacks = batches.reduce((sum, b) => sum + b.realSisa, 0);

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

  const pendingPOs = purchases.filter(po => po.status === "pengiriman");

  const handleConfirmReceive = async () => {
    if (!receivingPO) return;
    
    let receivedQty = receivingPO.jumlahKarton;
    if (!qtyMatches) {
      const parsed = parseFloat(actualCartonsInput);
      if (isNaN(parsed) || parsed <= 0) {
        toast.error("Jumlah karton yang diterima harus berupa angka lebih dari 0");
        return;
      }
      receivedQty = parsed;
    }

    setIsSubmittingReceive(true);
    try {
      await receivePurchaseAtomic(receivingPO.id, receivedQty);
      toast.success("Barang PO berhasil diterima & stok masuk gudang!");
      setReceivingPO(null);
      setActualCartonsInput("");
      setQtyMatches(true);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menerima barang: " + err.message);
    } finally {
      setIsSubmittingReceive(false);
    }
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

      {/* PO Dalam Pengiriman */}
      {pendingPOs.length > 0 && (
        <div className="mb-6 bg-dark-800 border border-amber-500/30 rounded-2xl p-4">
          <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>🚚</span> PO Dalam Pengiriman ({pendingPOs.length})
          </h2>
          <div className="space-y-3">
            {pendingPOs.map(po => (
              <div key={po.id} className="bg-dark-900 border border-slate-700/60 rounded-xl p-3 flex justify-between items-center text-xs">
                <div className="min-w-0 flex-1 pr-3">
                  <h4 className="font-bold text-white truncate">{po.productName}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Order:{" "}
                    <span className="font-bold font-mono text-slate-300">
                      {po.jumlahKartonInput != null || po.jumlahBallInput != null || po.jumlahSlopInput != null ? (
                        `${po.jumlahKartonInput || 0} Ct / ${po.jumlahBallInput || 0} Bal / ${po.jumlahSlopInput || 0} Slop`
                      ) : (
                        `${po.jumlahKarton} Ct`
                      )}
                    </span>
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Dibuat: {po.createdAt ? new Date(po.createdAt.toDate()).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" }) : "-"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReceivingPO(po);
                    setActualCartonsInput(Number(po.jumlahKarton.toFixed(4)).toString());
                    setQtyMatches(true);
                  }}
                  className="bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shrink-0"
                >
                  Terima Barang
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

                {/* Price Display */}
                <div className="bg-dark-900 border border-slate-700/60 rounded-xl p-2.5 text-[10px] flex justify-between items-center">
                  <div>
                    <span className="text-blue-400 font-bold block uppercase text-[8px] tracking-wider mb-0.5">Harga / Pk</span>
                    <span className="font-mono font-bold text-blue-400 text-xs">
                      {totalPacks > 0 ? formatRp(displaySellingPrice) : "-"}
                    </span>
                  </div>
                  {latestActiveBatch && totalPacks > 0 && (
                    <span className="text-[8.5px] text-blue-500/70 font-mono bg-blue-950/40 border border-blue-900/50 px-2 py-0.5 rounded">
                      Batch {latestActiveBatch.id.slice(-6).toUpperCase()}
                    </span>
                  )}
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
                              <span>Harga: <span className="text-blue-400 font-bold font-mono">{formatRp(batch.targetHargaJual)}</span></span>
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

      {/* Modal Terima Barang */}
      {receivingPO && (
        <div className="modal-overlay z-[100] fixed inset-0 bg-black/90 flex items-center justify-center p-4">
          <div className="modal-content w-full max-w-sm bg-dark-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-black text-white mb-2 uppercase tracking-wide">📦 Konfirmasi Penerimaan</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Silakan konfirmasi kedatangan produk <span className="text-white font-bold">{receivingPO.productName}</span> dari pabrik.
            </p>

            <div className="space-y-4">
              {/* Box PO Info */}
              <div className="bg-dark-800 border border-slate-800 rounded-xl p-3 text-xs">
                <div className="flex justify-between border-b border-slate-700/30 pb-1.5 mb-1.5 text-slate-400">
                  <span>Jumlah di PO:</span>
                  <span className="font-bold text-white font-mono text-right">
                    {receivingPO.jumlahKartonInput != null || receivingPO.jumlahBallInput != null || receivingPO.jumlahSlopInput != null ? (
                      `${receivingPO.jumlahKartonInput || 0} Ct / ${receivingPO.jumlahBallInput || 0} Bal / ${receivingPO.jumlahSlopInput || 0} Slop`
                    ) : (
                      `${Number(receivingPO.jumlahKarton.toFixed(4))} Karton`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>HPP per Pack:</span>
                  <span className="font-mono text-emerald-400">{formatRp(receivingPO.hpp)}</span>
                </div>
              </div>

              {/* Checkbox Konfirmasi Qty */}
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={qtyMatches}
                    onChange={(e) => setQtyMatches(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-dark-800 text-blue-500 focus:ring-0 cursor-pointer"
                  />
                  <span>
                    Jumlah barang sesuai PO (
                    {receivingPO.jumlahKartonInput != null || receivingPO.jumlahBallInput != null || receivingPO.jumlahSlopInput != null ? (
                      `${receivingPO.jumlahKartonInput || 0} Ct / ${receivingPO.jumlahBallInput || 0} Bal / ${receivingPO.jumlahSlopInput || 0} Slop`
                    ) : (
                      `${receivingPO.jumlahKarton} Ct`
                    )}
                    )
                  </span>
                </label>
              </div>

              {/* Input manual qty jika tidak sesuai */}
              {!qtyMatches && (
                <div className="bg-dark-800/50 border border-slate-800 rounded-xl p-3">
                  <label className="block text-[10px] font-black uppercase text-amber-400 tracking-wider mb-1.5">
                    Jumlah Karton yang Diterima
                  </label>
                  <input
                    type="number"
                    value={actualCartonsInput}
                    onChange={(e) => setActualCartonsInput(e.target.value)}
                    className="w-full bg-dark-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                    placeholder="Masukkan jumlah karton..."
                    min="1"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    *Selisih jumlah akan menyesuaikan nilai tagihan/utang otomatis.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                disabled={isSubmittingReceive}
                onClick={() => {
                  setReceivingPO(null);
                  setActualCartonsInput("");
                  setQtyMatches(true);
                }}
                className="btn-ghost flex-1 py-2.5 border border-slate-700 text-slate-400 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                disabled={isSubmittingReceive}
                onClick={handleConfirmReceive}
                className="btn-primary flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {isSubmittingReceive ? "Memproses..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
