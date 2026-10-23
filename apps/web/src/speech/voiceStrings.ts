import type { LanguageCode, SupportedLocale } from "@verdeai/shared-types";

/** Every language the dashboard can listen to or speak: the 9 chat languages plus the Kannada interface. */
export type VoiceLang = LanguageCode | SupportedLocale;

export type VoiceTab = "forecast" | "waste-risk" | "explain";

export interface VoiceStrings {
  start: string;
  stop: string;
  listening: string;
  notUnderstood: string;
  micDenied: string;
  readAloud: string;
  /** Spoken navigation: a whole phrase must equal one of these once filler words are removed. */
  commands: Record<VoiceTab | "stop", string[]>;
  /** Polite words dropped before matching ("open", "show me", "please"). */
  fillers: string[];
}

/**
 * Hand-written, not reviewed by native speakers. Command phrases are matched whole, so
 * "explain" opens the tab but "explain the chicken bowl" is still sent as a question.
 */
export const VOICE_STRINGS: Record<VoiceLang, VoiceStrings> = {
  en: {
    start: "Speak", stop: "Stop listening", listening: "Listening…",
    notUnderstood: "Sorry, I didn't catch that.", micDenied: "Microphone access was blocked.", readAloud: "Read replies aloud",
    commands: {
      forecast: ["forecast", "demand forecast"], "waste-risk": ["waste risk", "food waste risk", "waste"],
      explain: ["explain", "ai explain", "assistant", "chat"], stop: ["stop", "stop reading", "quiet", "be quiet", "silence"],
    },
    fillers: ["take me to", "show me", "go to", "open", "show", "please", "the", "tab"],
  },
  es: {
    start: "Hablar", stop: "Dejar de escuchar", listening: "Escuchando…",
    notUnderstood: "Perdón, no te he entendido.", micDenied: "Se bloqueó el acceso al micrófono.", readAloud: "Leer las respuestas en voz alta",
    commands: {
      forecast: ["previsión", "prevision", "previsión de demanda", "pronóstico"], "waste-risk": ["riesgo de desperdicio", "desperdicio"],
      explain: ["explicación", "explicacion", "explicación ia", "explicar"], stop: ["parar", "para", "detener", "silencio"],
    },
    fillers: ["por favor", "muestra", "mostrar", "abre", "abrir", "ve a", "ir a", "la", "el", "pestaña"],
  },
  fr: {
    start: "Parler", stop: "Arrêter l’écoute", listening: "Écoute en cours…",
    notUnderstood: "Désolé, je n’ai pas compris.", micDenied: "L’accès au micro a été bloqué.", readAloud: "Lire les réponses à voix haute",
    commands: {
      forecast: ["prévision", "prévisions", "prévision de la demande"], "waste-risk": ["risque de gaspillage", "gaspillage"],
      explain: ["explication", "explication ia", "expliquer"], stop: ["arrête", "arrêter", "stop", "silence", "tais-toi"],
    },
    fillers: ["s'il te plaît", "s'il vous plaît", "aller à", "affiche", "afficher", "montre", "ouvre", "ouvrir", "va à", "les", "la", "le", "onglet"],
  },
  de: {
    start: "Sprechen", stop: "Zuhören beenden", listening: "Ich höre zu …",
    notUnderstood: "Entschuldigung, das habe ich nicht verstanden.", micDenied: "Der Mikrofonzugriff wurde blockiert.", readAloud: "Antworten vorlesen",
    commands: {
      forecast: ["prognose", "bedarfsprognose", "vorhersage"], "waste-risk": ["abfallrisiko", "verschwendungsrisiko", "risiko für lebensmittelverschwendung"],
      explain: ["erklärung", "ki-erklärung", "erklären"], stop: ["stopp", "stop", "ruhe", "aufhören"],
    },
    fillers: ["zeige mir", "gehe zu", "bitte", "öffne", "öffnen", "zeige", "zeig", "die", "der", "das", "tab"],
  },
  pt: {
    start: "Falar", stop: "Parar de ouvir", listening: "Ouvindo…",
    notUnderstood: "Desculpe, não entendi.", micDenied: "O acesso ao microfone foi bloqueado.", readAloud: "Ler as respostas em voz alta",
    commands: {
      forecast: ["previsão", "previsao", "previsão de demanda"], "waste-risk": ["risco de desperdício", "risco de desperdicio", "desperdício"],
      explain: ["explicação", "explicacao", "explicação com ia", "explicar"], stop: ["parar", "pare", "silêncio", "silencio"],
    },
    fillers: ["por favor", "vá para", "ir para", "mostrar", "mostre", "abrir", "abra", "a", "o", "aba"],
  },
  it: {
    start: "Parla", stop: "Smetti di ascoltare", listening: "In ascolto…",
    notUnderstood: "Scusa, non ho capito.", micDenied: "L’accesso al microfono è stato bloccato.", readAloud: "Leggi le risposte ad alta voce",
    commands: {
      forecast: ["previsione", "previsioni", "previsione della domanda"], "waste-risk": ["rischio di spreco", "spreco"],
      explain: ["spiegazione", "spiegazione con ia", "spiega", "spiegare"], stop: ["ferma", "fermati", "stop", "silenzio"],
    },
    fillers: ["per favore", "mostrami", "vai a", "apri", "aprire", "mostra", "la", "il", "scheda"],
  },
  hi: {
    start: "बोलें", stop: "सुनना बंद करें", listening: "सुन रहा है…",
    notUnderstood: "माफ़ कीजिए, मैं समझ नहीं पाया।", micDenied: "माइक्रोफ़ोन की अनुमति रोकी गई है।", readAloud: "उत्तर ज़ोर से पढ़ें",
    commands: {
      forecast: ["पूर्वानुमान", "माँग का पूर्वानुमान", "मांग का पूर्वानुमान"], "waste-risk": ["बर्बादी का जोखिम", "भोजन बर्बादी का जोखिम", "बर्बादी"],
      explain: ["स्पष्टीकरण", "ai स्पष्टीकरण", "समझाओ", "विवरण", "ai विवरण"], stop: ["रुको", "रुकिए", "बंद करो", "चुप"],
    },
    fillers: ["कृपया", "खोलो", "खोलें", "दिखाओ", "दिखाएं", "जाओ", "टैब"],
  },
  zh: {
    start: "说话", stop: "停止聆听", listening: "正在聆听…",
    notUnderstood: "抱歉，我没听清。", micDenied: "麦克风权限已被阻止。", readAloud: "朗读回复",
    commands: {
      forecast: ["预测", "需求预测"], "waste-risk": ["浪费风险", "食物浪费风险", "浪费"],
      explain: ["解读", "ai解读", "ai 解读", "解释"], stop: ["停止", "停", "安静"],
    },
    fillers: ["切换到", "打开", "显示", "请", "标签页"],
  },
  ja: {
    start: "話す", stop: "聞き取りを止める", listening: "聞いています…",
    notUnderstood: "すみません、聞き取れませんでした。", micDenied: "マイクへのアクセスがブロックされています。", readAloud: "返信を読み上げる",
    commands: {
      forecast: ["予測", "需要予測"], "waste-risk": ["廃棄リスク", "廃棄", "フードロスリスク"],
      explain: ["解説", "ai解説", "ai による解説", "説明"], stop: ["止めて", "停止", "ストップ", "静かに"],
    },
    fillers: ["お願いします", "を開いて", "開いて", "を表示", "表示して", "表示", "タブ"],
  },
  kn: {
    start: "ಮಾತನಾಡಿ", stop: "ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ", listening: "ಆಲಿಸುತ್ತಿದೆ…",
    notUnderstood: "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ.", micDenied: "ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶವನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ.", readAloud: "ಉತ್ತರಗಳನ್ನು ಗಟ್ಟಿಯಾಗಿ ಓದಿ",
    commands: {
      forecast: ["ಮುನ್ಸೂಚನೆ", "ಬೇಡಿಕೆ ಮುನ್ಸೂಚನೆ"], "waste-risk": ["ವ್ಯರ್ಥದ ಅಪಾಯ", "ಆಹಾರ ವ್ಯರ್ಥದ ಅಪಾಯ", "ವ್ಯರ್ಥ"],
      explain: ["ವಿವರಣೆ", "ai ವಿವರಣೆ"], stop: ["ನಿಲ್ಲಿಸಿ", "ನಿಲ್ಲಿಸು", "ಸುಮ್ಮನಿರಿ"],
    },
    fillers: ["ದಯವಿಟ್ಟು", "ತೆರೆಯಿರಿ", "ತೋರಿಸಿ", "ಟ್ಯಾಬ್"],
  },
};

/** BCP-47 tags the browser's recognizer and voices understand. */
export const SPEECH_TAGS: Record<VoiceLang, string> = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR",
  it: "it-IT", hi: "hi-IN", zh: "zh-CN", ja: "ja-JP", kn: "kn-IN",
};

export function voiceStrings(lang: VoiceLang): VoiceStrings {
  return VOICE_STRINGS[lang];
}
