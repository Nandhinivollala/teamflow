"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "teamflow-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const frame = window.requestAnimationFrame(() => {
      setTheme(initial);
      document.documentElement.dataset.theme = initial;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button className="icon-button theme-toggle" type="button" onClick={toggle} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>
      {theme === "light" ? "☾" : "☀"}
    </button>
  );
}
