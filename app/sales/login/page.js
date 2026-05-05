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
        toast.success(`Selamat datang, ${user.nama}!`);
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
    <div className="p-6 flex flex-col items-center justify-center w-full animate-fadeIn">
      <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 text-blue-400">
        <HiOutlineLockClosed size={32} />
      </div>
      
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Portal Sales</h1>
        <p className="text-sm text-slate-400">Masuk untuk mengelola rute dan stok Anda</p>
      </div>

      <form onSubmit={handleLogin} className="w-full space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Sales</label>
          <select 
            value={selectedName} 
            onChange={(e) => setSelectedName(e.target.value)} 
            className="input-field w-full text-sm"
          >
            <option value="">— Pilih Nama —</option>
            {salesList.map(sales => (
              <option key={sales.id} value={sales.nama}>{sales.nama}</option>
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
          className="btn-primary w-full py-3 mt-4 text-sm font-bold"
        >
          {loading ? "Memverifikasi..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
