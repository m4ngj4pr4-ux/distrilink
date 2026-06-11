"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSalesList, verifySalesLogin } from "@/lib/firestore";
import toast from "react-hot-toast";
import { HiOutlineLockClosed } from "react-icons/hi";

export default function SalesLogin() {
  const [salesList, setSalesList] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchSales() {
      try {
        const list = await getSalesList();
        setSalesList(list);
      } catch (error) {
        console.error("Gagal memuat daftar sales", error);
      }
    }
    fetchSales();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedName || !pin) {
      return toast.error("Pilih nama dan masukkan PIN!");
    }
    
    setLoading(true);
    try {
      const user = await verifySalesLogin(selectedName, pin);
      if (user) {
        localStorage.setItem("sales_user", JSON.stringify(user));
        toast.success(`Selamat datang, ${user.name}!`);
        router.replace("/sales");
      } else {
        toast.error("PIN salah!");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col items-center justify-center w-full animate-fadeIn min-h-[80vh]">
      <div className="w-28 h-28 mb-8 rounded-[32px] overflow-hidden shadow-2xl border border-emerald-500/20 bg-dark-800 relative group">
        <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay group-hover:bg-transparent transition-all"></div>
        <img src="/icon.png" alt="DistriLink Logo" className="w-full h-full object-cover" />
      </div>
      
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black text-white mb-1 tracking-tight">Distri<span className="text-emerald-500">Link</span></h1>
        <p className="text-[10px] text-emerald-500/70 uppercase tracking-[0.25em] font-black">Field Sales App</p>
      </div>

      <form onSubmit={handleLogin} className="w-full space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Pengguna (Sales / Admin Gudang)</label>
          <select 
            value={selectedName} 
            onChange={(e) => setSelectedName(e.target.value)} 
            className="input-field w-full text-sm"
          >
            <option value="">— Pilih Nama —</option>
            {salesList.map(sales => (
              <option key={sales.id} value={sales.name}>{sales.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">PIN (6 Digit)</label>
          <input 
            type="password" 
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input-field w-full text-center tracking-[0.5em] text-lg font-mono"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 text-sm font-bold uppercase tracking-widest"
        >
          {loading ? "Memverifikasi..." : "Masuk ke Sistem"}
        </button>
      </form>
    </div>
  );
}
