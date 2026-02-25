"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, signInWithGoogle } from "@/lib/supabase"; 
import styles from "./login.module.css";
import { Chrome } from "lucide-react"; // O cualquier icono de Google

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError("Fallo la conexión con Google.");
      setLoading(false);
    }
  };

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
        window.location.assign("/inicio"); 
      }
    } catch (err: any) {
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
        <img src="/logo-tecnm.png" alt="TecNM Logo" className={styles.logo} />
        
        <h1 className={styles.title}>EUI Platform</h1>
        <p className={styles.subtitle}>Acceso Inteligente Académico</p>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* BOTÓN DE GOOGLE - ACCESO PRINCIPAL */}
        <button 
          onClick={handleGoogleLogin} 
          disabled={loading} 
          className={styles.googleButton}
        >
          <Chrome size={20} />
          {loading ? "Cargando..." : "Ingresar con Google"}
        </button>

        <div className={styles.divider}>
          <span>o usa tu correo institucional</span>
        </div>

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
            {loading ? "Verificando..." : "Ingresar con Contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}