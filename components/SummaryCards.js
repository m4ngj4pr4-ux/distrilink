"use client";

import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  HiOutlineCurrencyDollar,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineUserGroup,
} from "react-icons/hi";

export default function SummaryCards({ summary, products }) {
  // Hitung total Bal & Slop dari semua produk
  const totalSlops = (products || []).reduce((total, p) => {
    const packsPerSlop = p.packsPerSlop || 10;
    const slops = Math.floor((p.totalPacks || 0) / packsPerSlop);
    return total + slops;
  }, 0);

  const globalBal = Math.floor(totalSlops / 10);
  const globalSlop = totalSlops % 10;
  const stockDisplay = `${formatNumber(globalBal)} Bal - ${globalSlop} Slop`;

  const cards = [
    {
      key: "totalAssets",
      label: "Total Aset",
      value: summary?.totalAssets || 0,
      format: "rupiah",
      icon: HiOutlineCurrencyDollar,
      glow: "card-glow-emerald",
      accent: "from-emerald-400 to-emerald-600",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      key: "warehouseStock",
      label: "Stok Gudang",
      value: stockDisplay,
      format: "custom",
      icon: HiOutlineCube,
      glow: "card-glow-blue",
      accent: "from-blue-400 to-blue-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      suffix: "Total Bal & Slop",
    },
    {
      key: "factoryDebt",
      label: "Hutang Pabrik",
      value: summary?.factoryDebt || 0,
      format: "rupiah",
      icon: HiOutlineDocumentText,
      glow: "card-glow-amber",
      accent: "from-amber-400 to-amber-500",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
    {
      key: "salesReceivables",
      label: "Piutang Sales",
      value: summary?.salesReceivables || 0,
      format: "rupiah",
      icon: HiOutlineUserGroup,
      glow: "card-glow-rose",
      accent: "from-rose-400 to-rose-500",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`glass-card ${card.glow} p-5 relative overflow-hidden group`}
        >
          <div
            className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${card.accent} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500`}
          />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {card.label}
              </p>
              <p className="text-2xl font-bold tracking-tight text-white">
                {card.format === "rupiah"
                  ? formatRupiah(card.value)
                  : card.value}
              </p>
              {card.suffix && (
                <p className="text-[10px] mt-1 text-slate-500">
                  {card.suffix}
                </p>
              )}
            </div>
            <div
              className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center`}
            >
              <card.icon className={card.iconColor} size={22} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
