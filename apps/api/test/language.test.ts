import { describe, expect, it } from "vitest";
import { detectLanguage, resolveLanguage } from "../src/services/language.js";

const CASES: Array<[string, string]> = [
  ["en", "What should I prep less of today?"],
  ["en", "How much surplus is the Miso Salmon Plate going to leave?"],
  ["es", "¿Qué plato tiene más riesgo de desperdicio hoy?"],
  ["es", "Cuántos artículos debería reducir para mañana"],
  ["fr", "Quels plats ont le plus de risque de gaspillage aujourd'hui ?"],
  ["fr", "Combien dois-je préparer pour demain ?"],
  ["de", "Welche Gerichte haben heute das höchste Verschwendungsrisiko?"],
  ["de", "Wie viel soll ich von dem Lachs vorbereiten?"],
  ["pt", "Quais pratos têm mais risco de desperdício hoje?"],
  ["pt", "Quanto devo preparar para amanhã?"],
  ["it", "Quali piatti hanno più rischio di spreco oggi?"],
  ["it", "Quanto devo preparare per domani?"],
  ["hi", "आज किस आइटम में सबसे ज़्यादा जोखिम है?"],
  ["zh", "今天哪些菜品的浪费风险最高？"],
  ["ja", "今日はどの品目の廃棄リスクが高いですか？"],
];

describe("detectLanguage", () => {
  it.each(CASES)("recognises %s: %s", (code, text) => {
    expect(detectLanguage(text)).toBe(code);
  });

  it("returns null when there is nothing to go on, like a bare menu item name", () => {
    expect(detectLanguage("Miso Salmon Plate")).toBeNull();
    expect(detectLanguage("")).toBeNull();
  });

  it("returns null on a tie instead of guessing", () => {
    expect(detectLanguage("la de")).toBeNull();
  });
});

describe("resolveLanguage", () => {
  it("honours an explicit language over what the user typed", () => {
    expect(resolveLanguage("fr", [{ role: "user", content: "What about the salmon?" }])).toBe("fr");
  });

  it("auto-detects from the most recent identifiable user message", () => {
    expect(
      resolveLanguage("auto", [
        { role: "user", content: "What should I prep less of today?" },
        { role: "assistant", content: "..." },
        { role: "user", content: "¿Y qué pasa con el riesgo de mañana?" },
      ]),
    ).toBe("es");
  });

  it("falls back to an earlier message when the latest is unidentifiable", () => {
    expect(
      resolveLanguage("auto", [
        { role: "user", content: "¿Qué plato tiene más riesgo hoy?" },
        { role: "assistant", content: "..." },
        { role: "user", content: "Miso Salmon Plate" },
      ]),
    ).toBe("es");
  });

  it("defaults to English with no usable message", () => {
    expect(resolveLanguage(undefined, [])).toBe("en");
    expect(resolveLanguage("auto", [{ role: "user", content: "Miso Salmon Plate" }])).toBe("en");
  });
});
