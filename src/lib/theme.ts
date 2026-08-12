import { useEffect, useState } from "react";

// Dark mode: token warna .dark sudah ada di src/styles.css, tinggal memasang/
// melepas kelas `dark` di <html>. Nilai awal disemai lebih dulu oleh skrip inline
// di __root.tsx (anti-FOUC) sebelum React hidrasi; hook ini menyelaraskan state
// React dengan kelas yang sudah terpasang dan menangani toggle + persistensi.

export const THEME_KEY = "pasarpilih:theme";
export type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Tema awal: pilihan tersimpan → preferensi OS → terang. */
export function themeAwal(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  // SSR & render pertama = "light" agar markup server/klien konsisten; useEffect
  // langsung mengoreksi ke tema sebenarnya setelah mount (kelas sudah benar dari
  // skrip inline, jadi tak ada kedip).
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(themeAwal());
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage tak tersedia */
      }
      apply(next);
      return next;
    });
  };

  return { theme, toggle };
}
