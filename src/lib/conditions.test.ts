import { describe, expect, it } from "vitest";
import { ConditionId, evaluate, normalizeConditions } from "./conditions";
import { findFoods } from "./foods/match";

const ev = (text: string, conditions: ConditionId[], extra: { alergen?: string[]; flare?: boolean; diabetesTipe?: string; obat?: string[] } = {}) =>
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
    expect(ev("tumis kangkung", ["alergi"], { alergen: ["krustasea"] }).reasons[0].text).toContain("udang"); // terasi
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

  it("diabetes uses glycemic index and portion", () => {
    expect(ev("nasi putih", ["diabetes"]).reasons[0].text).toContain("cepat menaikkan gula");
    expect(ev("kentang", ["diabetes"]).status).toBe("kuning"); // karbo sedang, IG tinggi
    expect(ev("nasi merah", ["diabetes"]).reasons[0].text).toBe("karbohidrat tinggi — jaga porsi"); // IG sedang
    expect(ev("oatmeal", ["diabetes"]).status).toBe("hijau");
    expect(ev("susu kental manis", ["diabetes"]).status).toBe("merah");
    expect(ev("mie shirataki", ["diabetes"]).status).toBe("hijau");
  });

  it("is stricter on added sugar for gestational diabetes", () => {
    expect(ev("kopi susu", ["diabetes"]).status).toBe("merah"); // gula tinggi untuk semua
    expect(ev("bakpia", ["diabetes"]).status).toBe("kuning");
    expect(ev("bakpia", ["diabetes"], { diabetesTipe: "gestasional" }).status).toBe("merah");
  });

  it("cholesterol: trans fat, dietary cholesterol, double saturated fat", () => {
    expect(ev("biskuit krim", ["kolesterol"]).reasons[0].text).toContain("lemak trans");
    expect(ev("udang", ["kolesterol"]).reasons[0].text).toBe("kolesterol makanan tinggi");
    expect(ev("gulai otak", ["kolesterol"]).status).toBe("merah");
    expect(ev("gorengan + martabak telur", ["kolesterol"]).status).toBe("merah");
    expect(ev("tahu goreng + tempe goreng", ["kolesterol"]).status).toBe("hijau");
  });

  it("allergy: sesame and cross-contact", () => {
    expect(ev("onde-onde", ["alergi"], { alergen: ["wijen"] }).status).toBe("merah");
    const cross = ev("keripik", ["alergi"], { alergen: ["krustasea"] }); // gorengan: minyak bisa dipakai bersama udang
    expect(cross.status).toBe("kuning");
    expect(cross.reasons[0].text).toContain("tanya penjual");
    expect(ev("apel", ["alergi"], { alergen: ["krustasea"] }).status).toBe("hijau");
  });

  it("post-stroke/heart is strict on salt and saturated fat", () => {
    expect(ev("ikan asin", ["stroke_jantung"]).status).toBe("merah");
    expect(ev("rendang", ["stroke_jantung"]).status).toBe("merah");
    expect(ev("soto ayam", ["stroke_jantung"]).status).toBe("merah"); // garam tinggi
    expect(ev("pepes ikan", ["stroke_jantung"]).status).toBe("kuning"); // garam sedang
    expect(ev("oatmeal", ["stroke_jantung"]).status).toBe("hijau");
    expect(ev("bir", ["stroke_jantung"]).status).toBe("merah");
  });

  it("low blood pressure: salt is not penalized, big carb meals and alcohol are", () => {
    expect(ev("ikan asin", ["darah_rendah"]).status).toBe("hijau");
    expect(ev("nasi padang", ["darah_rendah"]).status).toBe("kuning");
    expect(ev("bir", ["darah_rendah"]).status).toBe("kuning");
  });

  it("warns about food-drug interactions", () => {
    expect(ev("jeruk bali", ["kolesterol"], { obat: ["statin"] })).toMatchObject({ status: "merah", reasons: [{ condition: "obat" }] });
    expect(ev("jeruk bali", ["kolesterol"]).status).toBe("hijau");
    expect(ev("bayam", ["stroke_jantung"], { obat: ["warfarin"] }).reasons[0].text).toContain("konsisten");
    expect(ev("bir", ["diabetes"], { obat: ["metformin"] }).reasons.some((r) => r.condition === "obat")).toBe(true);
    expect(ev("apel", ["diabetes"], { obat: ["warfarin", "statin"] }).status).toBe("hijau");
  });

  it("reads v1 condition labels", () => {
    expect(normalizeConditions(["asam urat (gout)", "darah tinggi (hipertensi)", "diabetes", "x"])).toEqual(["asam_urat", "hipertensi", "diabetes"]);
  });
});
