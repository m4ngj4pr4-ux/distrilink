"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamMembersForCaptain, getSalesCarriedBrands, captainDistributeStock, subscribeCaptainDistributions } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function CaptainDistribusiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [carriedBrands, setCarriedBrands] = useState({});
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("Pk");
  const [pricePerPack, setPricePerPack] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'captain') {
      toast.error("Akses ditolak. Hanya Captain.");
      return router.push('/sales');
    }
    
    setUser(parsedUser);
    loadData(parsedUser.id);
    
    const unsub = subscribeCaptainDistributions(parsedUser.id, setHistory);
    return () => unsub();
  }, [router]);

  const loadData = async (captainId) => {
    setIsLoading(true);
    const [members, brands] = await Promise.all([
      getTeamMembersForCaptain(captainId),
      getSalesCarriedBrands(captainId)
    ]);
    setTeamMembers(members);
    setCarriedBrands(brands);
    setIsLoading(false);
  };

  // Auto-fill price when brand changes
  useEffect(() => {
    if (selectedBrand && carriedBrands[selectedBrand]) {
      const price = carriedBrands[selectedBrand].sellingPrice || 0;
      setPricePerPack(price > 0 ? price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");
    } else {
      setPricePerPack("");
    }
  }, [selectedBrand, carriedBrands]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const brandData = carriedBrands[selectedBrand];
    if (!brandData) return toast.error("Pilih merek barang!");

    const rawQty = parseFloat(qty) || 0;
    const price = parseInt(pricePerPack.replace(/\D/g, "")) || 0;
    
    // Konversi ke pack
    let totalPacks = rawQty;
    if (unit === "Ct") totalPacks = rawQty * (brandData.packsPerCt || 800);
    if (unit === "Bal") totalPacks = rawQty * (brandData.packsPerBal || 100);
    if (unit === "Slop") totalPacks = rawQty * (brandData.packsPerSlop || 10);
    
    totalPacks = Math.round(totalPacks);

    if (!selectedMember) return toast.error("Pilih anggota tim!");
    if (!totalPacks || totalPacks <= 0) return toast.error("Masukkan jumlah yang valid!");
    if (!price || price <= 0) return toast.error("Masukkan harga per pack!");
    
    if (totalPacks > brandData.sisa) {
      return toast.error(`Stok ${selectedBrand} Anda hanya ${brandData.sisa} Pk! (Input: ${totalPacks} Pk)`);
    }

    const member = teamMembers.find(m => m.id === selectedMember);
    if (!member) return toast.error("Anggota tim tidak valid!");

    setIsSubmitting(true);
    try {
      await captainDistributeStock({
        captainId: user.id,
        captainName: user.name,
        targetTeamId: member.id,
        targetTeamName: member.name,
        productId: brandData.productId,
        productName: selectedBrand,
        totalPacks: totalPacks,
        pricePerPack: price,
        qtyOriginal: rawQty,
        unit: unit
      });
      
      toast.success(`${rawQty} ${unit} ${selectedBrand} (${totalPacks} Pk) berhasil didistribusikan ke ${member.name}!`);
      setSelectedMember("");
      setSelectedBrand("");
      setQty("");
      setUnit("Pk");
      setPricePerPack("");
      
      // Refresh brands
      const brands = await getSalesCarriedBrands(user.id);
      setCarriedBrands(brands);
    } catch (error) {
      toast.error("Gagal mendistribusikan barang.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (val) => {
    const num = val.toString().replace(/\D/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  if (!user) return null;

  return (
    <div className="p-4 pb-20 animate-fadeIn">
      <header className="mb-5 mt-2">
        <button onClick={() => router.back()} className="text-xs text-slate-500 mb-2 hover:text-white transition-colors">← Kembali</button>
        <h1 className="text-xl font-bold text-white tracking-tight">🔄 Distribusi ke Tim</h1>
        <p className="text-xs text-slate-400 mt-1">Bagikan stok bawaan Anda ke anggota tim sales</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat data tim...</p>
        </div>
      ) : (
        <>
          {/* Stock Summary */}
          <div className="bg-dark-800 border border-slate-700 rounded-xl p-4 mb-5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Stok Bawaan Anda</p>
            {Object.keys(carriedBrands).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(carriedBrands).map(([name, data]) => (
                  <div key={name} className="bg-dark-900 border border-slate-700/50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400">{name}</p>
                    <p className="text-sm font-black text-emerald-400">{data.sisa} <span className="text-[9px] font-medium text-slate-500">Pk</span></p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Tidak ada stok. Hubungi admin.</p>
            )}
          </div>

          {/* Distribution Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-400 mb-3">📋 Form Distribusi</p>
              
              <div className="mb-3">
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Pilih Anggota Tim</label>
                <select 
                  value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Pilih Sales --</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Pilih Merek Barang</label>
                <select 
                  value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Pilih Merek --</option>
                  {Object.entries(carriedBrands).map(([name, data]) => (
                    <option key={name} value={name}>{name} (Sisa: {data.sisa} Pk)</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Jumlah</label>
                    <input 
                      type="number" step="any" inputMode="decimal" value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-amber-400 focus:border-amber-500 outline-none text-center"
                      placeholder="0" required
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Satuan</label>
                    <select 
                      value={unit} onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 h-[54px]"
                      required
                    >
                      <option value="Ct">Ct</option>
                      <option value="Bal">Bal</option>
                      <option value="Slop">Slop</option>
                      <option value="Pk">Pk</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Harga/Pack (Rp)</label>
                <input 
                  type="text" inputMode="numeric" value={pricePerPack}
                  onChange={(e) => setPricePerPack(formatRupiah(e.target.value))}
                  className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-white focus:border-amber-500 outline-none text-center"
                  placeholder="0" required
                />
              </div>

              {selectedBrand && qty && pricePerPack && (
                <div className="bg-dark-900 rounded-lg p-3 border border-slate-700/50 mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Total Pack</p>
                    <p className="text-[10px] font-bold text-amber-400">
                      {unit !== "Pk" ? `${qty} ${unit} = ` : "" }
                      {Math.round(parseFloat(qty) * (unit === "Ct" ? carriedBrands[selectedBrand]?.packsPerCt : unit === "Bal" ? carriedBrands[selectedBrand]?.packsPerBal : unit === "Slop" ? carriedBrands[selectedBrand]?.packsPerSlop : 1))} Pk
                    </p>
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Total Nilai Distribusi</p>
                  <p className="text-xl font-black text-white">
                    Rp {(
                      Math.round(parseFloat(qty) * (unit === "Ct" ? carriedBrands[selectedBrand]?.packsPerCt : unit === "Bal" ? carriedBrands[selectedBrand]?.packsPerBal : unit === "Slop" ? carriedBrands[selectedBrand]?.packsPerSlop : 1)) * 
                      (parseInt(pricePerPack.replace(/\D/g, "")) || 0)
                    ).toLocaleString('id-ID')}
                  </p>
                </div>
              )}

              <button 
                type="submit" disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold active:scale-[0.98] transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50"
              >
                {isSubmitting ? "Mendistribusikan..." : "Konfirmasi Distribusi"}
              </button>
            </div>
          </form>

          {/* History Distributions */}
          <div className="mt-6">
            <h2 className="text-sm font-bold text-white mb-3 tracking-tight">📜 Riwayat Distribusi</h2>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-dark-800 p-4 rounded-xl border border-slate-700/50 text-center">Belum ada riwayat distribusi ke tim.</p>
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="bg-dark-800 rounded-xl p-3 border border-slate-700/50 flex flex-col gap-1.5">
                    <div className="flex justify-between items-start">
                      <p className="text-[11px] font-bold text-slate-300">Kepada: <span className="text-amber-400">{item.teamName}</span></p>
                      <p className="text-[9px] text-slate-500">
                        {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                      </p>
                    </div>
                    <div className="flex justify-between items-center bg-dark-900 rounded p-2 border border-slate-700/30">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <p className="text-[10px] font-bold text-white">{item.productName}</p>
                      </div>
                      <p className="text-xs font-black text-emerald-400">{item.totalPacksDistributed} <span className="text-[9px] font-medium text-slate-500">Pk</span></p>
                    </div>
                    <p className="text-[9px] text-slate-500 text-right mt-1">Nilai: <span className="font-bold text-white">Rp {item.amount?.toLocaleString('id-ID')}</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
