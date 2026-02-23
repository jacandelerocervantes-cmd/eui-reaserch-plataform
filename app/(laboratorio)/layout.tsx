import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function LaboratorioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: "80px", display: "flex", flexDirection: "column" }}>
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}