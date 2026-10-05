// Uji adapter AI dengan model sungguhan. Tidak ikut `npm test` biasa:
//   RUN_AI=1 AI_PROVIDER=ollama npx vitest run test/ai.integration.test.ts
//   RUN_AI=1 GOOGLE_AI_API_KEY=... npx vitest run test/ai.integration.test.ts
import { describe, expect, it } from "vitest";
import { assess, Profile } from "@/lib/domain";
import { FOODS } from "@/lib/foods/match";

const papa: Profile = {
  id: "p", family_id: "f", nama: "Papa", panggilan: "Pa", usia: 58,
  kondisi: ["asam urat (gout)", "darah tinggi (hipertensi)"], catatan_dokter: "",
};
const memCache = () => {
  const m = new Map();
  return { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: unknown) => void m.set(k, v), size: () => m.size };
};

describe.runIf(process.env.RUN_AI)("AI adapter (real model)", () => {
  it("writes a valid answer for a combination and caches it", async () => {
    const cache = memCache();
    const ctx = { profile: papa, flare: null, saltyMealsToday: 0, note: "Ditraktir teman" };
    const r = await assess("indomi ketoprak", FOODS, ctx, cache, async () => true);
    console.log(JSON.stringify({ source: r.source, model: r.model, status: r.status, headline: r.headline, refusals: r.refusals }, null, 1));
    expect(r.source).toBe("ai");
    expect(r.status).toBe("merah");
    expect(r.refusals.length).toBeGreaterThan(0);
    expect(cache.size()).toBe(1);

    const again = await assess("indomi ketoprak", FOODS, ctx, cache, async () => { throw new Error("AI should not be called"); });
    expect(again.source).toBe("cache");
  }, 300_000);
});
