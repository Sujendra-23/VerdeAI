import {
  SUPPORTED_LANGUAGES,
  type ChatMessage,
  type LanguageCode,
  type LanguagePreference,
} from "@verdeai/shared-types";

/**
 * Small dependency-free language detector for short restaurant-manager questions.
 * Non-Latin scripts are identified by Unicode range; Latin-script languages by
 * counting common function words (plus a few diacritic hints). It returns null
 * when it can't tell, e.g. for a bare menu-item name like "Miso Salmon Plate".
 */

const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿]/;
const DEVANAGARI = /[ऀ-ॿ]/;

const STOPWORDS: Record<string, string[]> = {
  en: "the what is are how much many should i my about of to for and today which do does can we is it this that with".split(" "),
  es: "el la los las de que qué es son para por un una y hoy cómo como debería debo mi sobre del con cuál cuáles cuánto cuántos hay en se lo".split(" "),
  fr: "le la les des du de est sont que qu quel quels quelle quelles combien pour un une et aujourd comment dois je mon sur avec il ce cette pas dans".split(" "),
  de: "der die das und ist sind wie viel viele was für ein eine heute soll ich meine meinen über mit welche welcher nicht im den dem zu".split(" "),
  pt: "os as de que é são para por um uma e hoje como devo meu minha sobre com qual quais quanto quantos não em do da no na".split(" "),
  it: "il lo gli le di che è sono per un una e oggi come devo mio mia su con quale quali quanto quanti non nel della del dei cosa".split(" "),
};

const HINTS: Array<[RegExp, LanguageCode, number]> = [
  [/[¿¡ñ]/, "es", 3],
  [/[ãõ]/, "pt", 3],
  [/ß/, "de", 3],
  [/[äöü]/, "de", 1],
  [/œ|qu'/, "fr", 2],
];

function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
}

export function detectLanguage(text: string): LanguageCode | null {
  if (KANA.test(text)) return "ja";
  if (HAN.test(text)) return "zh";
  if (DEVANAGARI.test(text)) return "hi";

  const tokens = new Set(words(text));
  const lower = text.toLowerCase();
  const scores = new Map<string, number>();
  for (const [code, list] of Object.entries(STOPWORDS)) {
    let score = 0;
    for (const w of list) if (tokens.has(w)) score += 1;
    scores.set(code, score);
  }
  for (const [pattern, code, weight] of HINTS) {
    if (pattern.test(lower)) scores.set(code, (scores.get(code) ?? 0) + weight);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] === 0) return null;
  if (second && second[1] === best[1]) return null;
  return best[0] as LanguageCode;
}

/**
 * Picks the reply language: an explicit choice wins; with `auto` the most recent
 * user message that can be identified decides; otherwise English.
 */
export function resolveLanguage(
  preference: LanguagePreference | undefined,
  messages: ChatMessage[],
): LanguageCode {
  if (preference && preference !== "auto") return preference;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    const detected = detectLanguage(m.content);
    if (detected) return detected;
  }
  return "en";
}

export function languageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}
