import { SPEECH_TAGS, type VoiceLang } from "./voiceStrings";

export function speechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Reads text aloud in the given language, replacing anything already being spoken. */
export function speak(text: string, lang: VoiceLang): void {
  if (!speechOutputSupported() || !text.trim()) return;
  const tag = SPEECH_TAGS[lang];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = tag;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}
