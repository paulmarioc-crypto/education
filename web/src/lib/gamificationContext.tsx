import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type GamificationDTO } from "./api.js";

interface GamificationContextValue {
  data: GamificationDTO | null;
  refresh: () => void;
}

const GamificationContext = createContext<GamificationContextValue>({ data: null, refresh: () => {} });

/** Shared streak/XP/level state, refetched after any graded attempt so the header stays live everywhere. */
export function GamificationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GamificationDTO | null>(null);

  const refresh = useCallback(() => {
    api.gamification().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <GamificationContext.Provider value={{ data, refresh }}>{children}</GamificationContext.Provider>;
}

export function useGamification() {
  return useContext(GamificationContext);
}
