"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { signInWithGoogle } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import styles from "./login.module.css";

// ── Catálogo de códigos de error de esta pantalla ───────────────────────────
// Igual criterio que en /asistencia/validar/[hash]: msg es lo que ve el
// usuario, origen es la referencia para quien audite — apunta al archivo
// exacto que generó el ?error=. Tres de los cuatro códigos llegan por la URL
// (los genera otro archivo del lado del servidor); GOOGLE_CONNECTION_ERROR es
// el único que se dispara aquí mismo, en el cliente.
const ERROR_CATALOG = {
  SIN_MATERIA: {
    msg: "Tu cuenta no está inscrita en ninguna materia todavía. Contacta a tu docente para que te agregue.",
    origen: "app/alumno/layout.tsx: role='alumno' pero sin fila en students para ese correo",
  },
  PROFILE_MISSING: {
    msg: "Tu cuenta no tiene un perfil configurado. Contacta al administrador.",
    origen: "proxy.ts: usuario autenticado sin fila en profiles",
  },
  AUTH_CODE_ERROR: {
    msg: "Ocurrió un error al iniciar sesión. Intenta de nuevo.",
    origen: "app/auth/callback/route.ts: exchangeCodeForSession falló, o no hubo code/user en el callback",
  },
  GOOGLE_CONNECTION_ERROR: {
    msg: "Falló la conexión con Google.",
    origen: "app/login/page.tsx: signInWithOAuth lanzó una excepción (popup bloqueado, red, etc.)",
  },
} as const;

type ErrorCode = keyof typeof ERROR_CATALOG;

// Los códigos que llegan por la URL usan snake_case/kebab-case porque los
// genera código de servidor ajeno a esta pantalla — este mapa es el único
// lugar que traduce esas cadenas sueltas a un ErrorCode del catálogo.
const URL_CODE_MAP: Record<string, ErrorCode> = {
  sin_materia: "SIN_MATERIA",
  profile_missing: "PROFILE_MISSING",
  "auth-code-error": "AUTH_CODE_ERROR",
};

function logError(codigo: ErrorCode) {
  console.error(`[Login] ${codigo} — ${ERROR_CATALOG[codigo].origen}`);
}

function LoginErrorReader({ onError }: { onError: (codigo: ErrorCode) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const raw = searchParams.get("error");
    const codigo = raw ? URL_CODE_MAP[raw] : undefined;
    if (codigo) onError(codigo);
  }, [searchParams, onError]);
  return null;
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  const handleError = (codigo: ErrorCode) => {
    logError(codigo);
    setErrorCode(codigo);
  };

  const handleGoogleLogin = async () => {
    setErrorCode(null);
    setLoading(true);
    try {
      // `next` viaja desde proxy.ts (te mandó aquí al intentar entrar a una
      // ruta protegida sin sesión) hasta el callback, para volver exactamente
      // a donde ibas en vez de siempre caer en /inicio o /alumno.
      const next = searchParams.get("next");
      await signInWithGoogle(next ?? undefined);
    } catch {
      handleError("GOOGLE_CONNECTION_ERROR");
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Suspense fallback={null}>
        <LoginErrorReader onError={handleError} />
      </Suspense>

      <Header />

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>EUI Platform</h1>
            <p className={styles.subtitle}>Gestión Inteligente de Investigación</p>
          </div>

          {errorCode && <div className={styles.errorBox}>{ERROR_CATALOG[errorCode].msg}</div>}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={styles.googleButton}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>{loading ? "Cargando..." : "Continuar con Google"}</span>
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
