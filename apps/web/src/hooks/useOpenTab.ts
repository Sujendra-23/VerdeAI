import { logConversion } from "../experiments/tracking";
import { type DashboardTab, useUiStore } from "../store/uiStore";

/** Opens a dashboard tab; shared by the sidebar buttons and spoken commands so both log the same events. */
export function useOpenTab() {
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  return (tab: DashboardTab) => {
    // Same conversion for both variants: the manager opened Waste Risk.
    if (tab === "waste-risk") logConversion("forecast-inline-risk");
    if (window.location.hash === "#/experiments") window.location.hash = "";
    setActiveTab(tab);
  };
}
