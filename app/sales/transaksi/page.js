"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  getGroupedStoreInventory, getSalesCarriedBrands, 
  addDropTransactionBatch, updateStoreShelfStock, getSisaStokSales,
  updateRetailStore
} from '@/lib/firestore';
import { getCurrentLocation } from '@/lib/geolocation';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { printer } from '@/lib/printer';
import { HiOutlinePrinter, HiCheckCircle, HiX, HiOutlineLocationMarker, HiOutlineSearch } from 'react-icons/hi';

export default function TransaksiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [groupedStores, setGroupedStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sisaStok, setSisaStok] = useState(0);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef(null);
  const storeRefs = useRef({});

  // Drop (Restock) Modal State
  const [restockStore, setRestockStore] = useState(null);
  const [carriedBrands, setCarriedBrands] = useState({});
  const [selectedBrand, setSelectedBrand] = useState("");
  const [jumlahDrop, setJumlahDrop] = useState("");
  const [hargaDrop, setHargaDrop] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrintEnabled, setIsPrintEnabled] = useState(false);
  const [cart, setCart] = useState([]);
  
  // Success Modal for Printing
  const [lastDropData, setLastDropData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Audit Modal State
  const [auditItem, setAuditItem] = useState(null);
  const [auditQty, setAuditQty] = useState("");

  // GPS Prompt State
  const [gpsPrompt, setGpsPrompt] = useState(null); // { storeId, namaToko, coords, status }
  const [pendingStore, setPendingStore] = useState(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Filtered stores based on search term
  const filteredStores = groupedStores.filter(store =>
    store.namaToko?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Suggestions for the dropdown (limited to 8 results for performance)
  const suggestions = searchTerm.trim().length > 0
    ? groupedStores
        .filter(store => store.namaToko?.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 8)
    : [];

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(value.trim().length > 0);
    setHighlightedIndex(-1);
  };

  const handleSuggestionClick = (store) => {
    setSearchTerm(store.namaToko);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    // Scroll to the store card
    setTimeout(() => {
      const el = storeRefs.current[store.storeId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-500/50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500/50'), 2000);
      }
    }, 100);
  };

  const handleSearchKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    loadData(parsedUser.id);
  }, [router]);

  const loadData = async (teamId) => {
    setIsLoading(true);
    const [stores, stok] = await Promise.all([
      getGroupedStoreInventory(teamId),
      getSisaStokSales(teamId)
    ]);
    setGroupedStores(stores);
    setSisaStok(stok);
    setIsLoading(false);
  };

  // ── RESTOCK (DROP) HANDLER ──
  const handleOpenRestock = async (store) => {
    const hasCoords = store.latitude != null && store.longitude != null 
      && !(store.latitude === 0 && store.longitude === 0);

    if (!hasCoords) {
      // Simpan store yang mau di-restock, tunjukkan GPS prompt dulu
      setPendingStore(store);
      setGpsPrompt({ storeId: store.storeId, namaToko: store.namaToko, coords: null, status: 'loading' });

      const loc = await getCurrentLocation(10000);
      if (loc.status === 'OK') {
        setGpsPrompt(prev => ({ ...prev, coords: { lat: loc.latitude, lng: loc.longitude }, status: 'ok' }));
      } else {
        setGpsPrompt(prev => ({ ...prev, status: 'failed' }));
      }
      return;
    }

    // Toko sudah punya koordinat — langsung buka modal restock
    openRestockModal(store);
  };

  const openRestockModal = async (store) => {
    setRestockStore(store);
    setSelectedBrand("");
    setJumlahDrop("");
    const brands = await getSalesCarriedBrands(user.id);
    setCarriedBrands(brands);
    setHargaDrop("");
    setCart([]); // Clear cart for new transaction
  };

  const handleGpsSave = async () => {
    if (!gpsPrompt?.coords || !gpsPrompt?.storeId) return;
    try {
      await updateRetailStore(gpsPrompt.storeId, {
        latitude: gpsPrompt.coords.lat,
        longitude: gpsPrompt.coords.lng
      });
      toast.success("Koordinat toko berhasil disimpan!");
    } catch (err) {
      toast.error("Gagal simpan koordinat.");
    }
    setGpsPrompt(null);
    if (pendingStore) {
      openRestockModal(pendingStore);
      setPendingStore(null);
    }
  };

  const handleGpsSkip = () => {
    setGpsPrompt(null);
    if (pendingStore) {
      openRestockModal(pendingStore);
      setPendingStore(null);
    }
  };

  // Harga referensi dari distribusi (untuk info, bukan auto-fill)
  const hargaReferensi = selectedBrand && carriedBrands[selectedBrand]
    ? carriedBrands[selectedBrand].sellingPrice || 0
    : 0;

  const handleAddToCart = (e) => {
    if (e) e.preventDefault();
    const qty = parseInt(jumlahDrop) || 0;
    const price = parseInt(hargaDrop.toString().replace(/\D/g, '')) || 0;

    if (!selectedBrand) return toast.error("Pilih merek barang!");
    if (qty <= 0) return toast.error("Masukkan jumlah yang valid!");
    if (price <= 0) return toast.error("Masukkan harga jual yang valid!");

    const brandData = carriedBrands[selectedBrand];
    if (!brandData) return toast.error("Merek tidak ditemukan!");

    const existingCartItem = cart.find(item => item.productName === selectedBrand);
    const inCartQty = existingCartItem ? existingCartItem.jumlahDrop : 0;
    const totalNewQty = inCartQty + qty;

    if (totalNewQty > brandData.sisa) {
      return toast.error(`Stok ${selectedBrand} Anda hanya ${brandData.sisa} Pk! Di keranjang: ${inCartQty} Pk.`);
    }

    if (existingCartItem) {
      setCart(cart.map(item => 
        item.productName === selectedBrand 
          ? { ...item, jumlahDrop: totalNewQty, hargaJual: price, total: totalNewQty * price }
          : item
      ));
      toast.success(`Keranjang diperbarui! ${selectedBrand} → ${totalNewQty} Pk.`);
    } else {
      setCart([...cart, {
        productId: brandData.productId,
        productName: selectedBrand,
        jumlahDrop: qty,
        hargaJual: price,
        total: qty * price
      }]);
      toast.success(`${selectedBrand} ditambahkan ke keranjang.`);
    }

    setSelectedBrand("");
    setJumlahDrop("");
    setHargaDrop("");
  };

  const handleRemoveFromCart = (brandName) => {
    setCart(cart.filter(item => item.productName !== brandName));
    toast.success(`${brandName} dihapus dari keranjang.`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error("Keranjang belanja kosong!");
    
    setIsSubmitting(true);
    try {
      const storeInfo = {
        storeId: restockStore.storeId,
        namaToko: restockStore.namaToko
      };
      const agentInfo = {
        id: user.id,
        name: user.name
      };

      const receiptId = await addDropTransactionBatch(cart, storeInfo, agentInfo);
      
      const checkoutSummary = {
        receiptId: receiptId,
        namaToko: restockStore.namaToko,
        waktu: new Date(),
        namaSales: user.name,
        items: cart,
        grandTotal: cart.reduce((sum, item) => sum + item.total, 0),
        totalQty: cart.reduce((sum, item) => sum + item.jumlahDrop, 0)
      };

      setLastDropData(checkoutSummary);
      setRestockStore(null);
      await loadData(user.id);
      toast.success("Checkout berhasil!");
    } catch (error) {
      toast.error("Gagal menyimpan data drop.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!lastDropData) return;
    setIsPrinting(true);
    try {
      toast.loading("Menghubungkan ke printer...", { id: "print-toast" });
      await printer.connect();
      toast.loading("Mencetak nota...", { id: "print-toast" });
      await printer.printMultiItemReceipt(lastDropData);
      toast.success("Nota berhasil dicetak!", { id: "print-toast" });
    } catch (error) {
      console.error(error);
      toast.error("Gagal cetak: " + error.message, { id: "print-toast" });
    } finally {
      setIsPrinting(false);
    }
  };

  // ── AUDIT HANDLER ──
  const handleOpenAudit = (store, prod) => {
    setAuditItem({ storeId: store.storeId, namaToko: store.namaToko, ...prod });
    setAuditQty(prod.currentStock?.toString() || "0");
  };

  const handleAuditSubmit = async () => {
    const newStock = parseInt(auditQty);
    if (isNaN(newStock) || newStock < 0) return toast.error("Masukkan angka valid!");
    
    setIsSubmitting(true);
    try {
      await updateStoreShelfStock(auditItem.storeId, auditItem.productName, newStock, user.name);
      toast.success(`Stok ${auditItem.productName} di ${auditItem.namaToko} → ${newStock} Pk`);
      setAuditItem(null);
      await loadData(user.id);
    } catch (error) {
      toast.error("Gagal memperbarui stok.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-20">
      <header className="mb-5 mt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">📊 Rute & Stok Toko</h1>
        <p className="text-xs text-slate-400 mt-1">
          Stok Bawaan Anda: <span className="text-emerald-400 font-bold">{sisaStok} Pack</span>
        </p>
      </header>

      {/* Search Bar with Autocomplete */}
      <div className="mb-5 relative" ref={searchRef}>
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
            <HiOutlineSearch size={18} />
          </div>
          <input 
            type="text"
            placeholder="Cari nama toko..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (searchTerm.trim().length > 0) setShowSuggestions(true); }}
            className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 pr-10 text-sm text-slate-200 focus:border-emerald-500 outline-none shadow-inner transition-colors placeholder:text-slate-600"
            autoComplete="off"
          />
          {searchTerm && (
            <button 
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 z-10"
            >
              <HiX size={16} />
            </button>
          )}
        </div>

        {/* Suggestion Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-dark-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
            <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
              {suggestions.map((store, idx) => {
                // Highlight the matching part of the store name
                const name = store.namaToko || "";
                const matchIdx = name.toLowerCase().indexOf(searchTerm.toLowerCase());
                const before = name.slice(0, matchIdx);
                const match = name.slice(matchIdx, matchIdx + searchTerm.length);
                const after = name.slice(matchIdx + searchTerm.length);

                return (
                  <button
                    key={store.storeId}
                    onClick={() => handleSuggestionClick(store)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all ${
                      idx === highlightedIndex 
                        ? 'bg-emerald-500/10 border-l-2 border-emerald-500' 
                        : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-sm shrink-0">
                      🏪
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {before}<span className="text-emerald-400 font-bold">{match}</span>{after}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        {store.products?.length || 0} produk · Drop: {Math.abs(store.totalDropped || 0)} Pk
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {suggestions.length < groupedStores.filter(s => s.namaToko?.toLowerCase().includes(searchTerm.toLowerCase())).length && (
              <div className="px-4 py-2 border-t border-slate-700/50 text-[9px] text-slate-500 text-center">
                Menampilkan {suggestions.length} dari {groupedStores.filter(s => s.namaToko?.toLowerCase().includes(searchTerm.toLowerCase())).length} hasil
              </div>
            )}
          </div>
        )}

        {/* No results hint */}
        {showSuggestions && searchTerm.trim().length > 0 && suggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-dark-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
            <div className="px-4 py-4 text-center">
              <span className="text-2xl mb-1 block">🔍</span>
              <p className="text-xs text-slate-500">Tidak ada toko dengan nama &ldquo;<span className="text-slate-400">{searchTerm}</span>&rdquo;</p>
            </div>
          </div>
        )}

        {/* Search result count badge */}
        {searchTerm.trim().length > 0 && !showSuggestions && (
          <p className="text-[10px] text-slate-500 mt-2 px-1">
            Menampilkan <span className="text-emerald-400 font-bold">{filteredStores.length}</span> dari {groupedStores.length} toko
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat data toko...</p>
        </div>
      ) : filteredStores.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredStores.map(store => (
            <div key={store.storeId} ref={el => storeRefs.current[store.storeId] = el} className="bg-dark-800 border border-slate-700 rounded-2xl overflow-hidden shadow-sm transition-all duration-500">
              {/* Store Header */}
              <div className="flex justify-between items-center p-4 pb-3 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center text-lg">🏪</div>
                  <div>
                    <h3 className="font-bold text-emerald-400 text-sm">{store.namaToko}</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Total drop: {Math.abs(store.totalDropped)} Pk</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleOpenRestock(store)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg active:scale-95 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-1"
                >
                  📦 <span>Isi Ulang</span>
                </button>
              </div>

              {/* Product List */}
              <div className="p-3">
                {store.products.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {store.products.map((prod, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-dark-900/60 p-3 rounded-xl border border-slate-700/30">
                        <div className="flex-1 pr-2">
                          <p className="text-xs font-bold text-white">{prod.productName}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            Drop: {Math.abs(prod.totalDropped)} Pk
                            {prod.lastAuditBy && <span className="text-amber-500"> · Audit: {prod.lastAuditBy}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Sisa Rak</p>
                            <p className="text-base font-black text-amber-400">{prod.currentStock}</p>
                          </div>
                          <button 
                            onClick={() => handleOpenAudit(store, prod)}
                            className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 active:scale-90 transition-all"
                            title="Update Sisa"
                          >
                            <span className="text-[10px]">🔄</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic text-center py-2">Belum ada data produk.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 opacity-50">
          {searchTerm.trim().length > 0 ? (
            <>
              <span className="text-5xl mb-4 block">🔍</span>
              <p className="text-sm text-slate-500 font-medium">Tidak ada toko bernama &ldquo;{searchTerm}&rdquo;</p>
              <button onClick={clearSearch} className="text-[10px] text-emerald-400 mt-2 underline underline-offset-2 hover:text-emerald-300 transition-colors">
                Hapus pencarian
              </button>
            </>
          ) : (
            <>
              <span className="text-5xl mb-4 block">📦</span>
              <p className="text-sm text-slate-500 font-medium">Belum ada aktivitas drop.</p>
              <p className="text-[10px] text-slate-600 mt-1">Mulai drop barang ke toko dari menu &quot;Daftar Toko&quot;.</p>
            </>
          )}
        </div>
      )}

      {/* ── MODAL POS CART SYSTEM (MULTI-ITEM DROP) ── */}
      {restockStore && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-[100] pb-0">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-blue-500 animate-slideIn max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  🛒 <span>Keranjang Drop Toko</span>
                </h2>
                <p className="text-[10px] text-slate-400">Toko Tujuan: <span className="text-emerald-400 font-bold">{restockStore.namaToko}</span></p>
              </div>
              <button 
                onClick={() => { setRestockStore(null); setCart([]); }} 
                className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4 flex flex-col gap-5">
              
              {/* SECTION 1: VISUAL CART LIST */}
              <div className="bg-dark-800/60 rounded-2xl border border-slate-700/50 p-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Isi Keranjang Belanja</h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">🛒</span>
                    <p className="text-xs italic">Keranjang kosong. Tambahkan barang di bawah.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {cart.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center bg-dark-900/80 p-3 rounded-xl border border-slate-700/30"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-xs font-bold text-white truncate">{item.productName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.jumlahDrop} Pk x Rp {item.hargaJual.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-extrabold text-blue-400">
                            Rp {item.total.toLocaleString('id-ID')}
                          </span>
                          <button 
                            type="button"
                            onClick={() => handleRemoveFromCart(item.productName)}
                            className="p-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/20 active:scale-90 transition-all flex items-center justify-center"
                            title="Hapus"
                          >
                            <HiX size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cart Subtotal callout */}
                {cart.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                    <div>
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Total Barang</p>
                      <p className="text-xs text-white font-extrabold">{cart.reduce((sum, item) => sum + item.jumlahDrop, 0)} Pk</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Grand Total</p>
                      <p className="text-base text-emerald-400 font-black">
                        Rp {cart.reduce((sum, item) => sum + item.total, 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: ADD ITEM FORM */}
              <div className="bg-dark-800/40 rounded-2xl border border-slate-700/30 p-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">➕ Tambah Barang Ke Keranjang</h3>
                
                <div className="mb-3">
                  <label className="block text-[9px] font-semibold text-slate-500 mb-1 tracking-wider uppercase">Merek Barang</label>
                  <select 
                    value={selectedBrand} 
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full bg-dark-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="">-- Pilih Merek --</option>
                    {Object.keys(carriedBrands).map(brand => {
                      const inCartItem = cart.find(item => item.productName === brand);
                      const displayQty = inCartItem 
                        ? `${carriedBrands[brand].sisa - inCartItem.jumlahDrop} Pk`
                        : `${carriedBrands[brand].sisa} Pk`;
                      const isOutOfStock = inCartItem && inCartItem.jumlahDrop >= carriedBrands[brand].sisa;
                      
                      return (
                        <option 
                          key={brand} 
                          value={brand}
                          disabled={isOutOfStock}
                        >
                          {brand} (Stok: {displayQty}) {isOutOfStock ? '[Penuh]' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {Object.keys(carriedBrands).length === 0 && (
                    <p className="text-[9px] text-rose-400 mt-1 italic">Anda belum memiliki stok bawaan. Hubungi admin.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1 tracking-wider uppercase">Jumlah (Pk)</label>
                    <input 
                      type="number" inputMode="numeric"
                      value={jumlahDrop}
                      onChange={(e) => setJumlahDrop(e.target.value)}
                      className="w-full bg-dark-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-blue-400 focus:border-blue-500 outline-none text-center"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-500 mb-1 tracking-wider uppercase">Harga Jual (Rp/Pk)</label>
                    <input 
                      type="text" inputMode="numeric"
                      value={hargaDrop}
                      onChange={(e) => {
                        const rawVal = e.target.value.replace(/\D/g, '');
                        if (!rawVal) {
                          setHargaDrop("");
                        } else {
                          setHargaDrop(parseInt(rawVal).toLocaleString('id-ID'));
                        }
                      }}
                      className="w-full bg-dark-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-emerald-400 focus:border-emerald-500 outline-none text-center"
                      placeholder="0"
                    />
                  </div>
                </div>

                {selectedBrand && (
                  <div className="mb-4 text-center">
                    <p className="text-[9px] text-slate-500">
                      {hargaReferensi > 0 
                        ? <>Harga Ambil: <span className="text-amber-400 font-bold">Rp {hargaReferensi.toLocaleString('id-ID')}</span> / Pk</>
                        : 'Sesuaikan harga jual'
                      }
                      {carriedBrands[selectedBrand] && (
                        <span className="block text-[8px] text-slate-600 mt-0.5">
                          Sisa stok bawaan Anda: {carriedBrands[selectedBrand].sisa} Pk
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <button 
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>➕ Tambah ke Keranjang</span>
                </button>
              </div>

              {/* Bluetooth Thermal Printer Toggle */}
              <div className="flex items-center justify-between bg-dark-800/30 p-3 rounded-xl border border-slate-700/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPrintEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-700 text-slate-500'}`}>
                    <HiOutlinePrinter size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white">Cetak Nota Fisik?</p>
                    <p className="text-[9px] text-slate-500">Gunakan printer bluetooth</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsPrintEnabled(!isPrintEnabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${isPrintEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPrintEnabled ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-800 shrink-0">
              <button 
                type="button" 
                onClick={() => { setRestockStore(null); setCart([]); }} 
                className="flex-1 py-3.5 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting} 
                className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Checkout ({cart.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUCCESS & PREMIUM STRUK DIGITAL (CONSOLIDATED RECEIPT) ── */}
      {lastDropData && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] p-4">
          <div className="bg-dark-900 w-full max-w-sm rounded-3xl p-6 border border-slate-700 text-center animate-zoomIn shadow-2xl relative overflow-hidden flex flex-col gap-5">
            {/* Glow background */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <HiCheckCircle className="text-emerald-500" size={36} />
              </div>
              
              <div>
                <h2 className="text-lg font-black text-white">Drop Toko Sukses!</h2>
                <p className="text-xs text-slate-400">Seluruh item berhasil dicatat secara batch.</p>
              </div>

              {/* Premium Market Paper Receipt Mockup */}
              <div className="bg-slate-100 text-slate-900 p-4 rounded-xl text-left font-mono text-[11px] shadow-inner relative border-b-4 border-dashed border-slate-300">
                <div className="text-center font-bold text-sm tracking-wider mb-1">DISTRILINK</div>
                <div className="text-center text-[9px] text-slate-500 uppercase tracking-widest mb-3">POS DIGITAL RECEIPT</div>
                
                <div className="flex flex-col gap-0.5 border-b border-dashed border-slate-400 pb-2 mb-2">
                  <p><span className="text-slate-500 font-bold">Nota :</span> {lastDropData.receiptId}</p>
                  <p><span className="text-slate-500 font-bold">Toko :</span> {lastDropData.namaToko}</p>
                  <p><span className="text-slate-500 font-bold">Tgl  :</span> {lastDropData.waktu.toLocaleString('id-ID')}</p>
                  <p><span className="text-slate-500 font-bold">Sls  :</span> {lastDropData.namaSales}</p>
                </div>

                <div className="flex flex-col gap-2 mb-3">
                  {lastDropData.items.map((item, idx) => (
                    <div key={idx}>
                      <p className="font-bold">{item.productName}</p>
                      <div className="flex justify-between text-slate-600">
                        <span>{item.jumlahDrop} Pk x Rp {item.hargaJual.toLocaleString('id-ID')}</span>
                        <span className="font-bold text-slate-800">Rp {item.total.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-400 pt-2 flex flex-col gap-0.5 font-bold">
                  <div className="flex justify-between text-slate-600 font-normal">
                    <span>Total Barang:</span>
                    <span>{lastDropData.totalQty} Pk</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-700 font-black mt-1">
                    <span>GRAND TOTAL:</span>
                    <span>Rp {lastDropData.grandTotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="text-center text-[8px] text-slate-400 mt-4 uppercase tracking-wider">
                  *** Terima Kasih Bosku ***
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-dark-900 font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <HiOutlinePrinter size={16} />
                  {isPrinting ? "Mencetak..." : "Cetak Nota Bluetooth"}
                </button>
                <button 
                  onClick={() => setLastDropData(null)}
                  className="w-full py-3.5 rounded-2xl bg-dark-800 border border-slate-700 text-slate-400 font-bold text-xs hover:text-white transition-all active:scale-95"
                >
                  Selesai & Tutup
                </button>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AUDIT STOK ── */}
      {auditItem && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-[100] pb-0">
          <div className="bg-dark-900 w-full max-w-md rounded-t-2xl p-5 border-t border-amber-500 animate-slideIn">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">🔄 Audit Stok</h2>
                <p className="text-[10px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{auditItem.productName}</span> di {auditItem.namaToko}
                </p>
              </div>
              <button onClick={() => setAuditItem(null)} className="text-slate-400 font-bold text-2xl px-2 hover:text-white transition-colors">&times;</button>
            </div>

            <div className="bg-dark-800 rounded-xl p-4 mb-5 border border-slate-700/50 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Stok Tercatat Sekarang</p>
              <p className="text-3xl font-black text-slate-500">{auditItem.currentStock} <span className="text-sm font-medium">Pk</span></p>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-medium text-slate-400 mb-2 text-center uppercase tracking-wider">Stok Fisik di Rak (Hasil Hitung)</label>
              <input 
                type="number" inputMode="numeric"
                value={auditQty}
                onChange={(e) => setAuditQty(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-4 text-3xl font-black text-amber-400 focus:border-amber-500 outline-none text-center shadow-inner"
                placeholder="0"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAuditItem(null)} className="flex-1 py-3.5 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all">
                Batal
              </button>
              <button onClick={handleAuditSubmit} disabled={isSubmitting} className="flex-1 py-3.5 rounded-xl bg-amber-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50">
                {isSubmitting ? "Menyimpan..." : "Simpan Audit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GPS COORDINATE PROMPT MODAL ── */}
      {gpsPrompt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[120] p-4">
          <div className="bg-dark-900 w-full max-w-sm rounded-2xl p-5 border border-slate-700 animate-slideIn shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                gpsPrompt.status === 'ok' ? 'bg-emerald-500/10' : gpsPrompt.status === 'failed' ? 'bg-amber-500/10' : 'bg-blue-500/10'
              }`}>
                <HiOutlineLocationMarker className={`${
                  gpsPrompt.status === 'ok' ? 'text-emerald-400' : gpsPrompt.status === 'failed' ? 'text-amber-400' : 'text-blue-400 animate-pulse'
                }`} size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Koordinat Belum Tersimpan</h3>
                <p className="text-[10px] text-slate-400">{gpsPrompt.namaToko}</p>
              </div>
            </div>

            <div className={`rounded-xl p-4 mb-4 border ${
              gpsPrompt.status === 'ok' ? 'bg-emerald-500/5 border-emerald-500/20' 
              : gpsPrompt.status === 'failed' ? 'bg-amber-500/5 border-amber-500/20' 
              : 'bg-blue-500/5 border-blue-500/20'
            }`}>
              {gpsPrompt.status === 'loading' && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-xs text-blue-400 font-bold">Mendeteksi lokasi Anda...</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Pastikan GPS aktif</p>
                  </div>
                </div>
              )}

              {gpsPrompt.status === 'ok' && gpsPrompt.coords && (
                <div>
                  <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider mb-1">📍 Koordinat Terdeteksi</p>
                  <p className="text-sm font-mono font-bold text-emerald-400">
                    {gpsPrompt.coords.lat.toFixed(6)}, {gpsPrompt.coords.lng.toFixed(6)}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-2">Simpan koordinat ini sebagai lokasi toko?</p>
                </div>
              )}

              {gpsPrompt.status === 'failed' && (
                <div>
                  <p className="text-xs text-amber-400 font-bold">⚠️ GPS tidak dapat mendeteksi lokasi</p>
                  <p className="text-[9px] text-slate-500 mt-1">Koordinat bisa diisi nanti. Anda tetap bisa lanjut drop barang.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleGpsSkip}
                className="flex-1 py-3 rounded-xl bg-dark-800 border border-slate-700 text-xs text-slate-400 font-bold active:scale-95 transition-all"
              >
                {gpsPrompt.status === 'failed' ? 'Lanjut Tanpa GPS' : 'Lewati'}
              </button>
              {gpsPrompt.status === 'ok' && gpsPrompt.coords && (
                <button 
                  onClick={handleGpsSave}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-emerald-900/30"
                >
                  ✅ Simpan Koordinat
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
