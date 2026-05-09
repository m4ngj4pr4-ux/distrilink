"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { seedDefaultOwner } from "./firestore";

const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Seed default owner on mount
    seedDefaultOwner();

    const storedUser = localStorage.getItem("admin_user");
    if (storedUser) {
      setAdminUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;

    // Protection logic
    const isLoginPage = pathname === "/login";
    const isSalesApp = pathname.startsWith("/sales");

    if (isSalesApp) return; // Don't interfere with sales app

    if (!adminUser && !isLoginPage) {
      router.push("/login");
    } else if (adminUser && isLoginPage) {
      router.push("/");
    }

    // Role-based route protection
    if (adminUser) {
      if (adminUser.role === "admin" && pathname === "/keuangan") {
        alert("Akses Ditolak: Anda tidak memiliki izin untuk membuka menu Keuangan.");
        router.push("/");
      }
      if (adminUser.role === "investor" && !["/", "/keuangan"].includes(pathname)) {
        // Investor only allowed on Dashboard (/) and Finance (/keuangan)
        // But the dashboard itself has sections. We handle section visibility in app/page.js
      }
    }
  }, [adminUser, pathname, loading, router]);

  const login = (userData) => {
    localStorage.setItem("admin_user", JSON.stringify(userData));
    setAdminUser(userData);
    router.push("/");
  };

  const logout = () => {
    localStorage.removeItem("admin_user");
    setAdminUser(null);
    router.push("/login");
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, login, logout, loading }}>
      {!loading && children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
