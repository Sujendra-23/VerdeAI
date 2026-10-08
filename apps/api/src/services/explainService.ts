import axios from "axios";
import type {
  ChatMessage,
  ExplainChatResponse,
  ForecastRecord,
  LanguageCode,
  LanguagePreference,
  WasteRiskRecord,
} from "@verdeai/shared-types";
import type { Repository } from "../data/repository.js";
import { languageName, resolveLanguage } from "./language.js";
import { CATALOGS } from "./replyTemplates.js";

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
  language: LanguageCode,
): string {
  return `You are VerdeAI, an AI assistant for restaurant food waste reduction.

Restaurant: ${restaurantId}
Date: ${date}

Forecast: ${JSON.stringify(forecasts)}
Waste Risk: ${JSON.stringify(wasteRisk)}

Answer the manager's questions clearly and concisely, grounded only in the data above.
When first asked for an explanation, summarize the highest-risk items and a concrete
recommendation (e.g. reduce prep volume by a percentage). Keep replies under 120 words.

Reply in ${languageName(language)} (language code "${language}"), whatever language the data or earlier
messages are in. Keep menu item names exactly as they appear in the data.`;
}

/** Used when Azure OpenAI isn't configured, so the dashboard is fully demoable offline. */
function templatedReply(
  forecasts: ForecastRecord[],
  wasteRisk: WasteRiskRecord[],
  question: string | undefined,
  language: LanguageCode,
): string {
  const t = CATALOGS[language];
  if (forecasts.length === 0) {
    return t.noData;
  }

  const highRisk = wasteRisk.filter((w) => w.riskScore === "HIGH");

  if (question) {
    const match = forecasts.find((f) =>
      question.toLowerCase().includes(f.item.toLowerCase()),
    );
    if (match) {
      const risk = wasteRisk.find((w) => w.item === match.item);
      return t.itemReply({
        item: match.item,
        predicted: match.predictedQuantity,
        average: Math.round(match.historicalAverage),
        risk: risk?.riskScore ?? "LOW",
      });
    }
    // No item named: a question about risk/waste/prep gets the overall summary.
    const wantsSummary = t.summaryIntent.test(question) || CATALOGS.en.summaryIntent.test(question);
    if (!wantsSummary) {
      return t.notFound(question, forecasts.map((f) => f.item));
    }
  }

  if (highRisk.length === 0) {
    return t.steady(forecasts.length);
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
      return t.highRiskLine({ item: w.item, predicted: w.predictedQuantity, overBy });
    })
    .join(t.sep);

  return t.highRiskSummary({ high: highRisk.length, total: forecasts.length, lines });
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
    language: LanguagePreference = "auto",
  ): Promise<{ explanation: string; source: "azure-openai" | "template"; language: LanguageCode }> {
    const reply = await this.chat(restaurantId, date, [], language);
    return { explanation: reply.reply.content, source: reply.source, language: reply.language };
  }

  async chat(
    restaurantId: string,
    date: string,
    messages: ChatMessage[],
    languagePreference: LanguagePreference = "auto",
  ): Promise<ExplainChatResponse> {
    const { forecasts, wasteRisk } = await this.loadContext(restaurantId, date);
    const language = resolveLanguage(languagePreference, messages);
    const config = readAzureOpenAiConfig();
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (!config) {
      const content = templatedReply(forecasts, wasteRisk, lastUserMessage?.content, language);
      return { reply: { role: "assistant", content }, source: "template", language };
    }

    const systemPrompt = buildSystemPrompt(restaurantId, date, forecasts, wasteRisk, language);
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
      return { reply: { role: "assistant", content }, source: "azure-openai", language };
    } catch (err) {
      // Azure OpenAI unreachable/misconfigured at runtime — degrade to the
      // templated answer rather than failing the whole panel.
      const content = templatedReply(forecasts, wasteRisk, lastUserMessage?.content, language);
      return { reply: { role: "assistant", content }, source: "template", language };
    }
  }
}
