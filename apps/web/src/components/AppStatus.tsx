import { useEffect, useState } from "react";

import { useI18n } from "../i18n";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AppStatus() {
  const { t } = useI18n();
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(
    window.matchMedia?.("(display-mode: standalone)").matches ?? false,
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const ready = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    const done = () => { setInstall(null); setInstalled(true); };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  return (
    <>
      {!online && <p role="status" className="shrink-0 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">{t("offline")}</p>}
      {!installed && (
        <details className="shrink-0 border-b border-slate-800 px-4 text-sm text-slate-300">
          <summary className="flex min-h-11 cursor-pointer items-center text-verde-400">{t("install")}</summary>
          <div className="pb-3">
            {install ? <button type="button" className="min-h-11 rounded-md bg-verde-700 px-4 text-white" onClick={async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            }}>{t("addHome")}</button> : <p>{t("installHelp")}</p>}
          </div>
        </details>
      )}
    </>
  );
}
