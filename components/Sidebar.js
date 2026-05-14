"use client";

import { useState } from "react";
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineUserGroup,
  HiOutlineCube,
  HiOutlineCog,
  HiOutlineMenuAlt2,
  HiOutlineX,
  HiOutlineClipboardList,
  HiOutlineReply,
  HiOutlineTrendingUp,
  HiOutlineLocationMarker,
  HiOutlineCash,
  HiOutlineCalculator
} from "react-icons/hi";

import { useAdminAuth } from "@/lib/AdminAuthContext";
import { HiOutlineLogout } from "react-icons/hi";

const ALL_NAV_ITEMS = [
  { icon: HiOutlineHome, label: "Dashboard", id: "dashboard", roles: ["owner", "admin", "investor"] },
  { icon: HiOutlineCalculator, label: "Kalkulator HPP", id: "kalkulator", roles: ["owner", "admin"] },
  { icon: HiOutlineDocumentText, label: "PO Pabrik", id: "po", roles: ["owner", "investor"] },
  { icon: HiOutlineClipboardList, label: "Riwayat PO", id: "po-history", roles: ["owner", "investor"] },
  { icon: HiOutlineCube, label: "Stok Barang", id: "stock", roles: ["owner", "admin", "investor"] },
  { icon: HiOutlineTrendingUp, label: "Laba Rugi", id: "laba-rugi", roles: ["owner", "investor"] },
  { icon: HiOutlineCash, label: "Keuangan", id: "keuangan", roles: ["owner", "investor"] },
  { icon: HiOutlineUserGroup, label: "Buku Penjualan", id: "sales", roles: ["owner", "admin", "investor"] },
  { icon: HiOutlineLocationMarker, label: "Pemasaran Retail", id: "retail", roles: ["owner", "admin", "investor"] },
  { icon: HiOutlineReply, label: "Retur Barang", id: "returns", roles: ["owner", "investor"] },
  { icon: HiOutlineCog, label: "Pengaturan", id: "settings", roles: ["owner"] },
];

export default function Sidebar({ activeSection, onNavigate, pendingCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { adminUser, logout } = useAdminAuth();

  const navItems = ALL_NAV_ITEMS.filter(item => 
    item.roles.includes(adminUser?.role)
  );

  return (
    <>
      {/* Header Mobile - Hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-[60px] bg-dark-800 border-b border-slate-400/10 z-[45] flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-bold text-white text-sm">DistriLink</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg bg-dark-700 border border-slate-400/10 text-slate-300"
          aria-label="Buka menu"
        >
          <HiOutlineMenuAlt2 size={22} />
        </button>
      </div>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          bg-dark-800 border-r border-slate-400/8
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[72px]" : "w-[260px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:relative md:z-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-[70px] border-b border-slate-400/8">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img 
                src="/icon.png" 
                alt="DistriLink Logo" 
                className="w-10 h-10 rounded-xl object-cover shadow-lg border border-slate-700/50"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div>
                <h1 className="text-base font-bold text-white leading-tight">
                  DistriLink
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {adminUser?.role === 'owner' ? 'Owner Central' : adminUser?.role === 'admin' ? 'Admin Ops' : 'Investor Portal'}
                </p>
              </div>
            </div>
          )}

          {collapsed && (
            <img 
              src="/icon.png" 
              alt="DistriLink Logo" 
              className="w-9 h-9 mx-auto rounded-lg object-cover shadow-lg border border-slate-700/50"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}

          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => {
              if (mobileOpen) setMobileOpen(false);
              else setCollapsed(!collapsed);
            }}
            className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400 hidden md:flex items-center justify-center"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <HiOutlineMenuAlt2 size={18} />
            ) : (
              <HiOutlineX size={18} />
            )}
          </button>

          {/* Close (mobile) */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-dark-600 text-slate-400 md:hidden"
            aria-label="Tutup menu"
          >
            <HiOutlineX size={18} />
          </button>
        </div>

        {/* Navigasi */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isSales = item.id === "sales";
            const showBadge = isSales && pendingCount > 0;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`sidebar-link w-full relative ${
                  activeSection === item.id ? "active" : ""
                }`}
                title={item.label}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                
                {showBadge && (
                  <span className={`
                    bg-rose-500 text-white font-black rounded-full flex items-center justify-center animate-pulse shadow-lg
                    ${collapsed 
                      ? "absolute top-1 right-1 w-4 h-4 text-[8px]" 
                      : "ml-auto w-5 h-5 text-[10px]"}
                  `}>
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-400/8">
          {!collapsed ? (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs">
                {adminUser?.nama?.[0] || 'A'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{adminUser?.nama}</p>
                <p className="text-[9px] text-slate-500 truncate capitalize">{adminUser?.role}</p>
              </div>
            </div>
          ) : (
             <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-[10px] mx-auto mb-4 border border-blue-500/20">
               {adminUser?.nama?.[0] || 'A'}
             </div>
          )}
          
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 p-2 rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            <HiOutlineLogout size={20} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

