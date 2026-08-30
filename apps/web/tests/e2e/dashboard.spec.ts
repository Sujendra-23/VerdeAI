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
