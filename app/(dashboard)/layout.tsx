import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
      <Header />
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: "80px", minWidth: 0 }}>
          <main style={{ flex: 1, overflowY: "auto" }} className="custom-scrollbar">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}