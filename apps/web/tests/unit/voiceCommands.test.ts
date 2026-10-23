import { SUPPORTED_LANGUAGES, SUPPORTED_LOCALES } from "@verdeai/shared-types";
import { describe, expect, it } from "vitest";
import { parseVoiceCommand, voiceLanguage } from "../../src/speech/commands";
import { SPEECH_TAGS, VOICE_STRINGS, type VoiceLang } from "../../src/speech/voiceStrings";

describe("parseVoiceCommand", () => {
  it("opens each tab from a bare word or a polite phrase", () => {
    expect(parseVoiceCommand("Forecast", "en")).toEqual({ type: "tab", tab: "forecast" });
    expect(parseVoiceCommand("Please show me the waste risk.", "en")).toEqual({ type: "tab", tab: "waste-risk" });
    expect(parseVoiceCommand("open AI explain", "en")).toEqual({ type: "tab", tab: "explain" });
  });

  it("understands the same commands in the other languages", () => {
    expect(parseVoiceCommand("muestra el riesgo de desperdicio", "es")).toEqual({ type: "tab", tab: "waste-risk" });
    expect(parseVoiceCommand("Ouvre les prévisions", "fr")).toEqual({ type: "tab", tab: "forecast" });
    expect(parseVoiceCommand("Prognose", "de")).toEqual({ type: "tab", tab: "forecast" });
    expect(parseVoiceCommand("mostrar risco de desperdício", "pt")).toEqual({ type: "tab", tab: "waste-risk" });
    expect(parseVoiceCommand("apri spiegazione", "it")).toEqual({ type: "tab", tab: "explain" });
    expect(parseVoiceCommand("पूर्वानुमान दिखाओ", "hi")).toEqual({ type: "tab", tab: "forecast" });
    expect(parseVoiceCommand("打开浪费风险", "zh")).toEqual({ type: "tab", tab: "waste-risk" });
    expect(parseVoiceCommand("予測を表示", "ja")).toEqual({ type: "tab", tab: "forecast" });
    expect(parseVoiceCommand("ವಿವರಣೆ ತೆರೆಯಿರಿ", "kn")).toEqual({ type: "tab", tab: "explain" });
  });

  it("recognizes stop in several languages", () => {
    expect(parseVoiceCommand("stop", "en")).toEqual({ type: "stop" });
    expect(parseVoiceCommand("silencio", "es")).toEqual({ type: "stop" });
    expect(parseVoiceCommand("ストップ", "ja")).toEqual({ type: "stop" });
  });

  it("leaves real questions for the assistant", () => {
    expect(parseVoiceCommand("Explain the Grilled Chicken Bowl", "en")).toBeNull();
    expect(parseVoiceCommand("What is the waste risk for salmon?", "en")).toBeNull();
    expect(parseVoiceCommand("   ", "en")).toBeNull();
  });
});

describe("voice language tables", () => {
  it("covers every chat language and interface language with strings and a speech tag", () => {
    const codes = new Set<VoiceLang>([...SUPPORTED_LANGUAGES.map((l) => l.code), ...SUPPORTED_LOCALES]);
    for (const code of codes) {
      expect(VOICE_STRINGS[code], code).toBeDefined();
      expect(SPEECH_TAGS[code], code).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      for (const key of ["forecast", "waste-risk", "explain", "stop"] as const) expect(VOICE_STRINGS[code].commands[key].length, `${code} ${key}`).toBeGreaterThan(0);
    }
    expect(Object.keys(VOICE_STRINGS).sort()).toEqual([...codes].sort());
  });

  it("listens in the chat language when one is chosen, otherwise the interface language", () => {
    expect(voiceLanguage("auto", "kn")).toBe("kn");
    expect(voiceLanguage("ja", "en")).toBe("ja");
  });
});
