"use client";

import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  HiOutlineCurrencyDollar,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineUserGroup,
} from "react-icons/hi";

const cards = [
  {
    key: "totalAssets",
    label: "Total Aset",
    icon: HiOutlineCurrencyDollar,
    glow: "card-glow-emerald",
    accent: "from-emerald-400 to-emerald-600",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    format: "rupiah",
  },
  {
    key: "warehouseStock",
    label: "Stok Gudang",
    suffix: "Karton",
    icon: HiOutlineCube,
    glow: "card-glow-blue",
    accent: "from-blue-400 to-blue-600",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    format: "number",
    alertBelow: 10,
  },
  {
    key: "factoryDebt",
    label: "Hutang Pabrik",
    icon: HiOutlineDocumentText,
    glow: "card-glow-amber",
    accent: "from-amber-400 to-amber-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    format: "rupiah",
  },
  {
    key: "salesReceivables",
    label: "Piutang Sales",
    icon: HiOutlineUserGroup,
    glow: "card-glow-rose",
    accent: "from-rose-400 to-rose-500",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-400",
    format: "rupiah",
  },
];

export default function SummaryCards({ summary, inventory }) {
  const values = {
    totalAssets: summary?.totalAssets || 0,
    warehouseStock: inventory?.totalCartons || 0,
    factoryDebt: summary?.factoryDebt || 0,
    salesReceivables: summary?.salesReceivables || 0,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {cards.map((card) => {
        const value = values[card.key];
        const isAlert = card.alertBelow && value < card.alertBelow;

        return (
          <div
            key={card.key}
            className={`glass-card ${card.glow} p-5 relative overflow-hidden group`}
          >
            {/* Dekorasi gradient */}
            <div
              className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${card.accent} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500`}
            />

            <div className="flex items-start justify-between relative z-10">
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  {card.label}
                </p>
                <p
                  className={`text-2xl font-bold tracking-tight ${
                    isAlert ? "text-rose-400 animate-pulse" : "text-white"
                  }`}
                >
                  {card.format === "rupiah"
                    ? formatRupiah(value)
                    : formatNumber(value)}
                </p>
                {card.suffix && (
                  <p
                    className={`text-xs mt-1 ${
                      isAlert
                        ? "text-rose-400 font-semibold"
                        : "text-slate-500"
                    }`}
                  >
                    {isAlert ? "⚠ Stok Rendah!" : card.suffix}
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
        );
      })}
    </div>
  );
}
