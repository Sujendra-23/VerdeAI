import { expect, test } from "@playwright/test";

// Network is mocked at the route level so this suite never depends on
// apps/api actually running (let alone live Cosmos DB / Azure OpenAI creds).

const RESTAURANTS = [
  { restaurantId: "R001", name: "Verde Kitchen — Downtown", location: "Seattle, WA" },
];

const INSIGHT = {
  restaurant: RESTAURANTS[0],
  date: "2026-02-05",
  forecasts: [
    {
      id: "1",
      restaurantId: "R001",
      date: "2026-02-05",
      item: "Grilled Chicken Bowl",
      predictedQuantity: 60,
      historicalAverage: 42,
    },
  ],
  wasteRisk: [
    {
      id: "1",
      restaurantId: "R001",
      date: "2026-02-05",
      item: "Grilled Chicken Bowl",
      predictedQuantity: 60,
      riskScore: "HIGH",
    },
  ],
  explanation: "Grilled Chicken Bowl is trending 43% above average — reduce prep by 15%.",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { status: "ok", dataSource: "mock" } }),
  );
  await page.route("**/api/restaurants", (route) => route.fulfill({ json: RESTAURANTS }));
  await page.route("**/graphql", (route) =>
    route.fulfill({ json: { data: { insight: INSIGHT } } }),
  );
  await page.route("**/api/explain/chat", (route) =>
    route.fulfill({
      json: {
        reply: {
          role: "assistant",
          content: "Reducing prep by 15% should keep you ahead of the surplus.",
        },
        source: "template",
      },
    }),
  );
});

test("dashboard loads the forecast panel by default and shows seeded data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /demand forecast/i })).toBeVisible();
  await expect(page.getByText("Grilled Chicken Bowl")).toBeVisible();
});

test("switching to Waste Risk shows the HIGH risk badge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /waste risk/i }).click();
  // { exact: true } targets the risk badge itself, not the summary sentence
  // above it ("1 of 1 items flagged HIGH risk today.") which also contains "HIGH".
  await expect(page.getByText("HIGH", { exact: true })).toBeVisible();
});

test("AI Explain chat seeds the explanation and answers a follow-up question", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "AI Explain" }).click();
  await expect(page.getByText(/reduce prep by 15%/i)).toBeVisible();

  await page.getByPlaceholder(/ask about a menu item/i).fill("What about the Grilled Chicken Bowl?");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/keep you ahead of the surplus/i)).toBeVisible();
});


test("fits the viewport and keeps navigation and chat controls reachable", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("Grilled Chicken Bowl")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("forecast.png") });
  await page.getByRole("button", { name: "AI Explain" }).click();
  await expect(page.getByRole("textbox", { name: "Ask VerdeAI" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Send" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("chat.png") });
});

test("explains offline limitations", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("Grilled Chicken Bowl")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("You’re offline");
  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0);
});

const LANGUAGE_CASES = [
  { locale: 'kn', heading: 'ಬೇಡಿಕೆ ಮುನ್ಸೂಚನೆ', risk: 'ಆಹಾರ ವ್ಯರ್ಥದ ಅಪಾಯ', high: 'ಹೆಚ್ಚು', explain: 'AI ವಿವರಣೆ', ask: 'VerdeAI ಅನ್ನು ಕೇಳಿ', send: 'ಕಳುಹಿಸಿ' },
  { locale: 'hi', heading: 'माँग का पूर्वानुमान', risk: 'भोजन बर्बादी का जोखिम', high: 'अधिक', explain: 'AI विवरण', ask: 'VerdeAI से पूछें', send: 'भेजें' },
  { locale: 'fr', heading: 'Prévision de la demande', risk: 'Risque de gaspillage', high: 'ÉLEVÉ', explain: 'Explication IA', ask: 'Interroger VerdeAI', send: 'Envoyer' },
  { locale: 'es', heading: 'Previsión de demanda', risk: 'Riesgo de desperdicio', high: 'ALTO', explain: 'Explicación IA', ask: 'Preguntar a VerdeAI', send: 'Enviar' },
];
for (const language of LANGUAGE_CASES) {
  test(`language ${language.locale} translates panels, persists, and reaches the AI API`, async ({ page }, testInfo) => {
    await page.goto('/');
    await page.locator('#language-select').selectOption(language.locale);
    await expect(page.getByRole('heading', { name: new RegExp(language.heading) })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', language.locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${language.locale}-forecast.png`) });
    await page.reload();
    await expect(page.locator('#language-select')).toHaveValue(language.locale);
    await page.getByRole('button', { name: language.risk, exact: true }).click();
    await expect(page.getByText(language.high, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: language.explain, exact: true }).click();
    const insightRequest = page.waitForRequest((req) => req.url().endsWith('/graphql') && req.postDataJSON().variables.locale === 'en');
    await page.locator('#language-select').selectOption('en');
    await insightRequest;
    await expect(page.getByText(/reduce prep by 15%/i)).toBeVisible();
    await page.getByRole('textbox', { name: 'Ask VerdeAI' }).fill('English thread question');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText('English thread question')).toBeVisible();
    await page.locator('#language-select').selectOption(language.locale);
    await expect(page.getByText('English thread question')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: language.ask })).toBeInViewport();
    await expect(page.getByRole('button', { name: language.send, exact: true })).toBeInViewport();
    const request = page.waitForRequest('**/api/explain/chat');
    await page.getByRole('textbox', { name: language.ask }).fill('Grilled Chicken Bowl');
    await page.getByRole('button', { name: language.send, exact: true }).click();
    expect((await request).postDataJSON().locale).toBe(language.locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}


test('chat stays above bottom navigation on a small phone with expanded translations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#language-select').selectOption('fr');
  await page.getByRole('button', { name: 'Explication IA', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Interroger VerdeAI' });
  await expect(input).toBeInViewport();
  const form = await page.locator('form').boundingBox();
  const nav = await page.getByRole('navigation').boundingBox();
  expect(form!.y + form!.height).toBeLessThanOrEqual(nav!.y);
  await input.fill('Grilled Chicken Bowl');
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await expect(page.getByText(/keep you ahead of the surplus/i)).toBeVisible();
});
