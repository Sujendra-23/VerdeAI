import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_TAGS, type VoiceLang } from "./voiceStrings";

// The Web Speech API is not in TypeScript's DOM types; only what this app uses is declared.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionConstructor = new () => Recognition;

export function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechError = "denied" | "no-speech" | "failed";

/**
 * One utterance at a time: start() listens until the speaker pauses, then onFinal gets the text.
 * Audio goes to the browser's own speech service; nothing is sent to the VerdeAI API.
 */
export function useSpeechRecognition(lang: VoiceLang, onFinal: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const supported = getRecognitionConstructor() !== null;

  const stop = useCallback(() => { recognitionRef.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = SPEECH_TAGS[lang];
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "no-speech" ? "no-speech" : "failed");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try { recognition.start(); } catch { recognitionRef.current = null; setListening(false); setError("failed"); }
  }, [lang]);

  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  return { supported, listening, interim, error, start, stop };
}
