import { createGraphQLError, createSchema } from "graphql-yoga";
import { isLanguagePreference, type ChatMessage, type LanguagePreference } from "@verdeai/shared-types";
import type { Repository } from "../data/repository.js";
import type { ExplainService } from "../services/explainService.js";

export interface GraphQLContext {
  repository: Repository;
  explainService: ExplainService;
}

const typeDefs = /* GraphQL */ `
  type Restaurant {
    restaurantId: String!
    name: String!
    location: String!
  }

  type ForecastRecord {
    id: String!
    restaurantId: String!
    date: String!
    item: String!
    predictedQuantity: Float!
    historicalAverage: Float!
  }

  enum RiskLevel {
    HIGH
    LOW
  }

  type WasteRiskRecord {
    id: String!
    restaurantId: String!
    date: String!
    item: String!
    predictedQuantity: Float!
    riskScore: RiskLevel!
  }

  """
  Combined forecast + waste-risk + AI explanation for one restaurant/date,
  resolved in a single round trip — the REST API needs three requests for this.
  """
  type RestaurantInsight {
    restaurant: Restaurant!
    date: String!
    forecasts: [ForecastRecord!]!
    wasteRisk: [WasteRiskRecord!]!
    explanation: String!
  }

  enum ExplanationSource {
    AZURE_OPENAI
    TEMPLATE
  }

  enum ChatRole {
    user
    assistant
  }

  input ChatMessageInput {
    role: ChatRole!
    content: String!
  }

  type ChatMessageResult {
    role: ChatRole!
    content: String!
  }

  type ExplainChatResult {
    reply: ChatMessageResult!
    source: ExplanationSource!
    language: String!
  }

  type Query {
    restaurants: [Restaurant!]!
    forecasts(restaurantId: String!, date: String!): [ForecastRecord!]!
    wasteRisk(restaurantId: String!, date: String!): [WasteRiskRecord!]!
    insight(restaurantId: String!, date: String!): RestaurantInsight!
  }

  type Mutation {
    explainChat(
      restaurantId: String!
      date: String!
      messages: [ChatMessageInput!]!
      """'auto' (default) or a code such as en, es, fr, de, pt, it, hi, zh, ja"""
      language: String
    ): ExplainChatResult!
  }
`;

function toSourceEnum(source: "azure-openai" | "template") {
  return source === "azure-openai" ? "AZURE_OPENAI" : "TEMPLATE";
}

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      restaurants: (_parent, _args, ctx) => ctx.repository.listRestaurants(),
      forecasts: (_parent, args: { restaurantId: string; date: string }, ctx) =>
        ctx.repository.getForecasts(args.restaurantId, args.date),
      wasteRisk: (_parent, args: { restaurantId: string; date: string }, ctx) =>
        ctx.repository.getWasteRisk(args.restaurantId, args.date),
      insight: async (
        _parent,
        args: { restaurantId: string; date: string },
        ctx,
      ) => {
        const [restaurants, forecasts, wasteRisk, explainResult] = await Promise.all([
          ctx.repository.listRestaurants(),
          ctx.repository.getForecasts(args.restaurantId, args.date),
          ctx.repository.getWasteRisk(args.restaurantId, args.date),
          ctx.explainService.explain(args.restaurantId, args.date),
        ]);
        const restaurant = restaurants.find((r) => r.restaurantId === args.restaurantId) ?? {
          restaurantId: args.restaurantId,
          name: args.restaurantId,
          location: "",
        };
        return {
          restaurant,
          date: args.date,
          forecasts,
          wasteRisk,
          explanation: explainResult.explanation,
        };
      },
    },
    Mutation: {
      explainChat: async (
        _parent,
        args: {
          restaurantId: string;
          date: string;
          messages: ChatMessage[];
          language?: string | null;
        },
        ctx,
      ) => {
        if (args.language != null && !isLanguagePreference(args.language)) {
          throw createGraphQLError("language must be 'auto' or a supported language code");
        }
        const result = await ctx.explainService.chat(
          args.restaurantId,
          args.date,
          args.messages,
          (args.language ?? "auto") as LanguagePreference,
        );
        return {
          reply: result.reply,
          source: toSourceEnum(result.source),
          language: result.language,
        };
      },
    },
  },
});
