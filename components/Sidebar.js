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
  HiOutlineTrendingUp
} from "react-icons/hi";

const navItems = [
  { icon: HiOutlineHome, label: "Dashboard", id: "dashboard" },
  { icon: HiOutlineDocumentText, label: "PO Pabrik", id: "po" },
  { icon: HiOutlineClipboardList, label: "Riwayat PO", id: "po-history" },
  { icon: HiOutlineCube, label: "Stok Barang", id: "stock" },
  { icon: HiOutlineTrendingUp, label: "Laba Rugi", id: "laba-rugi" },
  { icon: HiOutlineUserGroup, label: "Buku Penjualan", id: "sales" },
  { icon: HiOutlineCube, label: "Inventaris", id: "inventory" },
  { icon: HiOutlineReply, label: "Retur Barang", id: "returns" },
  { icon: HiOutlineCog, label: "Pengaturan", id: "settings" },
];

export default function Sidebar({ activeSection, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Tombol toggle mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-dark-700 border border-slate-400/10 text-slate-300 md:hidden"
        aria-label="Buka menu"
      >
        <HiOutlineMenuAlt2 size={22} />
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
                D
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">
                  DistriLink
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Distribusi Rokok
                </p>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
              D
            </div>
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
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              className={`sidebar-link w-full ${
                activeSection === item.id ? "active" : ""
              }`}
              title={item.label}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t border-slate-400/8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                P
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Pemilik</p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
