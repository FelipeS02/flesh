"use client";

import { useRouter } from "next/navigation";
import type { UnlockResult } from "../api/unlock.action";
import { GateForm } from "./gate-form";

type GateScreenProps = {
  /**
   * The real server action, passed down from the server-component page —
   * `GateForm` itself stays action-agnostic so it can be unit tested with a
   * fake. Next allows a server action reference to cross into a client
   * component as a prop; only its invocation, not its body, runs here.
   */
  unlock: (password: string) => Promise<UnlockResult>;
};

/**
 * Owns the one bit of navigation `GateForm` cannot: once the cookie is set,
 * something has to leave `/acceso`. `router.replace` (not `push`) so the
 * gate screen never lands in browser history between the store and itself.
 */
export function GateScreen({ unlock }: GateScreenProps) {
  const router = useRouter();

  return <GateForm unlock={unlock} onUnlocked={() => router.replace("/")} />;
}
