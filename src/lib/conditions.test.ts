import { describe, expect, it } from "vitest";
import { ConditionId, evaluate, normalizeConditions } from "./conditions";
import { findFoods } from "./foods/match";

const ev = (text: string, conditions: ConditionId[], extra: { alergen?: string[]; flare?: boolean } = {}) =>
  evaluate(findFoods(text), { conditions, ...extra });

describe("evaluate per condition", () => {
  it.each<[string, ConditionId[], string]>([
    // diabetes
    ["martabak manis", ["diabetes"], "merah"],
    ["es teh manis", ["diabetes"], "merah"],
    ["nasi putih", ["diabetes"], "kuning"],
    ["nasi + mi goreng", ["diabetes"], "merah"], // dobel karbohidrat
    ["sayur bayam", ["diabetes"], "hijau"],
    ["apel", ["diabetes"], "hijau"],
    ["soda tanpa gula", ["diabetes"], "hijau"],
    // kolesterol
    ["rendang", ["kolesterol"], "merah"],
    ["gorengan", ["kolesterol"], "kuning"],
    ["ikan bakar", ["kolesterol"], "hijau"],
    // asam urat & hipertensi (perilaku v1 tetap sama)
    ["ketoprak", ["asam_urat", "hipertensi"], "kuning"],
    ["indomi ketoprak", ["asam_urat", "hipertensi"], "merah"],
    ["emping", ["asam_urat"], "merah"],
    ["jeruk bali", ["hipertensi"], "kuning"],
    ["coca cola", ["asam_urat"], "kuning"],
    // makan sehat umum
    ["kornet", ["sehat"], "kuning"],
    ["nasi putih", ["sehat"], "hijau"],
  ])("%s untuk %j → %s", (text, conditions, status) => {
    expect(ev(text, conditions).status).toBe(status);
  });

  it("flags allergens only for the person's allergies", () => {
    expect(ev("ketoprak", ["alergi"], { alergen: ["kacang tanah"] }).status).toBe("merah");
    expect(ev("ketoprak", ["alergi"], { alergen: ["udang"] }).status).toBe("hijau");
    expect(ev("tumis kangkung", ["alergi"], { alergen: ["krustasea"] }).reasons[0].text).toContain("krustasea"); // terasi
  });

  it("takes the worst light across conditions and explains why", () => {
    const r = ev("martabak manis", ["asam_urat", "diabetes"]);
    expect(r.status).toBe("merah");
    expect(r.reasons[0]).toMatchObject({ condition: "diabetes", status: "merah" });
  });

  it("is stricter for gout during a flare", () => {
    expect(ev("ketoprak", ["asam_urat"], { flare: true }).status).toBe("merah");
  });

  it("warns about kidneys regardless of condition", () => {
    expect(ev("belimbing", ["diabetes"]).status).toBe("kuning");
  });

  it("reads v1 condition labels", () => {
    expect(normalizeConditions(["asam urat (gout)", "darah tinggi (hipertensi)", "diabetes", "x"])).toEqual(["asam_urat", "hipertensi", "diabetes"]);
  });
});
