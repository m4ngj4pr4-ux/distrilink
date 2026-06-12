"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addSetoranDana, getRiwayatSetoran, getSalesProfile, getSalesHistory, updateSalesTeam, uploadProfilePicture, getDroppingHistory } from '@/lib/firestore';
import toast from 'react-hot-toast';
import { printer } from '@/lib/printer';
import { HiOutlinePrinter, HiOutlineLogout, HiOutlineCash, HiOutlineShoppingBag, HiX } from 'react-icons/hi';

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
  
  // Sales History States
  const [riwayatPenjualan, setRiwayatPenjualan] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);

  // Admin Dropping History States
  const [riwayatDropping, setRiwayatDropping] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  // Edit Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('sales_user');
    if (!storedUser) return router.push('/sales/login');
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    setEditName(parsedUser.name);
    setEditPin(parsedUser.pin || "");
    setEditPhone(parsedUser.phone || "");
    
    // Fetch data based on role
    if (parsedUser.role === 'admin_gudang') {
      getDroppingHistory().then(setRiwayatDropping);
      getSalesProfile(parsedUser.id).then(setProfileData);
    } else {
      getRiwayatSetoran(parsedUser.id).then(setRiwayatSetoran);
      getSalesProfile(parsedUser.id).then(setProfileData);
      getSalesHistory(parsedUser.id).then(setRiwayatPenjualan);
    }
  }, [router]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user?.id) return toast.error("Sesi berakhir, silakan login ulang");
    
    setIsSaving(true);
    try {
      let photoURL = profileData?.photoURL || user.photoURL || "";
      
      if (selectedFile) {
        toast.loading("Mengunggah foto...", { id: "upload" });
        try {
          photoURL = await uploadProfilePicture(user.id, selectedFile);
          toast.success("Foto berhasil diunggah!", { id: "upload" });
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Gagal mengunggah foto", { id: "upload" });
          setIsSaving(false);
          return;
        }
      }

      const updatedData = {
        name: editName || user.name,
        pin: editPin || user.pin || "",
        phone: editPhone || user.phone || "",
        photoURL: photoURL || ""
      };

      await updateSalesTeam(user.id, updatedData);
      
      // Update Local Storage for Sidebar/Navbar sync
      const newUser = { ...user, ...updatedData };
      localStorage.setItem('sales_user', JSON.stringify(newUser));
      setUser(newUser);
      setProfileData(prev => ({ ...prev, ...updatedData }));
      
      toast.success("Profil berhasil diperbarui!");
      setIsEditModalOpen(false);
      setSelectedFile(null);
      
      // Force refresh data to sync UI
      getSalesProfile(user.id).then(setProfileData);
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Gagal memperbarui profil: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

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
      
      const msg = (metodeSetor === "Tunai ke Captain" || metodeSetor === "Tunai ke Admin Gudang") 
        ? "Laporan terkirim! Serahkan uang tunai ke Admin Gudang / Captain."
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

  const groupTransactionsByReceipt = (txs) => {
    const groups = {};
    txs.forEach(tx => {
      const rid = tx.receiptId || tx.id;
      if (!groups[rid]) {
        groups[rid] = {
          receiptId: tx.receiptId || null,
          id: rid,
          namaToko: tx.namaToko,
          namaSales: tx.namaSales,
          waktu: tx.waktu,
          storeId: tx.storeId,
          teamId: tx.teamId,
          items: []
        };
      }
      groups[rid].items.push({
        productId: tx.productId,
        productName: tx.productName,
        jumlahDrop: tx.jumlahDrop,
        hargaJual: tx.hargaJual,
        total: tx.total || (tx.jumlahDrop * tx.hargaJual)
      });
    });

    return Object.values(groups).sort((a, b) => {
      const timeA = a.waktu?.toMillis ? a.waktu.toMillis() : (a.waktu?.toDate ? a.waktu.toDate().getTime() : 0);
      const timeB = b.waktu?.toMillis ? b.waktu.toMillis() : (b.waktu?.toDate ? b.waktu.toDate().getTime() : 0);
      return timeB - timeA;
    });
  };

  const handlePrint = async (receipt) => {
    setIsPrinting(true);
    try {
      toast.loading("Menghubungkan ke printer...", { id: "print-toast" });
      await printer.connect();
      toast.loading("Mencetak nota...", { id: "print-toast" });

      const receiptData = {
        receiptId: receipt.receiptId || `Nota-${receipt.id.slice(-6).toUpperCase()}`,
        namaToko: receipt.namaToko,
        waktu: receipt.waktu ? (receipt.waktu.toDate ? receipt.waktu.toDate() : new Date(receipt.waktu)) : new Date(),
        namaSales: receipt.namaSales,
        items: receipt.items,
        grandTotal: receipt.items.reduce((sum, item) => sum + item.total, 0),
        totalQty: receipt.items.reduce((sum, item) => sum + item.jumlahDrop, 0)
      };

      await printer.printMultiItemReceipt(receiptData);
      toast.success("Nota berhasil dicetak!", { id: "print-toast" });
    } catch (error) {
      console.error(error);
      toast.error("Gagal cetak: " + error.message, { id: "print-toast" });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!user) return null;

  const hutang = profileData ? (profileData.goodsDropped || 0) - (profileData.totalDeposited || 0) : 0;

  const totalSelesai = riwayatSetoran
    .filter(item => item.status === "Diverifikasi Admin" || item.status === "Selesai (Sistem Lama)")
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const totalProses = riwayatSetoran
    .filter(item => item.status !== "Diverifikasi Admin" && item.status !== "Selesai (Sistem Lama)")
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const filteredDropping = riwayatDropping.filter(item => {
    if (!item.createdAt) return true;
    const date = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    
    // Filter harian YYYY-MM-DD
    if (filterDate) {
      const targetDate = new Date(filterDate);
      if (
        date.getDate() !== targetDate.getDate() ||
        date.getMonth() !== targetDate.getMonth() ||
        date.getFullYear() !== targetDate.getFullYear()
      ) {
        return false;
      }
    }
    
    // Filter bulanan YYYY-MM
    if (filterMonth) {
      const [year, month] = filterMonth.split("-");
      if (
        date.getFullYear() !== parseInt(year) ||
        (date.getMonth() + 1) !== parseInt(month)
      ) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="p-4 pb-24 animate-fadeIn max-w-md mx-auto">
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-black text-white tracking-tight">Profil & Riwayat</h1>
      </header>

      {/* Profile Card */}
      <div className="bg-dark-800 border border-slate-700 p-6 rounded-3xl mb-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-10 -mt-10 blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl transform rotate-2 bg-dark-900 border-2 border-emerald-500/30 flex items-center justify-center shrink-0">
            {profileData?.photoURL || user.photoURL ? (
              <img src={profileData?.photoURL || user.photoURL} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-white">{user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-white leading-tight truncate">{profileData?.name || user.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                ID: {user.id.slice(-6).toUpperCase()}
              </div>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="text-[9px] font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest border-b border-blue-400/30 pb-0.5"
              >
                Edit Profil
              </button>
            </div>
          </div>
        </div>
        
        {profileData && user.role !== 'admin_gudang' && (
          <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-between items-center gap-3 relative z-10">
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1.5">Tagihan Berjalan</p>
              <p className={`text-xl sm:text-2xl font-black tracking-tight whitespace-nowrap ${hutang > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                Rp {hutang.toLocaleString('id-ID')}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 ${hutang > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-400"}`}>
              {hutang > 0 ? "Belum Lunas" : "Lunas"}
            </div>
          </div>
        )}
      </div>

      {/* Action: Setoran (Sales/Captain only) */}
      {user.role !== 'admin_gudang' && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
            <h3 className="font-black text-white text-xs uppercase tracking-widest">Manajemen Keuangan</h3>
          </div>
          
          <div className="bg-dark-800 border border-slate-700 p-5 rounded-3xl shadow-lg">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                <HiOutlineCash size={24} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Laporan Setoran</p>
                <p className="text-xs text-slate-300">Setorkan uang penjualan ke pusat</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSetorModalOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black py-4 rounded-2xl transition-all text-xs shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2"
            >
              Buat Laporan Setoran
            </button>
          </div>
        </section>
      )}

      {/* History: Setoran (Sales/Captain only) */}
      {user.role !== 'admin_gudang' && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
            <h3 className="font-black text-white text-xs uppercase tracking-widest">Riwayat Setoran</h3>
          </div>

          {riwayatSetoran.length > 0 && (
            <div className="bg-dark-800 border border-slate-700/50 p-4 rounded-2xl mb-4 flex justify-between gap-4 shadow-md">
              <div className="flex-1">
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider mb-1">Total Terverifikasi</p>
                <p className="text-sm font-black text-emerald-400">Rp {totalSelesai.toLocaleString('id-ID')}</p>
              </div>
              <div className="w-px bg-slate-700/50 my-1"></div>
              <div className="flex-1">
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider mb-1">Total Diproses</p>
                <p className="text-sm font-black text-amber-400">Rp {totalProses.toLocaleString('id-ID')}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {riwayatSetoran.length > 0 ? (
              riwayatSetoran.slice(0, 50).map(item => (
                <div key={item.id} className="flex justify-between items-center bg-dark-800/40 p-4 rounded-2xl border border-slate-700/30">
                  <div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">
                      {item.waktu ? new Date(item.waktu.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Baru saja'}
                    </p>
                    <p className="text-[10px] text-slate-300 font-medium truncate max-w-[150px]">{item.catatan}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-400">Rp {item.nominal?.toLocaleString('id-ID')}</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter mt-1 inline-block ${
                      item.status === "Diverifikasi Admin" || item.status === "Selesai (Sistem Lama)" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {item.status === "Diverifikasi Admin" || item.status === "Selesai (Sistem Lama)" ? "Selesai" : "Proses"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-dark-800/30 rounded-3xl border border-dashed border-slate-700">
                <p className="text-xs text-slate-500 font-medium">Belum ada riwayat setoran.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* History: Penjualan (Sales/Captain only) */}
      {user.role !== 'admin_gudang' && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
            <h3 className="font-black text-white text-xs uppercase tracking-widest">Riwayat Penjualan</h3>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {groupTransactionsByReceipt(riwayatPenjualan).length > 0 ? (
              groupTransactionsByReceipt(riwayatPenjualan).slice(0, 50).map(receipt => {
                const totalQty = receipt.items.reduce((sum, i) => sum + i.jumlahDrop, 0);
                const grandTotal = receipt.items.reduce((sum, i) => sum + i.total, 0);
                
                return (
                  <div key={receipt.id} className="bg-dark-800 border border-slate-700/50 p-4 rounded-3xl flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-dark-900 rounded-2xl flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                      🏪
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                          {receipt.waktu ? new Date(receipt.waktu.toDate()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Baru saja'}
                        </p>
                        {receipt.receiptId && (
                          <span className="text-[8px] bg-slate-700/55 text-slate-400 px-1 py-0.2 rounded font-mono">
                            {receipt.receiptId.slice(-6)}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-black text-white truncate uppercase">{receipt.namaToko}</h4>
                      <p className="text-[10px] text-emerald-400 font-medium mt-1 truncate">
                        {receipt.items.map(i => `${i.productName} (${i.jumlahDrop} Pk)`).join(', ')}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                        Total: Rp {grandTotal.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <button 
                      onClick={() => handlePrint(receipt)}
                      disabled={isPrinting}
                      className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 active:scale-90 transition-all shrink-0"
                      title="Cetak Nota"
                    >
                      <HiOutlinePrinter size={18} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 bg-dark-800/30 rounded-3xl border border-dashed border-slate-700">
                <p className="text-xs text-slate-500 font-medium">Belum ada riwayat penjualan.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* History: Dropping (Admin Gudang Only) */}
      {user.role === 'admin_gudang' && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
              <h3 className="font-black text-white text-xs uppercase tracking-widest">Riwayat Dropping</h3>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">
              {filteredDropping.length} Item
            </span>
          </div>

          {/* Filter Bar */}
          <div className="bg-dark-800 border border-slate-700/50 p-4 rounded-2xl mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-black mb-1">Cek Harian</label>
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setFilterMonth("");
                  }}
                  className="w-full bg-dark-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] text-white focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] uppercase tracking-wider text-slate-500 font-black mb-1">Cek Bulanan</label>
                <input 
                  type="month"
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    setFilterDate("");
                  }}
                  className="w-full bg-dark-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            {(filterDate || filterMonth) && (
              <button 
                onClick={() => {
                  setFilterDate("");
                  setFilterMonth("");
                }}
                className="w-full py-2 bg-dark-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest transition-all"
              >
                🔄 Reset Filter
              </button>
            )}
          </div>

          {/* Dropping List */}
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredDropping.length > 0 ? (
              filteredDropping.slice(0, 50).map(item => {
                const dateObj = item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt)) : null;
                const formattedDate = dateObj ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Baru saja';
                
                return (
                  <div key={item.id} className="bg-dark-800 border border-slate-700/50 p-4 rounded-3xl flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-dark-900 rounded-2xl flex items-center justify-center text-xl shrink-0">
                      📦
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                          {formattedDate}
                        </p>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                          Drop
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-white truncate uppercase">{item.teamName || 'Sales Agent'}</h4>
                      <p className="text-[10px] text-amber-400 font-medium mt-1 truncate">
                        {item.productName} ({item.qtyOriginal} {item.unit})
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                        Nilai: Rp {(item.amount || 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 bg-dark-800/30 rounded-3xl border border-dashed border-slate-700">
                <p className="text-xs text-slate-500 font-medium">Tidak ada riwayat dropping.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Logout */}
      <button 
        onClick={handleLogout}
        className="w-full bg-rose-500/5 hover:bg-rose-500/10 active:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-black py-4 rounded-3xl transition-all text-xs flex justify-center items-center gap-2"
      >
        <HiOutlineLogout size={18} /> 
        KELUAR APLIKASI
      </button>

      <div className="mt-12 text-center">
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">DistriLink v1.3.0</p>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-[120] pb-0">
          <div className="bg-dark-900 w-full max-w-md rounded-t-3xl p-8 border-t border-slate-700 animate-slideIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-white tracking-tight">Edit Profil</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <HiX size={24}/>
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-4 mb-2">
                <div className="w-24 h-24 rounded-3xl overflow-hidden bg-dark-800 border-2 border-slate-700 relative group cursor-pointer" onClick={() => document.getElementById('photoInput').click()}>
                  <img 
                    src={selectedFile ? URL.createObjectURL(selectedFile) : (profileData?.photoURL || user.photoURL)} 
                    className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" 
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[9px] font-black text-white text-center px-2">GANTI FOTO</p>
                  </div>
                </div>
                <input 
                  id="photoInput"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Klik foto untuk mengganti</p>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none"
                  placeholder="Nama Anda"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">PIN Keamanan (Password)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0,6))}
                  className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none font-mono tracking-widest"
                  placeholder="PIN 6 Digit"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">No Telepon / WhatsApp</label>
                <input 
                  type="tel" 
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none"
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving} 
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 mt-4"
              >
                {isSaving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Setoran Modal */}
      {isSetorModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-[100] pb-0">
          <div className="bg-dark-900 w-full max-w-md rounded-t-3xl p-8 border-t border-slate-700 animate-slideIn">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-white tracking-tight">Lapor Setoran</h2>
              <button onClick={() => setIsSetorModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <HiX size={24}/>
              </button>
            </div>
            
            <form onSubmit={handleSetorSubmit}>
              <div className="mb-6">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">Nominal Setoran (Rp)</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-black text-lg">Rp</span>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={nominalSetor}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setNominalSetor(val ? parseInt(val).toLocaleString('id-ID') : "");
                    }}
                    className="w-full bg-dark-800 border border-slate-700 rounded-2xl py-5 pl-14 pr-5 text-3xl font-black text-emerald-400 focus:border-emerald-500 outline-none shadow-inner"
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">Metode Pembayaran</label>
                <select 
                  value={metodeSetor}
                  onChange={(e) => setMetodeSetor(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 outline-none"
                >
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="Tunai ke Admin Gudang">Tunai ke Admin Gudang (Warehouse)</option>
                </select>
              </div>

              <div className="mb-10">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-3">Catatan / Bukti (Opsional)</label>
                <input 
                  type="text" 
                  value={catatanSetor}
                  onChange={(e) => setCatatanSetor(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder={metodeSetor === "Transfer Bank" ? "Contoh: Transfer via BCA" : "Contoh: Serah terima di kantor"}
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50"
              >
                {isSubmitting ? 'MENGIRIM...' : 'KONFIRMASI SETORAN'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
