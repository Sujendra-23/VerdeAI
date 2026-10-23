import type { LanguagePreference, SupportedLocale } from "@verdeai/shared-types";
import { VOICE_STRINGS, type VoiceLang, type VoiceTab } from "./voiceStrings";

export type VoiceCommand = { type: "tab"; tab: VoiceTab } | { type: "stop" };

/** Speak and listen in the chat language the manager picked, otherwise in the interface language. */
export function voiceLanguage(language: LanguagePreference, locale: SupportedLocale): VoiceLang {
  return language === "auto" ? locale : language;
}

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?¿¡。、！？"“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripFillers(text: string, fillers: string[]): string {
  let result = ` ${text} `;
  // Longest first so "show me" goes before "show".
  for (const filler of [...fillers].sort((a, b) => b.length - a.length)) {
    const spaced = /^[\p{L}\p{M}\p{N}' -]+$/u.test(filler) && !/[぀-ヿ一-鿿]/u.test(filler);
    result = spaced ? result.split(` ${filler} `).join(" ") : result.split(filler).join(" ");
  }
  return result.replace(/\s+/g, " ").trim();
}

/**
 * Turns a spoken phrase into a navigation command, or null when it is an ordinary question.
 * The whole phrase has to be a command word (after filler words), so "explain the bowl" stays a question.
 */
export function parseVoiceCommand(transcript: string, lang: VoiceLang): VoiceCommand | null {
  const strings = VOICE_STRINGS[lang];
  const phrase = stripFillers(normalize(transcript), strings.fillers.map(normalize));
  if (!phrase) return null;
  for (const tab of ["waste-risk", "forecast", "explain"] as const) {
    if (strings.commands[tab].some((word) => normalize(word) === phrase)) return { type: "tab", tab };
  }
  if (strings.commands.stop.some((word) => normalize(word) === phrase)) return { type: "stop" };
  return null;
}
