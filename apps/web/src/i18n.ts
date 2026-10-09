import type { LanguageCode, LanguagePreference } from "@verdeai/shared-types";

/** Interface text for the AI Explain panel. Chat replies come from the API in the chosen language. */
export interface PanelStrings {
  title: string;
  languageLabel: string;
  auto: string;
  loading: string;
  thinking: string;
  placeholder: string;
  send: string;
}

export const PANEL_STRINGS: Record<LanguageCode, PanelStrings> = {
  en: {
    title: "AI Explain",
    languageLabel: "Reply language",
    auto: "Auto-detect",
    loading: "Loading today's insight…",
    thinking: "VerdeAI is thinking…",
    placeholder: "Ask about a menu item, e.g. “What about the Miso Salmon Plate?”",
    send: "Send",
  },
  es: {
    title: "Explicación con IA",
    languageLabel: "Idioma de respuesta",
    auto: "Detectar automáticamente",
    loading: "Cargando el análisis de hoy…",
    thinking: "VerdeAI está pensando…",
    placeholder: "Pregunta por un plato, p. ej. «¿Qué pasa con el Miso Salmon Plate?»",
    send: "Enviar",
  },
  fr: {
    title: "Explication par IA",
    languageLabel: "Langue de réponse",
    auto: "Détection automatique",
    loading: "Chargement de l'analyse du jour…",
    thinking: "VerdeAI réfléchit…",
    placeholder: "Posez une question sur un plat, p. ex. « Et le Miso Salmon Plate ? »",
    send: "Envoyer",
  },
  de: {
    title: "KI-Erklärung",
    languageLabel: "Antwortsprache",
    auto: "Automatisch erkennen",
    loading: "Heutige Analyse wird geladen …",
    thinking: "VerdeAI denkt nach …",
    placeholder: "Fragen Sie nach einem Gericht, z. B. „Was ist mit dem Miso Salmon Plate?“",
    send: "Senden",
  },
  pt: {
    title: "Explicação com IA",
    languageLabel: "Idioma da resposta",
    auto: "Detectar automaticamente",
    loading: "Carregando a análise de hoje…",
    thinking: "A VerdeAI está pensando…",
    placeholder: "Pergunte sobre um prato, ex.: “E o Miso Salmon Plate?”",
    send: "Enviar",
  },
  it: {
    title: "Spiegazione con IA",
    languageLabel: "Lingua di risposta",
    auto: "Rileva automaticamente",
    loading: "Caricamento dell'analisi di oggi…",
    thinking: "VerdeAI sta pensando…",
    placeholder: "Chiedi di un piatto, ad es. «E il Miso Salmon Plate?»",
    send: "Invia",
  },
  hi: {
    title: "AI स्पष्टीकरण",
    languageLabel: "उत्तर की भाषा",
    auto: "अपने आप पहचानें",
    loading: "आज का विश्लेषण लोड हो रहा है…",
    thinking: "VerdeAI सोच रहा है…",
    placeholder: "किसी मेनू आइटम के बारे में पूछें, जैसे “Miso Salmon Plate का क्या?”",
    send: "भेजें",
  },
  zh: {
    title: "AI 解读",
    languageLabel: "回复语言",
    auto: "自动检测",
    loading: "正在加载今天的分析…",
    thinking: "VerdeAI 正在思考…",
    placeholder: "询问某个菜品，例如“Miso Salmon Plate 怎么样？”",
    send: "发送",
  },
  ja: {
    title: "AI による解説",
    languageLabel: "返信言語",
    auto: "自動検出",
    loading: "本日の分析を読み込み中…",
    thinking: "VerdeAI が考えています…",
    placeholder: "メニューについて質問できます（例：「Miso Salmon Plate はどう？」）",
    send: "送信",
  },
};

/** Panel text follows an explicit language choice; `auto` keeps the interface in English. */
export function panelStrings(language: LanguagePreference): PanelStrings {
  return PANEL_STRINGS[language === "auto" ? "en" : language];
}
