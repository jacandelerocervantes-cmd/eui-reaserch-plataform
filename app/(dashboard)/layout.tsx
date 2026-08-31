import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: "80px", minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, overflowY: "auto" }} className="custom-scrollbar">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}