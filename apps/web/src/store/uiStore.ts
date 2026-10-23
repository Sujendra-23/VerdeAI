import type { LanguagePreference } from "@verdeai/shared-types";
import { create } from "zustand";

export type DashboardTab = "forecast" | "waste-risk" | "explain";

interface UiState {
  restaurantId: string;
  date: string;
  activeTab: DashboardTab;
  /** Language the explain chatbot answers in; `auto` follows the language the manager types in. */
  language: LanguagePreference;
  /** Speak each new assistant reply aloud, in the language the dashboard is using. */
  readAloud: boolean;
  setRestaurantId: (id: string) => void;
  setDate: (date: string) => void;
  setActiveTab: (tab: DashboardTab) => void;
  setLanguage: (language: LanguagePreference) => void;
  setReadAloud: (readAloud: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  restaurantId: "R001",
  date: "2026-02-05",
  activeTab: "forecast",
  language: "auto",
  readAloud: false,
  setRestaurantId: (restaurantId) => set({ restaurantId }),
  setDate: (date) => set({ date }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLanguage: (language) => set({ language }),
  setReadAloud: (readAloud) => set({ readAloud }),
}));
