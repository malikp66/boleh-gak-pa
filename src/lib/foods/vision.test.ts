import { describe, expect, it } from "vitest";
import { resolveVision } from "./vision";

// Tebakan asli Gemma 4B saat uji coba v1 (5 Okt 2026).
describe("resolveVision", () => {
  it("corrects ketoprak misread as soto ayam (no broth, tofu + sprouts)", () => {
    const r = resolveVision({
      nama: "", komponen: ["telur rebus", "tahu goreng", "bihun", "tauge", "kerupuk", "sayuran hijau"],
      berkuah: false, food: "soto ayam", confidence: "yakin",
    });
    expect(r.food).toBe("ketoprak");
    expect(r.corrected).toBe(true);
  });

  it("maps a branded candy to 'permen' instead of a random pick", () => {
    const r = resolveVision({
      nama: "permen jelly Chupa Chups Bites", komponen: ["permen jelly warna-warni"],
      berkuah: false, food: "chicken steak", confidence: "yakin",
    });
    expect(r.food).toBe("permen");
    expect(r.in_table).toBe(true);
  });

  it("keeps a real soto ayam", () => {
    const r = resolveVision({
      nama: "soto ayam", komponen: ["kuah kuning", "ayam suwir", "soun", "koya"],
      berkuah: true, food: "soto ayam", confidence: "yakin",
    });
    expect(r.food).toBe("soto ayam");
    expect(r.corrected).toBe(false);
  });

  it("falls back to the model's own words for unknown items", () => {
    const r = resolveVision({ nama: "quinoa bowl", komponen: ["quinoa"], berkuah: false, food: "lainnya", confidence: "kurang yakin" });
    expect(r.food).toBe("quinoa bowl");
    expect(r.in_table).toBe(false);
  });
});
