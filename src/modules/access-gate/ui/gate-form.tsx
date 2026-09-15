"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UnlockResult } from "../api/unlock.action";

type GateFormState = { status: "idle" } | { status: "error" } | { status: "blocked"; retryAfterMs: number };

type GateFormProps = {
  /**
   * Injected rather than imported directly, so this component can be unit
   * tested without a real server action / cookie store — same seam
   * `BuyerDialog` uses for `onSubmit` and `CartProvider` uses for its
   * storage port.
   */
  unlock: (password: string) => Promise<UnlockResult>;
  /** Runs after a successful unlock — the caller owns navigating away from `/acceso`. */
  onUnlocked: () => void;
};

const ERROR_MESSAGE_ID = "access-gate-error";

export function GateForm({ unlock, onUnlocked }: GateFormProps) {
  const [state, formAction, pending] = useActionState<GateFormState, FormData>(
    async (_previous, formData) => {
      const password = String(formData.get("password") ?? "");
      const result = await unlock(password);

      if (result.ok) {
        onUnlocked();
        return { status: "idle" };
      }

      if (result.error === "too-many-attempts") {
        return { status: "blocked", retryAfterMs: result.retryAfterMs };
      }

      return { status: "error" };
    },
    { status: "idle" },
  );

  const blocked = state.status === "blocked";
  // The blocked state is also an invalid/announced state — reusing the same
  // wiring means a screen reader user hears the lockout exactly the way
  // they'd hear a wrong password, instead of the message going silent.
  const failed = state.status === "error" || blocked;

  return (
    <form action={formAction} className="grid gap-4">
      <Input
        // No visible label by design — the placeholder carries it, which is
        // exactly why an explicit accessible name is required here: a
        // placeholder is never announced as one.
        aria-label="Contraseña"
        aria-invalid={failed}
        aria-describedby={failed ? ERROR_MESSAGE_ID : undefined}
        name="password"
        type="password"
        placeholder="Ingresá la contraseña"
        required
        disabled={pending || blocked}
        className="h-16 border-input bg-foreground/5 px-4 font-sans text-base text-foreground"
      />
      {failed && (
        <p id={ERROR_MESSAGE_ID} role="alert" className="font-sans text-sm text-destructive">
          {blocked
            ? `Demasiados intentos. Probá de nuevo en ${retryLabel(state.retryAfterMs)}.`
            : "Contraseña incorrecta. Probá de nuevo."}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || blocked}
        aria-busy={pending}
        className="h-16 w-full bg-primary font-display text-lg text-primary-foreground hover:bg-primary disabled:bg-muted disabled:text-muted-foreground"
      >
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

// Rounds up, never down — a truncated countdown could read "0 minutos"
// while the server is still rejecting every attempt, telling the shopper
// to retry immediately when the guard will not actually let them in yet.
function retryLabel(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  // Shopper-facing copy: "en 1 minutos" is the seam that makes a storefront
  // read as machine-generated, so the singular is spelled out.
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}
