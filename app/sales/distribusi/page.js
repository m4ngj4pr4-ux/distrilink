"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamMembersForCaptain, getSalesCarriedBrands, captainDistributeStock } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function CaptainDistribusiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [carriedBrands, setCarriedBrands] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Form
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [qty, setQty] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const packs = parseInt(qty);
    const price = parseInt(pricePerPack.replace(/\D/g, "")) || 0;
    
    if (!selectedMember) return toast.error("Pilih anggota tim!");
    if (!selectedBrand) return toast.error("Pilih merek barang!");
    if (!packs || packs <= 0) return toast.error("Masukkan jumlah yang valid!");
    if (!price || price <= 0) return toast.error("Masukkan harga per pack!");
    
    const brandData = carriedBrands[selectedBrand];
    if (!brandData) return toast.error("Merek tidak ditemukan!");
    if (packs > brandData.sisa) return toast.error(`Stok ${selectedBrand} Anda hanya ${brandData.sisa} Pk!`);

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
        totalPacks: packs,
        pricePerPack: price
      });
      
      toast.success(`${packs} Pk ${selectedBrand} berhasil didistribusikan ke ${member.name}!`);
      setSelectedMember("");
      setSelectedBrand("");
      setQty("");
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
    const num = val.replace(/\D/g, "");
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
                    <option key={name} value={name}>{name} (Tersisa: {data.sisa} Pk)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Jumlah (Pack)</label>
                  <input 
                    type="number" inputMode="numeric" value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-amber-400 focus:border-amber-500 outline-none text-center"
                    placeholder="0" required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Harga/Pack (Rp)</label>
                  <input 
                    type="text" inputMode="numeric" value={pricePerPack}
                    onChange={(e) => setPricePerPack(formatRupiah(e.target.value))}
                    className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-white focus:border-amber-500 outline-none text-center"
                    placeholder="0" required
                  />
                </div>
              </div>

              {selectedBrand && qty && pricePerPack && (
                <div className="bg-dark-900 rounded-lg p-3 border border-slate-700/50 mb-3">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Total Nilai Distribusi</p>
                  <p className="text-xl font-black text-white">
                    Rp {((parseInt(qty) || 0) * (parseInt(pricePerPack.replace(/\D/g, "")) || 0)).toLocaleString('id-ID')}
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
        </>
      )}
    </div>
  );
}
