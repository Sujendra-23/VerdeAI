import { expect, test, type Page } from "@playwright/test";

// Chromium's speech service is not available to automation, so the browser APIs are replaced with
// small fakes: the mic "hears" whatever the test sets in window.__say, and speech output is recorded.
const RESTAURANTS = [{ restaurantId: "R001", name: "Verde Kitchen — Downtown", location: "Seattle, WA" }];
const ROW = { id: "1", restaurantId: "R001", date: "2026-02-05", item: "Grilled Chicken Bowl", predictedQuantity: 60 };
const INSIGHT = {
  restaurant: RESTAURANTS[0], date: "2026-02-05",
  forecasts: [{ ...ROW, historicalAverage: 42 }],
  wasteRisk: [{ ...ROW, riskScore: "HIGH" }],
  explanation: "Grilled Chicken Bowl is trending 43% above average — reduce prep by 15%.",
};

declare global {
  interface Window { __say: string; __spoken: Array<{ text: string; lang: string }>; __lastLang: string }
}

async function installSpeechFakes(page: Page) {
  await page.addInitScript(() => {
    window.__spoken = [];
    window.__say = "";
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        window.__lastLang = this.lang;
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: window.__say } }] });
          this.onend?.();
        }, 20);
      }
      stop() { this.onend?.(); }
      abort() {}
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class { lang = ""; voice = null; constructor(public text: string) {} };
    Object.defineProperty(window, "speechSynthesis", {
      value: { getVoices: () => [], cancel() {}, speak(u: { text: string; lang: string }) { window.__spoken.push({ text: u.text, lang: u.lang }); } },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await installSpeechFakes(page);
  await page.route("**/api/experiments/events", (route) => route.fulfill({ status: 201, json: { status: "recorded" } }));
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", dataSource: "mock" } }));
  await page.route("**/api/restaurants", (route) => route.fulfill({ json: RESTAURANTS }));
  await page.route("**/graphql", (route) => route.fulfill({ json: { data: { insight: INSIGHT } } }));
  await page.route("**/api/explain/chat", (route) =>
    route.fulfill({ json: { reply: { role: "assistant", content: "Reducing prep by 15% keeps you ahead of the surplus." }, source: "template" } }),
  );
});

test("a spoken command opens the Waste Risk tab", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { window.__say = "show me the waste risk"; });
  await page.getByRole("button", { name: "Speak" }).click();
  await expect(page.getByText("HIGH", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__lastLang)).toBe("en-US");
});

test("spoken commands follow the interface language", async ({ page }) => {
  await page.goto("/");
  await page.locator("#language-select").selectOption("es");
  await page.evaluate(() => { window.__say = "riesgo de desperdicio"; });
  await page.getByRole("button", { name: "Hablar" }).click();
  await expect(page.getByText("ALTO", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__lastLang)).toBe("es-ES");
});

test("a spoken question gets an answer that is read aloud in the chosen language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI Explain" }).click();
  await page.getByLabel(/reply language/i).selectOption("fr");
  await page.getByRole("button", { name: "Lire les réponses à voix haute" }).click();
  await page.evaluate(() => { window.__say = "Et le saumon ?"; window.__spoken.length = 0; });
  await page.getByRole("main").getByRole("button", { name: "Parler" }).click();
  await expect(page.getByText("Et le saumon ?")).toBeVisible();
  await expect(page.getByText(/ahead of the surplus/i).last()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spoken.some((s) => /surplus/.test(s.text) && s.lang === "fr-FR"))).toBe(true);
});

test("no microphone button where speech recognition is missing", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as Record<string, unknown>).SpeechRecognition = undefined; (window as unknown as Record<string, unknown>).webkitSpeechRecognition = undefined; });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Speak" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /demand forecast/i })).toBeVisible();
});
