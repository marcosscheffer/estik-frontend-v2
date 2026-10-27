import { useState } from "react";

export type ViewMode = "grid" | "list";

/** Lembra a visualização (cards/lista) escolhida em cada tela. */
export function useViewMode(key: string, initial: ViewMode = "grid") {
  const storageKey = `estik.view.${key}`;
  const [mode, setModeState] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "grid" || saved === "list" ? saved : initial;
    } catch {
      return initial;
    }
  });

  const setMode = (next: ViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // sem localStorage (aba anônima etc.): só não lembra
    }
  };

  return [mode, setMode] as const;
}
