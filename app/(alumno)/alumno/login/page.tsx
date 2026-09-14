"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const error = searchParams.get("error");
    router.replace(error ? `/login?error=${error}` : "/login");
  }, [router, searchParams]);
  return null;
}

export default function AlumnoLoginRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
