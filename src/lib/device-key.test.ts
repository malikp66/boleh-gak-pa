import { describe, expect, it } from "vitest";
import { formatKey, generateKey, hashKey, isValidKey, normalizeKey } from "./device-key";

describe("device key", () => {
  it("generates valid, unique 24-char keys", () => {
    const keys = new Set(Array.from({ length: 500 }, generateKey));
    expect(keys.size).toBe(500);
    for (const k of keys) expect(isValidKey(k)).toBe(true);
  });

  it("formats into groups of 4 and round-trips through user typing", () => {
    const k = generateKey();
    const shown = formatKey(k);
    expect(shown).toMatch(/^([0-9A-Z]{4}-){5}[0-9A-Z]{4}$/);
    expect(normalizeKey(shown.toLowerCase().replace(/-/g, " "))).toBe(k);
  });

  it("forgives look-alike letters", () => {
    expect(normalizeKey("o1il-u")).toBe("0111V");
  });

  it("hashes deterministically without exposing the key", () => {
    const k = generateKey();
    expect(hashKey(k)).toBe(hashKey(k));
    expect(hashKey(k)).not.toContain(k);
  });
});
