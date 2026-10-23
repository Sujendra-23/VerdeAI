import { useState } from "react";
import { useSpeechRecognition } from "../speech/useSpeechRecognition";
import { voiceStrings, type VoiceLang } from "../speech/voiceStrings";

interface Props {
  lang: VoiceLang;
  /** Return false when the phrase was not understood so the button can say so. */
  onTranscript: (text: string) => boolean;
  /** Which side of the button the note about what it heard appears on. */
  noteSide?: "above" | "below";
}

/**
 * Microphone button that listens for one phrase in `lang`; renders nothing where the browser has no speech recognition.
 * Icon-only on phones so it fits beside the other controls; what it heard or any problem appears in a small note above it.
 */
export function VoiceButton({ lang, onTranscript, noteSide = "above" }: Props) {
  const strings = voiceStrings(lang);
  const [missed, setMissed] = useState(false);
  const { supported, listening, interim, error, start, stop } = useSpeechRecognition(lang, (text) => setMissed(!onTranscript(text)));
  if (!supported) return null;
  const message = error === "denied" ? strings.micDenied : error === "no-speech" || missed ? strings.notUnderstood : listening ? interim || strings.listening : "";
  const label = listening ? strings.stop : strings.start;
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-pressed={listening}
        aria-label={label}
        title={label}
        onClick={() => { setMissed(false); if (listening) stop(); else start(); }}
        className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium md:w-full ${listening ? "border-verde-500 bg-verde-600/20 text-verde-400" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}
      >
        <span aria-hidden="true">{listening ? "⏹" : "🎤"}</span>
        <span className="hidden md:inline">{label}</span>
      </button>
      <p aria-live="polite" className={message ? `absolute ${noteSide === "above" ? "bottom-full mb-2" : "top-full mt-2"} end-0 z-20 w-max max-w-[min(16rem,80vw)] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200` : "sr-only"}>{message}</p>
    </div>
  );
}
