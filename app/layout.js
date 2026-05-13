import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "DistriLink Executive — Admin Portal",
  description:
    "Owner dashboard for managing cigarette distribution, factory POs, COGS calculation, and sales team ledger.",
  keywords: ["cigarette", "distribution", "dashboard", "COGS", "sales ledger"],
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DistriLink",
  },
  themeColor: "#000000",
};

export const dynamic = "force-dynamic";

import { AdminAuthProvider } from "@/lib/AdminAuthContext";

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-dark-900 text-foreground">
        <Toaster position="top-right" containerStyle={{ zIndex: 999999 }} />
        <AdminAuthProvider>
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  );
}
