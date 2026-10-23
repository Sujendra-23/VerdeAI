import { useI18n } from "../i18n";
import { useOpenTab } from "../hooks/useOpenTab";
import { useUiStore } from "../store/uiStore";
import { parseVoiceCommand, voiceLanguage } from "./commands";
import { stopSpeaking } from "./synthesis";
import type { VoiceLang } from "./voiceStrings";

/** Language the dashboard listens and speaks in right now. */
export function useVoiceLang(): VoiceLang {
  const { locale } = useI18n();
  const language = useUiStore((s) => s.language);
  return voiceLanguage(language, locale);
}

/** Returns a function that runs a spoken command and says whether the phrase was one. */
export function useRunVoiceCommand(lang: VoiceLang) {
  const openTab = useOpenTab();
  return (transcript: string): boolean => {
    const command = parseVoiceCommand(transcript, lang);
    if (!command) return false;
    if (command.type === "tab") openTab(command.tab);
    else stopSpeaking();
    return true;
  };
}
