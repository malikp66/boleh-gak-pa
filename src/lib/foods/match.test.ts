import { describe, expect, it } from "vitest";
import { combine, findFoods, ruleStatus } from "./match";
import { ratio } from "./similarity";

const names = (t: string) => findFoods(t).map((f) => f.name);
const status = (t: string, flare = false) => ruleStatus(combine(findFoods(t)), flare);

// Kasus-kasus ini ditemukan saat uji coba v1 (5 Okt 2026).
describe("findFoods", () => {
  it.each([
    ["indomi ketoprak", ["mi instan", "ketoprak"]],
    ["nasi telor", ["nasi putih", "telur"]],
    ["bubur ayam", ["bubur ayam"]],
    ["ayam", ["ayam goreng"]],
    ["soto betawi sama es teh manis", ["soto betawi", "es teh manis"]],
    ["ketoprak tahu", ["ketoprak"]],
    ["nasi goreng seafood", ["nasi goreng", "seafood"]],
    ["sotto ayam", ["soto ayam"]],
    ["sayur asem pake melinjo", ["sayur asem", "daun melinjo"]],
    ["pizaa", ["pizza"]],
    ["burger + kentang goreng + cola", ["burger", "kentang goreng", "minuman soda"]],
    ["permen jelly Chupa Chups Bites", ["permen"]],
    ["sourdough", ["sourdough"]],
    ["bubur kacang ijo", ["bubur kacang hijau"]],
    ["manga", ["mangga"]],
    ["sate ayam sama kerupuk", ["sate ayam", "kerupuk"]],
    ["nasi uduk ayam", ["nasi uduk", "ayam goreng"]],
    ["es teh", ["es teh manis"]],
    ["mie ayam", ["mi ayam"]],
    ["kfc sama nasi", ["fried chicken", "nasi putih"]],
    ["sayur bayam", ["bayam"]],
  ])("%s", (text, expected) => {
    expect(names(text)).toEqual(expected);
  });

  it("returns nothing for unknown food", () => {
    expect(names("quinoa bowl")).toEqual([]);
  });
});

describe("ruleStatus", () => {
  it.each([
    ["ketoprak", "kuning"],
    ["indomi ketoprak", "merah"], // dobel garam
    ["nasi telor", "hijau"],
    ["emping", "merah"],
    ["jeruk bali", "kuning"], // interaksi obat tensi
    ["belimbing", "kuning"], // ginjal
    ["coca cola", "kuning"], // fruktosa tinggi
    ["coke zero", "hijau"],
    ["pisang", "hijau"],
  ])("%s → %s", (text, expected) => {
    expect(status(text)).toBe(expected);
  });

  it("is stricter during a flare", () => {
    expect(status("ketoprak", true)).toBe("merah");
  });
});

describe("ratio (difflib port)", () => {
  it("matches Python difflib values", () => {
    expect(ratio("indomi", "indomie")).toBeCloseTo(12 / 13, 5);
    expect(ratio("pizaa", "pizza")).toBeCloseTo(0.8, 5);
  });
});
