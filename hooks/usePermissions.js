import { useAdminAuth } from "@/lib/AdminAuthContext";
import toast from "react-hot-toast";

/**
 * Hook untuk mengelola izin akses berdasarkan role.
 * Digunakan untuk mencegat aksi penulisan (write) jika user adalah Investor.
 */
export function usePermissions() {
  const { adminUser } = useAdminAuth();

  const isInvestor = adminUser?.role === "investor";
  const isOwner = adminUser?.role === "owner";
  const isAdmin = adminUser?.role === "admin";
  
  /**
   * Fungsi pencegat untuk aksi tombol/form.
   * @param {string} actionName Nama aksi untuk ditampilkan di toast (misal: "menghapus data")
   * @returns {boolean} True jika diizinkan, False jika diblokir
   */
  const checkWritePermission = (actionName = "aksi ini") => {
    if (isInvestor) {
      toast.error(
        `Akses Dibatasi: Anda berada dalam mode Investor (Read-Only). Fitur ${actionName} hanya dapat dilakukan oleh Admin/Owner.`,
        { 
          id: "read-only-intercept", 
          duration: 4000,
          style: {
            border: '1px solid #f43f5e',
            padding: '16px',
            color: '#fff',
            background: '#1e1b4b',
          },
          iconTheme: {
            primary: '#f43f5e',
            secondary: '#fff',
          },
        }
      );
      return false;
    }
    return true;
  };

  return {
    isInvestor,
    isOwner,
    isAdmin,
    userRole: adminUser?.role,
    checkWritePermission,
  };
}
