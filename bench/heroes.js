import http from "k6/http";
import { check, sleep } from "k6";

// Roda contra o Nginx (não direto na API), como o README pede: um comando
// só, passando pela mesma borda que a tela usa. Exige o compose de pé com
// os 100k heróis semeados (SEED_ON_START=true docker compose up --build).
const BASE_URL = __ENV.BASE_URL || "http://nginx";

// Precisa casar com os grupos gerados por apps/api/src/db/seed.ts:
// "thor" é comum (~5% dos heróis), "zorblatt" existe em exatamente um,
// "nonexistentus" não existe em nenhum.
const SEARCH_HIT_TERM = "thor";
const SEARCH_RARE_TERM = "zorblatt";
const SEARCH_MISS_TERM = "nonexistentus";

// Heróis suficientes adiante para sair da primeira página de índice e
// medir um cursor "fundo" de verdade (LIST_PAGE_SIZE = 10 por página).
const DEEP_CURSOR_PAGES = 500;

// Poucos usuários concorrentes, com um pequeno intervalo entre pedidos
// (sleep(1)) em vez de um laço sem pausa: o objetivo é medir a latência
// (p95 < 300ms) sob uma carga constante e realista, não descobrir quantas
// requisições por segundo o Nginx ou o MySQL aguentam no limite — isso
// seria outro tipo de teste, que o README não pede.
const CONCURRENT_USERS = 5;

export const options = {
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: {
    first_page: {
      executor: "constant-vus",
      vus: CONCURRENT_USERS,
      duration: "20s",
      exec: "firstPage",
    },
    search_hit: {
      executor: "constant-vus",
      vus: CONCURRENT_USERS,
      duration: "20s",
      startTime: "20s",
      exec: "searchHit",
    },
    search_rare: {
      executor: "constant-vus",
      vus: CONCURRENT_USERS,
      duration: "20s",
      startTime: "40s",
      exec: "searchRare",
    },
    search_miss: {
      executor: "constant-vus",
      vus: CONCURRENT_USERS,
      duration: "20s",
      startTime: "60s",
      exec: "searchMiss",
    },
    deep_cursor: {
      executor: "constant-vus",
      vus: 2,
      duration: "30s",
      startTime: "80s",
      exec: "deepCursor",
    },
  },
  thresholds: {
    "http_req_duration{scenario:first_page}": ["p(95)<300"],
    "http_req_duration{scenario:search_hit}": ["p(95)<300"],
    "http_req_duration{scenario:search_rare}": ["p(95)<300"],
    "http_req_duration{scenario:search_miss}": ["p(95)<300"],
    // Só a última página do passeio de cursor é cronometrada aqui (ver
    // deepCursor): as páginas intermediárias só existem para chegar lá.
    "http_req_duration{step:deep_cursor_page}": ["p(95)<300"],
  },
};

export function firstPage() {
  const response = http.get(`${BASE_URL}/api/heroes`);
  check(response, { "200 OK": (r) => r.status === 200 });
  sleep(1);
}

export function searchHit() {
  const response = http.get(`${BASE_URL}/api/heroes?q=${SEARCH_HIT_TERM}`);
  check(response, { "200 OK": (r) => r.status === 200 });
  sleep(1);
}

export function searchRare() {
  const response = http.get(`${BASE_URL}/api/heroes?q=${SEARCH_RARE_TERM}`);
  check(response, { "200 OK": (r) => r.status === 200 });
  sleep(1);
}

export function searchMiss() {
  const response = http.get(`${BASE_URL}/api/heroes?q=${SEARCH_MISS_TERM}`);
  check(response, { "200 OK": (r) => r.status === 200 });
  sleep(1);
}

export function deepCursor() {
  let response = http.get(`${BASE_URL}/api/heroes`);
  check(response, { "200 OK (primeira página)": (r) => r.status === 200 });
  let cursor = response.json("next_cursor");

  for (let page = 1; page < DEEP_CURSOR_PAGES && cursor; page += 1) {
    const url = `${BASE_URL}/api/heroes?cursor=${encodeURIComponent(cursor)}`;
    const isLastHop = page === DEEP_CURSOR_PAGES - 1;

    response = isLastHop
      ? http.get(url, { tags: { step: "deep_cursor_page" } })
      : http.get(url);

    check(response, { "200 OK (página profunda)": (r) => r.status === 200 });
    cursor = response.json("next_cursor");
  }
}
