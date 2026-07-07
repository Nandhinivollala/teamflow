"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const commonRoutes = [
  "/",
  "/tasks",
  "/rcas",
  "/reports",
  "/people",
  "/settings",
  "/notifications",
  "/projects",
];

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const run = () => {
      for (const route of commonRoutes) {
        router.prefetch(route);
      }
    };

    const idleScheduler = globalThis.requestIdleCallback;
    if (typeof idleScheduler === "function") {
      const id = idleScheduler(run, { timeout: 1500 });
      return () => globalThis.cancelIdleCallback?.(id);
    }

    const timeout = window.setTimeout(run, 300);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return null;
}
