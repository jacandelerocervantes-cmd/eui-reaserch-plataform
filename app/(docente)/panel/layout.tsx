import Sidebar from "@/components/layout/Sidebar";

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", width: "100%", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      
      {/* Sidebar Fijo a la izquierda */}
      <Sidebar />
      
      {/* El contenido se desplaza 80px para no quedar debajo del sidebar */}
      <main style={{ 
        flex: 1, 
        marginLeft: "80px", 
        width: "calc(100% - 80px)",
        position: "relative" 
      }}>
        {children}
      </main>
      
    </div>
  );
}