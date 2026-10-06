import { describe, expect, it } from "vitest";
import { findFoods } from "./foods/match";
import { cleanSpoken } from "./speech";

const heard = (t: string) => findFoods(cleanSpoken(t)).map((f) => f.name);

describe("spoken questions", () => {
  it.each([
    ["Boleh gak makan sate kambing ya?", ["sate kambing"]],
    ["aku mau minum es teh manis", ["es teh manis"]],
    ["boleh nggak makan indomie sama telor", ["mi instan", "telur"]],
    ["saya ditawari martabak manis nih, aman gak?", ["martabak manis"]],
    ["Bolehkah makan nasi padang", ["nasi padang rendang"]],
  ])("%s", (t, expected) => {
    expect(heard(t)).toEqual(expected);
  });
});
