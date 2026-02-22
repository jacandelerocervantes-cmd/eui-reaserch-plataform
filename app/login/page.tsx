"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Tu cliente global
import styles from "./login.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (data?.user) {
        // En lugar de router.push, forzamos al navegador a recargar todo hacia el panel
        // Esto obliga al Middleware a leer las cookies recién creadas
        console.log("Login exitoso, redirigiendo...");
        window.location.assign("/panel"); 
      }

    } catch (err: any) {
      // ESTA LÍNEA ES ORO PURO PARA DEPURAR
      console.error("🚨 DETALLE DEL ERROR DE SUPABASE:", err); 
      
      setError(err.message === "Invalid login credentials" 
        ? "Correo o contraseña incorrectos." 
        : `Fallo el login: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        
        {/* Aquí reciclamos tu logo del Header */}
        <img src="/logo-tecnm.png" alt="TecNM Logo" className={styles.logo} />
        
        <h1 className={styles.title}>Portal Académico</h1>
        <p className={styles.subtitle}>Acceso exclusivo para personal docente</p>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleLogin} className={styles.form}>
          
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Correo Electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="docente@tizimin.tecnm.mx"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Verificando..." : "Ingresar al Panel"}
          </button>
          
        </form>
      </div>
    </div>
  );
}