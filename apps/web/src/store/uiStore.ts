import { create } from "zustand";

export type DashboardTab = "forecast" | "waste-risk" | "explain";

interface UiState {
  restaurantId: string;
  date: string;
  activeTab: DashboardTab;
  setRestaurantId: (id: string) => void;
  setDate: (date: string) => void;
  setActiveTab: (tab: DashboardTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  restaurantId: "R001",
  date: "2026-02-05",
  activeTab: "forecast",
  setRestaurantId: (restaurantId) => set({ restaurantId }),
  setDate: (date) => set({ date }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
