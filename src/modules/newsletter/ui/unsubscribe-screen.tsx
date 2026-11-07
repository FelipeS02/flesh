"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FleshLogotype from "@/components/shared/flesh-logotype";
import { Button } from "@/components/ui/button";

type Status = "pending" | "done" | "invalid" | "failed" | "back";

const COPY = {
  pending: { title: "Dándote de baja…", body: null },
  done: {
    title: "Te diste de baja",
    body: "No te vamos a escribir más novedades. Si fue sin querer, te anotás de nuevo en un click.",
  },
  invalid: {
    title: "Este link no sirve",
    body: "Puede que ya te hayas dado de baja o que el link esté incompleto. Si te siguen llegando emails, escribinos.",
  },
  failed: { title: "No pudimos darte de baja", body: "Probá de nuevo en un rato." },
  back: { title: "Volviste", body: "Te vamos a seguir escribiendo con cada drop y restock." },
} as const satisfies Record<Status, { title: string; body: string | null }>;

/** POSTs the token and maps the endpoint's contract (204 / 404 / anything else) to a status. */
async function post(action: "unsubscribe" | "resubscribe", token: string): Promise<"ok" | "invalid" | "failed"> {
  try {
    const response = await fetch(`/api/newsletter/${action}?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
    if (response.ok) return "ok";
    return response.status === 404 ? "invalid" : "failed";
  } catch {
    return "failed";
  }
}

export function UnsubscribeScreen({ token }: { token: string | null }) {
  // A missing token is already known to be unusable, so it starts there
  // instead of flashing "Dándote de baja…" for a request that never happens.
  const [status, setStatus] = useState<Status>(token ? "pending" : "invalid");
  const [attempt, setAttempt] = useState(0);
  const [resubscribeFailed, setResubscribeFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // The unsubscribe happens here and not while rendering on purpose: mail
    // link scanners and prefetchers open every link in an email but do not
    // execute JavaScript, so a GET-time unsubscribe would remove people who
    // never clicked. This keeps "no confirmation step" for humans only.
    void post("unsubscribe", token).then((result) => {
      if (cancelled) return;
      setStatus(result === "ok" ? "done" : result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  async function resubscribe() {
    if (!token) return;
    setResubscribeFailed(false);
    const result = await post("resubscribe", token);
    if (result === "ok") setStatus("back");
    else setResubscribeFailed(true);
  }

  function retry() {
    setStatus("pending");
    setAttempt((count) => count + 1);
  }

  const { title, body } = COPY[status];

  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center bg-background px-4">
      <Link
        href="/"
        aria-label="FLESH inicio"
        className="absolute top-10 left-1/2 -translate-x-1/2 md:top-11"
      >
        <FleshLogotype className="w-20 md:w-40" />
      </Link>

      <div
        aria-live="polite"
        className="flex w-full max-w-104 flex-col items-center gap-4 text-center"
      >
        <h1 className="font-display text-[44px] leading-none text-foreground md:text-[56px]">
          {title}
        </h1>
        {body ? (
          <p className="font-sans text-[13px] leading-relaxed tracking-control text-muted-foreground uppercase">
            {body}
          </p>
        ) : null}
      </div>

      {status === "failed" ? (
        <Button
          type="button"
          onClick={retry}
          className="mt-8 h-16 w-full max-w-104 font-display text-xl hover:bg-primary/90 md:text-[28px]"
        >
          Reintentar
        </Button>
      ) : null}

      {status === "done" || status === "invalid" || status === "back" ? (
        <Button
          asChild
          className="mt-8 h-16 w-full max-w-104 font-display text-xl hover:bg-primary/90 md:text-[28px]"
        >
          <Link href="/">Volver a la tienda</Link>
        </Button>
      ) : null}

      {status === "done" ? (
        <>
          <Button type="button" variant="link" onClick={resubscribe} className="mt-4">
            ME ARREPENTÍ, ANOTARME DE NUEVO
          </Button>
          {resubscribeFailed ? (
            <p role="alert" className="mt-2 font-sans text-[13px] text-destructive">
              No pudimos anotarte de nuevo. Probá de nuevo en un rato.
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
