"use client";
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HiOutlineHome, HiOutlineMap, HiOutlineClipboardList, HiOutlineUser } from 'react-icons/hi';

export default function SalesLayoutClient({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('sales_user');
    const isLoginPage = pathname === '/sales/login';

    if (!user && !isLoginPage) {
      router.replace('/sales/login');
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, router]);

  // ── Register Service Worker ──
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }, []);

  // ── Online/Offline Detection ──
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Set initial state
    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Prevent flashing protected content before redirect
  if (!isAuthorized && pathname !== '/sales/login') {
     return <div className="bg-black min-h-screen"></div>;
  }

  const isLoginPage = pathname === '/sales/login';

  return (
    <div className="bg-black min-h-screen flex justify-center overflow-x-hidden sales-app">
      <div className="w-full max-w-md bg-dark-900 min-h-screen relative shadow-2xl pb-20 overflow-x-hidden border-x border-slate-800/30">
        
        {/* ── Offline Banner ── */}
        {isOffline && !isLoginPage && (
          <div className="sticky top-0 z-[60] bg-amber-600/95 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2 animate-fadeIn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-100 flex-shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] font-bold text-amber-50 tracking-wide">Mode Offline — Data disimpan di HP</span>
          </div>
        )}

        <main className={isLoginPage ? "min-h-screen flex items-center justify-center" : "min-h-screen"}>
          {children}
        </main>

        {!isLoginPage && (
          <nav className="fixed bottom-0 w-full max-w-md bg-dark-800/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center h-16 z-50">
            {/* Offline cloud icon indicator in navbar */}
            {isOffline && (
              <div className="absolute -top-3 right-4 bg-amber-600 rounded-full p-1 shadow-lg shadow-amber-600/30 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-white">
                  <path d="M1.293 1.293a1 1 0 011.414 0l12 12a1 1 0 01-1.414 1.414l-12-12a1 1 0 010-1.414z"/>
                  <path d="M8 2a6 6 0 00-5.22 8.956l-1.07 1.07A7.97 7.97 0 018 0a7.97 7.97 0 015.657 2.343l-1.414 1.414A6 6 0 008 2zM4.929 4.929l1.414 1.414A3 3 0 018 5.5a3 3 0 012.121.879l1.414-1.414A5 5 0 008 3a5 5 0 00-3.071 1.929z"/>
                </svg>
              </div>
            )}

            <Link 
              className={`flex flex-col items-center transition-all active:scale-95 ${pathname === '/sales' ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} 
              href="/sales"
            >
              <HiOutlineHome size={24} />
              <span className="text-[11px] mt-1 font-medium">Beranda</span>
            </Link>
            <Link 
              className={`flex flex-col items-center transition-all active:scale-95 ${pathname === '/sales/toko' ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} 
              href="/sales/toko"
            >
              <HiOutlineMap size={24} />
              <span className="text-[11px] mt-1 font-medium">Toko</span>
            </Link>
            <Link 
              className={`flex flex-col items-center transition-all active:scale-95 ${pathname === '/sales/transaksi' ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} 
              href="/sales/transaksi"
            >
              <HiOutlineClipboardList size={24} />
              <span className="text-[11px] mt-1 font-medium">Rute</span>
            </Link>
            <Link 
              className={`flex flex-col items-center transition-all active:scale-95 ${pathname.startsWith('/sales/profil') ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`} 
              href="/sales/profil"
            >
              <HiOutlineUser size={24} />
              <span className="text-[11px] mt-1 font-medium">Profil</span>
            </Link>
          </nav>
        )}
      </div>
    </div>
  );
}
