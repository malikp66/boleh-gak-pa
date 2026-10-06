import { describe, expect, it } from "vitest";
import { bloodPressure, glucose } from "./monitor";

describe("glucose", () => {
  it.each([
    [50, "acak", "bahaya"], // < 54 hipoglikemia berat
    [65, "puasa", "bahaya"], // < 70
    [100, "puasa", "aman"],
    [140, "puasa", "perhatian"], // > 130 sebelum makan
    [170, "2 jam setelah makan", "aman"],
    [190, "2 jam setelah makan", "perhatian"],
    [260, "acak", "bahaya"], // > 250
  ])("%i mg/dL (%s) → %s", (v, ctx, level) => {
    expect(glucose(v, ctx).level).toBe(level);
  });
});

describe("glucose (gestational targets)", () => {
  it.each([
    [90, "puasa", "aman"],
    [100, "puasa", "perhatian"], // umum masih aman, saat hamil sudah di atas target
    [125, "2 jam setelah makan", "perhatian"],
    [60, "puasa", "bahaya"],
  ])("%i mg/dL (%s) → %s", (v, ctx, level) => {
    expect(glucose(v, ctx, "gestasional").level).toBe(level);
  });
});

describe("bloodPressure", () => {
  it.each([
    [118, 76, "aman"],
    [132, 82, "perhatian"],
    [145, 92, "perhatian"],
    [182, 100, "bahaya"],
    [150, 121, "bahaya"],
    [85, 55, "perhatian"],
  ])("%i/%i → %s", (s, d, level) => {
    expect(bloodPressure(s, d).level).toBe(level);
  });
});

describe("doctor targets override general targets", () => {
  it("glucose", () => {
    expect(glucose(120, "puasa").level).toBe("aman");
    expect(glucose(120, "puasa", null, { gulaPuasa: 110 }).level).toBe("perhatian");
    expect(glucose(60, "puasa", null, { gulaPuasa: 110 }).level).toBe("bahaya"); // bahaya tetap bahaya
  });
  it("blood pressure", () => {
    expect(bloodPressure(135, 85, { sistolik: 140, diastolik: 90 }).level).toBe("aman");
    expect(bloodPressure(135, 85, { sistolik: 130, diastolik: 80 }).level).toBe("perhatian");
    expect(bloodPressure(185, 95, { sistolik: 140, diastolik: 90 }).level).toBe("bahaya");
  });
  it("very low blood pressure is dangerous", () => {
    expect(bloodPressure(75, 50).level).toBe("bahaya");
    expect(bloodPressure(88, 58, {}, true).level).toBe("perhatian");
  });
});
