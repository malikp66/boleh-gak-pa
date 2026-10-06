import { describe, expect, it } from "vitest";
import { compute, INGREDIENTS, levels } from "./composition";

describe("tabel bahan dasar", () => {
  it("setiap bahan punya sumber yang bisa ditelusuri dan angka yang masuk akal", () => {
    expect(INGREDIENTS.length).toBeGreaterThan(120);
    for (const i of INGREDIENTS) {
      expect(i.sumber, i.id).toMatch(/USDA|Open Food Facts|TKPI/);
      expect(i.ref, i.id).not.toBe("");
      expect(i.karbo + i.lemak_jenuh, i.id).toBeLessThanOrEqual(100.5);
      expect(i.gula, i.id).toBeLessThanOrEqual(i.karbo + 0.5); // gula bagian dari karbohidrat
    }
  });
});

describe("hitung dari bahan", () => {
  it("nasi putih 150 g = karbo tinggi, IG tinggi, garam rendah", () => {
    const b = compute([{ bahan: "nasi_putih", gram: 150 }]);
    expect(b.nutrisi.karbo_g).toBeCloseTo(42.3, 0);
    expect(levels(b.nutrisi)).toMatchObject({ karbo: "tinggi", ig: "tinggi", garam: "rendah", gula: "rendah" });
  });

  it("croffle cokelat: gula & lemak jenuh tinggi dari croissant, cokelat, gula", () => {
    const b = compute([{ bahan: "croissant", gram: 70 }, { bahan: "cokelat_susu", gram: 20 }, { bahan: "gula", gram: 5 }]);
    const lv = levels(b.nutrisi);
    expect(lv.gula).toBe("tinggi");
    expect(lv.lemak).toBe("tinggi");
    expect(b.purin).toBe("rendah");
    expect(b.alergen).toEqual(expect.arrayContaining(["gluten", "susu"]));
  });

  it("purin dari kelompok bahan: jeroan 50 g = tinggi, ayam 100 g = sedang, sayur = rendah", () => {
    expect(compute([{ bahan: "hati_ayam", gram: 50 }]).purin).toBe("tinggi");
    expect(compute([{ bahan: "ayam_dada", gram: 100 }]).purin).toBe("sedang");
    expect(compute([{ bahan: "kangkung", gram: 100 }]).purin).toBe("rendah");
  });

  it("garam & kecap menentukan natrium", () => {
    const b = compute([{ bahan: "nasi_putih", gram: 150 }, { bahan: "kecap_asin", gram: 15 }, { bahan: "garam", gram: 1 }]);
    expect(levels(b.nutrisi).garam).toBe("tinggi"); // ±1.211 mg
  });

  it("bahan yang tidak ada di tabel dilaporkan & menurunkan cakupan", () => {
    const b = compute([{ bahan: "nasi_putih", gram: 100 }, { bahan: "lainnya", nama: "bunga kecombrang", gram: 100 }]);
    expect(b.tidak_dikenal).toEqual(["bunga kecombrang"]);
    expect(b.nutrisi.cakupan).toBe(0.5);
  });

  it("IG diabaikan kalau karbohidratnya sedikit", () => {
    expect(levels(compute([{ bahan: "semangka", gram: 100 }]).nutrisi).ig).toBeNull();
  });
});
