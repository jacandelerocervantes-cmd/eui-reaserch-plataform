import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirigimos a inicio; el proxy validará si hay sesión
  redirect("/inicio");
}