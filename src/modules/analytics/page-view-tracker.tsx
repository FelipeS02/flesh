"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendAnalyticsEvent } from "./transport";
import type { AnalyticsEvent } from "./events";

type Send = (event: AnalyticsEvent) => unknown;

export function PageViewTracker({ send = sendAnalyticsEvent }: { send?: Send }) {
  const pathname = usePathname();

  useEffect(() => {
    send({ name: "page_view", params: { page_path: pathname } });
  }, [pathname, send]);

  return null;
}
