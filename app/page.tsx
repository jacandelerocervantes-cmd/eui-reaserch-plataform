import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirigir temporalmente la raíz al panel de gestión
  redirect("/panel");
}