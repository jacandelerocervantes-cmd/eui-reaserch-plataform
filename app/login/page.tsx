"use client";

import { useState, useEffect } from "react"; // Añadimos useEffect
import { useRouter } from "next/navigation";
import { supabase, signInWithGoogle, signOut } from "@/lib/supabase"; // Importamos signOut
import styles from "./login.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // LOG PARA SABER SI ESTAMOS ATRAPADOS
  console.log("LoginPage renderizada");

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

  // ESTA ES LA FUNCIÓN QUE VAMOS A USAR PARA ROMPER EL BUCLE
  const handleForceSignOut = async () => {
    setLoading(true);
    console.log("Iniciando limpieza de sesión...");
    try {
      await signOut(); // Esto ahora limpia cookies y localStorage
      alert("Sesión borrada. Ahora intenta entrar con Google de nuevo.");
    } catch (err) {
      console.error("Error al limpiar:", err);
    } finally {
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
      if (data?.user) window.location.assign("/inicio"); 

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
        <div className={styles.header}>
          <img src="/logo-tecnm.png" alt="TecNM Logo" className={styles.logo} />
          <h1 className={styles.title}>EUI Platform</h1>
          <p className={styles.subtitle}>Gestión Inteligente de Investigación</p>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.authSection}>
          <button 
            onClick={handleGoogleLogin} 
            disabled={loading} 
            className={styles.googleButton}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
            </svg>
            <span>{loading ? "Cargando..." : "Continuar con Google"}</span>
          </button>

          <div className={styles.divider}>
            <span className={styles.dividerText}>o usar credenciales</span>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
             {/* ... campos de email y password iguales ... */}
             <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} placeholder="Correo" />
             <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} placeholder="Contraseña" />
            
            <button type="submit" disabled={loading} className={styles.loginButton}>
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>

          {/* ESTE ES EL BOTÓN DE EMERGENCIA */}
          <button 
            type="button"
            onClick={handleForceSignOut}
            className={styles.debugButton}
            style={{ marginTop: '20px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            ¿Atrapado en un bucle? Forzar cierre de sesión
          </button>
        </div>
      </div>
    </div>
  );
}