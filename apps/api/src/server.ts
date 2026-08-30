import cors from "cors";
import express, { type Express } from "express";
import { createYoga } from "graphql-yoga";
import { createRepository, type Repository } from "./data/repository.js";
import { schema, type GraphQLContext } from "./graphql/schema.js";
import { createRestRouter } from "./rest/routes.js";
import { ExplainService } from "./services/explainService.js";

export function createServer(repository: Repository = createRepository()): Express {
  const explainService = new ExplainService(repository);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", createRestRouter(repository, explainService));

  // Yoga's Node adapter matches against req.originalUrl (the full path),
  // not the Express-rewritten req.url — so graphqlEndpoint must be the same
  // path this is mounted at below, not "/".
  const yoga = createYoga<object, GraphQLContext>({
    schema,
    graphqlEndpoint: "/graphql",
    context: (): GraphQLContext => ({ repository, explainService }),
  });
  app.use("/graphql", yoga);

  return app;
}
