import { describe, expect, it } from "vitest";
import { ProfileInput } from "./schemas";
import { healthLogProblem, nameProblem, normalizeInvite, normalizePhone, profileProblem } from "./validation";

describe("nama", () => {
  it("menolak kosong, spasi, satu huruf, dan tanpa huruf", () => {
    expect(nameProblem("")).toMatch(/wajib/);
    expect(nameProblem("   ")).toMatch(/wajib/);
    expect(nameProblem("A")).toMatch(/minimal/);
    expect(nameProblem("...")).toMatch(/huruf/);
    expect(nameProblem("123")).toMatch(/huruf/);
    expect(nameProblem("Omah")).toBeNull();
    expect(nameProblem("Opa Siu")).toBeNull();
  });
});

describe("telepon", () => {
  it("menerima format Indonesia dan menolak sampah", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("081234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("081234567890");
    expect(normalizePhone("6281234567890")).toBe("081234567890");
    expect(normalizePhone("+++")).toBeNull();
    expect(normalizePhone("--")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("08abc")).toBeNull();
  });
});

describe("aturan profil", () => {
  const base = { nama: "Omah", kondisi: ["diabetes"] };
  it("sehat tidak boleh digabung, alergi harus ada isinya", () => {
    expect(profileProblem({ ...base, kondisi: ["sehat", "diabetes"] })).toMatch(/tidak bisa digabung/);
    expect(profileProblem({ ...base, kondisi: ["alergi"], alergen: [] })).toMatch(/alergi/i);
    expect(profileProblem({ ...base, kondisi: ["alergi"], alergen: [], kondisi_lain: "alergi nanas" })).toBeNull();
  });
  it("target tensi & gula harus masuk akal", () => {
    expect(profileProblem({ ...base, target_sistolik: 80, target_diastolik: 90 })).toMatch(/lebih besar/);
    expect(profileProblem({ ...base, target_sistolik: 130, target_diastolik: null })).toMatch(/sekaligus/);
    expect(profileProblem({ ...base, target_gula_puasa: 150, target_gula_2jam: 120 })).toMatch(/2 jam/);
  });
  it("server (zod) menolak hal yang sama walau form dilewati", () => {
    const ok = { nama: "Omah", panggilan: "Mah", usia: null, kondisi: ["diabetes"] };
    expect(ProfileInput.safeParse(ok).success).toBe(true);
    expect(ProfileInput.safeParse({ ...ok, nama: "  " }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...ok, kontak_nama: "Malik", kontak_telepon: "+++" }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...ok, kondisi: ["sehat", "hipertensi"] }).success).toBe(false);
    const p = ProfileInput.parse({ ...ok, kontak_nama: "Malik", kontak_telepon: "+62 812-3456-7890" });
    expect(p.kontak_telepon).toBe("081234567890");
  });
});

describe("catatan kesehatan", () => {
  it("menolak angka mustahil dan tensi tertukar", () => {
    expect(healthLogProblem("tensi", 700, 20)).toMatch(/tidak masuk akal/);
    expect(healthLogProblem("tensi", 80, 120)).toMatch(/tertukar/);
    expect(healthLogProblem("tensi", 130, 85)).toBeNull();
    expect(healthLogProblem("gula_darah", 5, null)).toMatch(/tidak masuk akal/);
    expect(healthLogProblem("gula_darah", 140, null)).toBeNull();
  });
  it("kode keluarga dirapikan", () => {
    expect(normalizeInvite(" 8f3a-21c9 ")).toBe("8F3A21C9");
  });
});
