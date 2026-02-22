// app/layout.tsx
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

export const metadata = {
  title: "Portal Académico | TecNM Campus Tizimín",
  description: "Plataforma de Gestión Académica y Entornos Virtuales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* Agregamos suppressHydrationWarning aquí */
    <html lang="es" suppressHydrationWarning> 
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}