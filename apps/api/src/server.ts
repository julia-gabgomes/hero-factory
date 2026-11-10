import { config } from "dotenv";
import { buildApp } from "./app.js";
import { createDbClient } from "./db/client.js";

config({ path: "../../.env" });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não definida. Copie .env.example para .env na raiz do repositório.",
  );
}

const { db } = createDbClient(process.env.DATABASE_URL);
const app = buildApp({ db });

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
