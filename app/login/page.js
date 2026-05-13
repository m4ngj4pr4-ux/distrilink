"use client";

import { useState } from "react";
import { adminLogin } from "@/lib/firestore";
import { useAdminAuth } from "@/lib/AdminAuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await adminLogin(email, password);
      if (user) {
        toast.success(`Selamat datang, ${user.nama}!`);
        login(user);
      } else {
        toast.error("Email atau password salah.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 p-4">
      <div className="glass-card w-full max-w-md p-8 animate-fadeIn relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500 opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500 opacity-10 rounded-full blur-3xl"></div>

        <div className="relative z-10 text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <img src="/icon.png" alt="Logo" className="w-12 h-12 object-contain rounded-lg" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Distri<span className="text-blue-500">Link</span></h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold mt-2">Executive & Sales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-dark-800/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all shadow-inner"
              placeholder="admin@distrilink.com"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-800/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all shadow-inner"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
          >
            {loading ? "Mengecek Sesi..." : "Masuk ke Dashboard"}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-500 mt-8 uppercase tracking-[0.2em]">
          Secure Access Protocol v2.0
        </p>
      </div>
    </div>
  );
}
