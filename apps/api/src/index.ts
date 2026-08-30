import "dotenv/config";
import { createRepository } from "./data/repository.js";
import { createServer } from "./server.js";

const repository = createRepository();
const app = createServer(repository);
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[verdeai-api] listening on http://localhost:${port} (data source: ${repository.mode})`,
  );
  // eslint-disable-next-line no-console
  console.log(`[verdeai-api] REST:    http://localhost:${port}/api/*`);
  // eslint-disable-next-line no-console
  console.log(`[verdeai-api] GraphQL: http://localhost:${port}/graphql`);
});
