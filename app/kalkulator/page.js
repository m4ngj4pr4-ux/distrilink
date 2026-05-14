"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import HPPCalculator from "@/components/HPPCalculator";
import { useAdminAuth } from "@/lib/AdminAuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function KalkulatorPage() {
  const { adminUser, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !adminUser) {
      router.push("/login");
    }
  }, [adminUser, loading, router]);

  if (loading || !adminUser) {
    return (
      <div className="h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-dark-900 text-slate-200 overflow-hidden font-sans">
      <Sidebar 
        activeSection="kalkulator" 
        onNavigate={(section) => router.push(`/?section=${section}`)} 
      />
      
      <main className="flex-1 overflow-y-auto custom-scrollbar relative p-4 md:p-8 pt-[80px] md:pt-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">Kalkulator HPP</h1>
          <p className="text-slate-400 text-xs mt-1">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </header>
        
        <div className="animate-fadeIn">
          <HPPCalculator />
        </div>
      </main>
    </div>
  );
}
