// lib/geolocation.js — Robust GPS with timeout & offline fallback
// Membungkus navigator.geolocation dalam Promise dengan timeout.
// Jika GPS gagal atau timeout, transaksi TIDAK diblokir.

/**
 * Ambil posisi GPS saat ini dengan timeout.
 * @param {number} timeoutMs - Batas waktu dalam milidetik (default: 10 detik)
 * @returns {Promise<{latitude: number, longitude: number, status: string}>}
 */
export function getCurrentLocation(timeoutMs = 10000) {
  return new Promise((resolve) => {
    // Cek apakah API tersedia
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve({
        latitude: 0,
        longitude: 0,
        status: "GPS_NOT_SUPPORTED",
      });
    }

    // Set timer manual sebagai safety net
    const timer = setTimeout(() => {
      resolve({
        latitude: 0,
        longitude: 0,
        status: "GPS_TIMEOUT",
      });
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: "OK",
        });
      },
      (err) => {
        clearTimeout(timer);
        let status = "GPS_ERROR";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            status = "GPS_DENIED";
            break;
          case err.POSITION_UNAVAILABLE:
            status = "GPS_UNAVAILABLE";
            break;
          case err.TIMEOUT:
            status = "GPS_TIMEOUT";
            break;
        }
        resolve({
          latitude: 0,
          longitude: 0,
          status,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30000, // Cache GPS selama 30 detik
      }
    );
  });
}

/**
 * Format status GPS ke pesan Bahasa Indonesia
 */
export function getGPSStatusMessage(status) {
  switch (status) {
    case "OK":
      return "Lokasi berhasil dikunci!";
    case "GPS_TIMEOUT":
      return "GPS timeout — lokasi disimpan sebagai kosong. Transaksi tetap dilanjutkan.";
    case "GPS_DENIED":
      return "Izin GPS ditolak. Aktifkan lokasi di pengaturan HP.";
    case "GPS_UNAVAILABLE":
      return "Sinyal GPS tidak tersedia. Transaksi tetap dilanjutkan.";
    case "GPS_NOT_SUPPORTED":
      return "Browser tidak mendukung GPS.";
    default:
      return "Gagal mengambil lokasi.";
  }
}
