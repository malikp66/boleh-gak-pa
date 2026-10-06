import { describe, expect, it } from "vitest";
import { evaluate } from "./conditions";
import { findFoods } from "./foods/match";
import { mapLocally, personalReasons, Personalisasi } from "./personalize";

describe("mapLocally", () => {
  it("maps everyday words to known conditions, meds and allergens", () => {
    const m = mapLocally("kencing manis sama darah tinggi, pernah pasang ring jantung", "simvastatin 20mg, aspilet, glimepirid", "alergi udang dan kacang");
    expect(m.kondisi.sort()).toEqual(["diabetes", "hipertensi", "stroke_jantung"].sort());
    expect(m.obat.sort()).toEqual(["antiplatelet", "statin", "sulfonilurea"].sort());
    expect(m.alergen.sort()).toEqual(["kacang tanah", "krustasea"].sort());
  });

  it("does not confuse kacang mete with peanuts", () => {
    expect(mapLocally("", "", "kacang mete").alergen).toEqual(["kacang pohon"]);
  });

  it("leaves unknown conditions for the AI", () => {
    expect(mapLocally("maag kronis, ginjal stadium 3", "", "")).toEqual({ kondisi: [], obat: [], alergen: [] });
  });
});

describe("personal notes in evaluation", () => {
  const p: Personalisasi = {
    ringkasan: "Maag kronis", fokus: "hindari pedas & asam", hindari: ["pedas", "sambal", "kopi"], batasi: ["santan", "gorengan"],
    perlu_dokter: false, sumber: "maag", dibuat: "2026-10-06",
  };
  it("matches note keywords against food names and triggers", () => {
    expect(personalReasons(findFoods("kopi")[0], p)[0]).toMatchObject({ status: "merah" });
    expect(personalReasons(findFoods("sayur lodeh")[0], p)[0]).toMatchObject({ status: "kuning" }); // santan
    expect(personalReasons(findFoods("apel")[0], p)).toEqual([]);
  });
  it("feeds the condition engine", () => {
    const r = evaluate(findFoods("keripik pedas"), { conditions: ["sehat"], personal: p });
    expect(r.reasons.some((x) => x.condition === "pribadi")).toBe(true);
  });
});
