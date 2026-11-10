import { HttpResponse, http } from "msw";
import { buildHeroFixture, buildMissionFixture } from "./fixtures.js";

function errorEnvelope(
  code: string,
  message: string,
  fields: Record<string, string> | null = null,
  details?: unknown,
) {
  return { error: { code, message, fields, details } };
}

export const handlers = [
  http.get("/api/heroes", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");

    if (q === "__nenhum__") {
      return HttpResponse.json({
        data: [],
        next_cursor: null,
        prev_cursor: null,
      });
    }

    return HttpResponse.json({
      data: [buildHeroFixture()],
      next_cursor: null,
      prev_cursor: null,
    });
  }),

  http.post("/api/heroes", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      buildHeroFixture({
        name: body.name as string,
        nickname: body.nickname as string,
        universe: body.universe as string,
        main_power: body.main_power as string,
        date_of_birth: body.date_of_birth as string,
      }),
      { status: 201 },
    );
  }),

  http.get("/api/heroes/:id", ({ params }) => {
    return HttpResponse.json(buildHeroFixture({ id: params.id as string }));
  }),

  http.patch("/api/heroes/:id", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      buildHeroFixture({
        id: params.id as string,
        ...body,
        version: (body.version as number) + 1,
      }),
    );
  }),

  http.delete("/api/heroes/:id", async ({ request, params }) => {
    const body = (await request.json()) as { version: number };
    return HttpResponse.json(
      buildHeroFixture({
        id: params.id as string,
        deleted_at: "2024-05-02T10:00:00.000Z",
        version: body.version + 1,
      }),
    );
  }),

  http.post("/api/heroes/:id/activate", async ({ request, params }) => {
    const body = (await request.json()) as { version: number };
    return HttpResponse.json(
      buildHeroFixture({
        id: params.id as string,
        is_active: true,
        version: body.version + 1,
      }),
    );
  }),

  http.post("/api/heroes/:id/deactivate", async ({ request, params }) => {
    const body = (await request.json()) as { version: number };
    return HttpResponse.json(
      buildHeroFixture({
        id: params.id as string,
        is_active: false,
        version: body.version + 1,
      }),
    );
  }),

  http.get("/api/heroes/:id/history", () => {
    return HttpResponse.json({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });
  }),

  http.get("/api/heroes/:id/missions", () => {
    return HttpResponse.json({
      data: [],
      next_cursor: null,
      prev_cursor: null,
    });
  }),

  http.get("/api/missions", () => {
    return HttpResponse.json({
      data: [buildMissionFixture()],
      next_cursor: null,
      prev_cursor: null,
    });
  }),

  http.post("/api/missions", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      buildMissionFixture({
        title: body.title as string,
        starts_at: body.starts_at as string,
        ends_at: body.ends_at as string,
      }),
      { status: 201 },
    );
  }),

  http.get("/api/missions/:id", ({ params }) => {
    return HttpResponse.json(buildMissionFixture({ id: params.id as string }));
  }),

  http.post("/api/missions/:id/start", ({ params }) => {
    return HttpResponse.json(
      buildMissionFixture({ id: params.id as string, status: "in_progress" }),
    );
  }),

  http.post("/api/missions/:id/finish", async ({ request, params }) => {
    const body = (await request.json()) as { outcome: "succeeded" | "failed" };
    return HttpResponse.json(
      buildMissionFixture({ id: params.id as string, status: body.outcome }),
    );
  }),

  http.post("/api/missions/:id/cancel", ({ params }) => {
    return HttpResponse.json(
      buildMissionFixture({ id: params.id as string, status: "cancelled" }),
    );
  }),

  http.post("/api/missions/:id/heroes", async ({ request, params }) => {
    const body = (await request.json()) as { hero_id: string };
    return HttpResponse.json(
      buildMissionFixture({
        id: params.id as string,
        heroes: [buildHeroFixture({ id: body.hero_id })],
      }),
      { status: 201 },
    );
  }),

  http.delete("/api/missions/:id/heroes/:heroId", ({ params }) => {
    return HttpResponse.json(buildMissionFixture({ id: params.id as string }));
  }),
];

export { errorEnvelope };
