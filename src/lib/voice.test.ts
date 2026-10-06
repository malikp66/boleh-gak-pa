import { describe, expect, it } from "vitest";
import { chunkText, voiceScore } from "./voice";

describe("voice", () => {
  it("prefers natural/Google Indonesian voices and ignores other languages", () => {
    const v = (name: string, lang = "id-ID", localService = true) => ({ name, lang, localService });
    expect(voiceScore(v("Google Bahasa Indonesia", "id-ID", false))).toBeGreaterThan(voiceScore(v("Damayanti")));
    expect(voiceScore(v("Damayanti (Enhanced)"))).toBeGreaterThan(voiceScore(v("Damayanti")));
    expect(voiceScore(v("Microsoft Gadis Online (Natural)"))).toBeGreaterThan(voiceScore(v("Google Bahasa Indonesia", "id-ID", false)));
    expect(voiceScore(v("Samantha", "en-US"))).toBe(-1);
    expect(voiceScore(v("Indonesian", "in_ID"))).toBeGreaterThan(0);
  });

  it("splits long text into sentence-sized chunks without losing words", () => {
    const text = "Boleh. Soto ayam aman untuk tensi, asal kuahnya jangan dihabiskan. " + "Kerupuk dan emping sebaiknya jangan, karena tinggi garam dan purin, apalagi kalau sedang kambuh, ".repeat(3) + "ya Pa!";
    const parts = chunkText(text);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((p) => p.length <= 200)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " ").trim());
    expect(parts[0]).toBe("Boleh. Soto ayam aman untuk tensi, asal kuahnya jangan dihabiskan.");
  });
});
