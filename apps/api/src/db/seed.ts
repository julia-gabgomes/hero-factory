import { fileURLToPath } from "node:url";
import { v7 as uuidv7 } from "uuid";
import { heroes } from "./schema/heroes.js";
import { createDbClient, type Database } from "./client.js";

export const TOTAL_SEED_HEROES = 100_000;
const BATCH_SIZE = 1000;

const UNIVERSES = [
  "Marvel",
  "DC",
  "Invincible",
  "The Boys",
  "My Hero Academia",
];
const MAIN_POWERS = [
  "Super força",
  "Voo",
  "Telepatia",
  "Velocidade",
  "Regeneração",
  "Controle elemental",
  "Invisibilidade",
  "Visão de raios-X",
];

const BASE_BIRTH_DATE_UTC = Date.UTC(1950, 0, 1);
const BIRTH_DATE_RANGE_DAYS = 20_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function pickCyclic<T>(pool: readonly T[], index: number): T {
  // Seguro por construção: `index % pool.length` sempre cai dentro dos
  // limites de um array não vazio conhecido em tempo de compilação.
  return pool[index % pool.length] as T;
}

function formatDateOfBirth(index: number): string {
  const offsetDays = index % BIRTH_DATE_RANGE_DAYS;
  const date = new Date(
    BASE_BIRTH_DATE_UTC + offsetDays * MILLISECONDS_PER_DAY,
  );
  return date.toISOString().slice(0, 10);
}

// Nomes determinísticos (nunca randomUUID()): é isso que faz o INSERT IGNORE
// (bloqueado pelo índice único name+nickname+date_of_birth) ser idempotente
// entre execuções. Alguns grupos existem de propósito para o benchmark
// (bench/heroes.js): "Thor" aparece em ~5% dos heróis (search_hit),
// "Zorblatt" aparece em exatamente um (search_rare), e "Nonexistentus"
// nunca aparece (search_miss).
function buildSeedHeroName(index: number): { name: string; nickname: string } {
  if (index === 1) {
    return {
      name: `Zorblatt Seed ${index}`,
      nickname: `Zorblatt Nick ${index}`,
    };
  }
  if (index % 20 === 0) {
    return { name: `Thor Seed ${index}`, nickname: `Thor Nick ${index}` };
  }
  return { name: `Herói Seed ${index}`, nickname: `Nick Seed ${index}` };
}

export async function runSeed(
  db: Database,
  total: number = TOTAL_SEED_HEROES,
): Promise<number> {
  const now = new Date();
  let inserted = 0;

  for (let batchStart = 1; batchStart <= total; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, total);
    const rows = [];

    for (let index = batchStart; index <= batchEnd; index += 1) {
      const { name, nickname } = buildSeedHeroName(index);
      rows.push({
        id: uuidv7(),
        name,
        nickname,
        universe: pickCyclic(UNIVERSES, index),
        main_power: pickCyclic(MAIN_POWERS, index),
        date_of_birth: formatDateOfBirth(index),
        avatar_url: null,
        is_active: true,
        version: 1,
        created_at: now,
        updated_at: now,
      });
    }

    const result = await db.insert(heroes).ignore().values(rows);
    inserted += result[0].affectedRows;
  }

  return inserted;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definida. Copie .env.example para .env na raiz do repositório.",
    );
  }

  const { db, pool } = createDbClient(process.env.DATABASE_URL);

  try {
    const inserted = await runSeed(db);
    console.log(`Seed concluído: ${inserted} heróis novos inseridos.`);
  } finally {
    await pool.end();
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
