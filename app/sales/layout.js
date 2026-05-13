export const metadata = {
  title: "DistriLink Field — Sales Tracker",
  description: "Field application for sales team to track distributions and deposits.",
  manifest: "/manifest-sales.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DL Sales",
  },
  themeColor: "#10b981",
};

export default function SalesLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark-950 text-slate-100">
      {children}
    </div>
  );
}
