import axios from "axios";
import type {
  ChatMessage,
  ExplainChatResponse,
  ForecastRecord,
  WasteRiskRecord,
} from "@verdeai/shared-types";
import type { Repository } from "../data/repository.js";

interface AzureOpenAiConfig {
  endpoint: string;
  deployment: string;
  apiKey: string;
}

function readAzureOpenAiConfig(
  env: NodeJS.ProcessEnv = process.env,
): AzureOpenAiConfig | null {
  const endpoint = env.AZURE_OPENAI_ENDPOINT;
  const deployment = env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = env.AZURE_OPENAI_API_KEY;
  if (endpoint && deployment && apiKey) {
    return { endpoint, deployment, apiKey };
  }
  return null;
}

function buildSystemPrompt(
  restaurantId: string,
  date: string,
  forecasts: ForecastRecord[],
  wasteRisk: WasteRiskRecord[],
): string {
  return `You are VerdeAI, an AI assistant for restaurant food waste reduction.

Restaurant: ${restaurantId}
Date: ${date}

Forecast: ${JSON.stringify(forecasts)}
Waste Risk: ${JSON.stringify(wasteRisk)}

Answer the manager's questions clearly and concisely, grounded only in the data above.
When first asked for an explanation, summarize the highest-risk items and a concrete
recommendation (e.g. reduce prep volume by a percentage). Keep replies under 120 words.`;
}

/** Used when Azure OpenAI isn't configured, so the dashboard is fully demoable offline. */
function templatedReply(
  forecasts: ForecastRecord[],
  wasteRisk: WasteRiskRecord[],
  question: string | undefined,
): string {
  if (forecasts.length === 0) {
    return "No forecast data is available for that restaurant and date yet — the nightly VerdeAI_GenerateForecast job hasn't produced a record for this combination.";
  }

  const highRisk = wasteRisk.filter((w) => w.riskScore === "HIGH");

  if (question) {
    const match = forecasts.find((f) =>
      question.toLowerCase().includes(f.item.toLowerCase()),
    );
    if (match) {
      const risk = wasteRisk.find((w) => w.item === match.item);
      return `${match.item}: forecast is ${match.predictedQuantity} units vs a historical average of ${Math.round(match.historicalAverage)}. Waste risk is ${risk?.riskScore ?? "LOW"}.${risk?.riskScore === "HIGH" ? " Consider trimming prep by roughly 15-20% to stay ahead of the surplus." : " Current prep levels look appropriate."}`;
    }
    return `I don't see "${question}" by name in today's forecast. The tracked items are: ${forecasts.map((f) => f.item).join(", ")}.`;
  }

  if (highRisk.length === 0) {
    return `Demand looks steady across all ${forecasts.length} tracked items today — no items are flagged HIGH risk. No prep changes recommended.`;
  }

  const lines = highRisk
    .map((w) => {
      const forecast = forecasts.find((f) => f.item === w.item);
      const overBy = forecast
        ? Math.round(
            ((forecast.predictedQuantity - forecast.historicalAverage) /
              forecast.historicalAverage) *
              100,
          )
        : null;
      return `${w.item} (forecast ${w.predictedQuantity}${overBy !== null ? `, ~${overBy}% above average` : ""})`;
    })
    .join(", ");

  return `${highRisk.length} of ${forecasts.length} items are trending toward overproduction today: ${lines}. Reduce prep volume on these by ~15% and monitor sell-through at midday to avoid discarding surplus.`;
}

export class ExplainService {
  constructor(private readonly repository: Repository) {}

  private async loadContext(restaurantId: string, date: string) {
    const [forecasts, wasteRisk] = await Promise.all([
      this.repository.getForecasts(restaurantId, date),
      this.repository.getWasteRisk(restaurantId, date),
    ]);
    return { forecasts, wasteRisk };
  }

  async explain(
    restaurantId: string,
    date: string,
  ): Promise<{ explanation: string; source: "azure-openai" | "template" }> {
    const reply = await this.chat(restaurantId, date, []);
    return { explanation: reply.reply.content, source: reply.source };
  }

  async chat(
    restaurantId: string,
    date: string,
    messages: ChatMessage[],
  ): Promise<ExplainChatResponse> {
    const { forecasts, wasteRisk } = await this.loadContext(restaurantId, date);
    const config = readAzureOpenAiConfig();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!config) {
      const content = templatedReply(forecasts, wasteRisk, lastUserMessage?.content);
      return { reply: { role: "assistant", content }, source: "template" };
    }

    const systemPrompt = buildSystemPrompt(restaurantId, date, forecasts, wasteRisk);
    const conversation = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
    if (conversation.length === 1) {
      conversation.push({
        role: "user",
        content: "Explain today's forecast and waste risk for this restaurant.",
      });
    }

    try {
      const response = await axios.post(
        `${config.endpoint}openai/deployments/${config.deployment}/chat/completions?api-version=2024-02-15-preview`,
        { messages: conversation, max_tokens: 300 },
        {
          headers: {
            "api-key": config.apiKey,
            "Content-Type": "application/json",
          },
        },
      );
      const content: string = response.data.choices[0].message.content;
      return { reply: { role: "assistant", content }, source: "azure-openai" };
    } catch (err) {
      // Azure OpenAI unreachable/misconfigured at runtime — degrade to the
      // templated answer rather than failing the whole panel.
      const content = templatedReply(forecasts, wasteRisk, lastUserMessage?.content);
      return { reply: { role: "assistant", content }, source: "template" };
    }
  }
}
