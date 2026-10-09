import cors from "cors";
import express, { type Express } from "express";
import { createYoga } from "graphql-yoga";
import { createRepository, type Repository } from "./data/repository.js";
import { schema, type GraphQLContext } from "./graphql/schema.js";
import { createBookingRouter, jsonErrorHandler } from "./bookings/routes.js";
import { MemoryBookingStore } from "./bookings/memoryStore.js";
import { BookingService } from "./bookings/service.js";
import type { BookingStore } from "./bookings/store.js";
import { createRestRouter } from "./rest/routes.js";
import { ExplainService } from "./services/explainService.js";

export interface ServerOptions {
  /** Where bookings are stored. Defaults to in-memory (the mock-data demo mode). */
  bookings?: BookingStore;
  clock?: () => Date;
}

export function createServer(
  repository: Repository = createRepository(),
  options: ServerOptions = {},
): Express {
  if (repository.mode === "cosmos" && !options.bookings) {
    // Falling back to memory here would silently lose every booking on restart.
    throw new Error("a BookingStore must be supplied when running against Cosmos DB");
  }
  const explainService = new ExplainService(repository);
  const bookingService = new BookingService(
    repository,
    options.bookings ?? new MemoryBookingStore(),
    options.clock,
  );
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", createRestRouter(repository, explainService));
  app.use("/api", createBookingRouter(bookingService));

  // Yoga's Node adapter matches against req.originalUrl (the full path),
  // not the Express-rewritten req.url — so graphqlEndpoint must be the same
  // path this is mounted at below, not "/".
  const yoga = createYoga<object, GraphQLContext>({
    schema,
    graphqlEndpoint: "/graphql",
    context: (): GraphQLContext => ({ repository, explainService }),
  });
  app.use("/graphql", yoga);

  app.use(jsonErrorHandler);

  return app;
}
