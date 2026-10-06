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
