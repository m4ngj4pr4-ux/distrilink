"use client";
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HiOutlineHome, HiOutlineMap, HiOutlineClipboardList, HiOutlineUser } from 'react-icons/hi';

export default function SalesLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('sales_user');
    const isLoginPage = pathname === '/sales/login';

    if (!user && !isLoginPage) {
      router.replace('/sales/login');
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, router]);

  // Prevent flashing protected content before redirect
  if (!isAuthorized) return <div className="bg-black min-h-screen"></div>;

  const isLoginPage = pathname === '/sales/login';

  return (
    <div className="bg-black min-h-screen flex justify-center">
      <div className="w-full max-w-md bg-dark-900 min-h-screen relative shadow-2xl pb-20 overflow-x-hidden border-x border-slate-800/30">
        
        <main className={isLoginPage ? "min-h-screen flex items-center justify-center" : "min-h-screen"}>
          {children}
        </main>

        {!isLoginPage && (
          <nav className="fixed bottom-0 w-full max-w-md bg-dark-800/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center h-16 z-50">
            <Link className="flex flex-col items-center text-slate-400 hover:text-emerald-500 transition-all active:scale-95" href="/sales">
              <HiOutlineHome size={22} />
              <span className="text-[10px] mt-1 font-medium">Beranda</span>
            </Link>
            <Link className="flex flex-col items-center text-slate-400 hover:text-emerald-500 transition-all active:scale-95" href="/sales/toko">
              <HiOutlineMap size={22} />
              <span className="text-[10px] mt-1 font-medium">Toko</span>
            </Link>
            <Link className="flex flex-col items-center text-slate-400 hover:text-emerald-500 transition-all active:scale-95" href="/sales/transaksi">
              <HiOutlineClipboardList size={22} />
              <span className="text-[10px] mt-1 font-medium">Riwayat</span>
            </Link>
            <Link className="flex flex-col items-center text-slate-400 hover:text-emerald-500 transition-all active:scale-95" href="/sales/profil">
              <HiOutlineUser size={22} />
              <span className="text-[10px] mt-1 font-medium">Profil</span>
            </Link>
          </nav>
        )}
      </div>
    </div>
  );
}
