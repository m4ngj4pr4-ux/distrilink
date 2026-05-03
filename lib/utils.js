// lib/utils.js — Formatting helpers

/**
 * Format a number to Indonesian Rupiah
 */
export function formatRupiah(number) {
  if (number == null || isNaN(number)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
}

/**
 * Parse a rupiah formatted string back to a number
 */
export function parseRupiah(str) {
  if (!str) return 0;
  return parseInt(String(str).replace(/[^\d]/g, ""), 10) || 0;
}

/**
 * Format large numbers with thousand separators
 */
export function formatNumber(number) {
  if (number == null || isNaN(number)) return "0";
  return new Intl.NumberFormat("id-ID").format(number);
}

/**
 * Format a Firestore timestamp to a locale date string
 */
export function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Real-time input formatting (adds dots as thousand separators)
 */
export function formatInputNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  // Hapus semua karakter selain angka
  const plainNumber = value.toString().replace(/\D/g, "");
  // Format dengan titik separator ribuan
  return plainNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Real-time input parsing (removes dots to store as pure number/string)
 */
export function parseInputNumber(value) {
  if (!value) return "";
  // Kembalikan ke angka murni
  return value.toString().replace(/\./g, "");
}
