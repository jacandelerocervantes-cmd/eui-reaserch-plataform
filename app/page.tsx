import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirigimos la raíz al Centro de Mando (Nuestra nueva jerarquía superior)
  redirect("/inicio");
}