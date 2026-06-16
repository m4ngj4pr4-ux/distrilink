"use client";

import { formatRupiah, formatNumber } from "@/lib/utils";
import {
  HiOutlineCurrencyDollar,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineUserGroup,
} from "react-icons/hi";

export default function SummaryCards({ summary, products, purchases, allAvailableBatches }) {
  // Hitung total Bal, Slop, & Pack secara dinamis dari sisa stok riil PO batches masing-masing produk
  let totalBals = 0;
  let totalSlops = 0;
  let totalPacks = 0;

  (products || []).forEach(p => {
    const productBatches = (allAvailableBatches || []).filter(b => b.productId === p.id && b.realSisa > 0);
    const prodTotalPacks = productBatches.reduce((sum, b) => sum + b.realSisa, 0);

    const packsPerSlop = p.packsPerSlop || 10;
    const slopsPerBall = 10; // 1 Bal = 10 Slop

    const prodSlops = Math.floor(prodTotalPacks / packsPerSlop);
    const remainingPacks = prodTotalPacks % packsPerSlop;

    const fullBals = Math.floor(prodSlops / slopsPerBall);
    const remainingSlops = prodSlops % slopsPerBall;

    totalBals += fullBals;
    totalSlops += remainingSlops;
    totalPacks += remainingPacks;
  });

  // Normalisasi akumulasi: Pack -> Slop -> Bal
  const extraSlops = Math.floor(totalPacks / 10);
  totalSlops += extraSlops;
  const finalPacks = totalPacks % 10;

  const extraBals = Math.floor(totalSlops / 10);
  totalBals += extraBals;
  const finalSlops = totalSlops % 10;

  const stockDisplay = `${formatNumber(totalBals)} Bal - ${finalSlops} Slop - ${finalPacks} Pk`;

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`glass-card ${card.glow} p-3 sm:p-5 relative overflow-hidden group`}
        >
          <div
            className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${card.accent} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500`}
          />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex-1">
              <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider mb-1 sm:mb-2">
                {card.label}
              </p>
              <p className="text-sm sm:text-2xl font-bold tracking-tight text-white truncate">
                {card.format === "rupiah"
                  ? formatRupiah(card.value)
                  : card.value}
              </p>
              {card.suffix && (
                <p className="text-[8px] sm:text-[10px] mt-0.5 sm:mt-1 text-slate-500 hidden sm:block">
                  {card.suffix}
                </p>
              )}
            </div>
            <div
              className={`w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}
            >
              <card.icon className={card.iconColor} size={18} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
