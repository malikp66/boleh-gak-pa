import { describe, expect, it } from "vitest";
import { recoveryEstimate, triggerAnalysis } from "./review";

const flares = [
  { id: "a", started: "2026-09-20T07:00:00Z", ended: "2026-09-25T07:00:00Z", joint: "jempol kaki", pain: 7, fever: false },
  { id: "b", started: "2026-10-04T06:00:00Z", ended: null, joint: "lutut", pain: 8, fever: false },
];

describe("recoveryEstimate", () => {
  it("uses the person's own history", () => {
    const est = recoveryEstimate(flares, [
      { flare_id: "b", at: "2026-10-04T06:00:00Z", pain: 8 },
      { flare_id: "b", at: "2026-10-05T06:00:00Z", pain: 6 },
    ], "2026-10-05T12:00:00Z");
    expect(est.basis).toBe("riwayat");
    expect(est.typical_days).toBe(5);
    expect(est.day).toBe(2);
    expect(est.trend).toBe("membaik");
    expect(est.red_flags).toEqual([]);
  });

  it("raises red flags after 7 days and with fever", () => {
    const est = recoveryEstimate([{ ...flares[1], fever: true }], [], "2026-10-13T06:00:00Z");
    expect(est.basis).toBe("kisaran umum");
    expect(est.red_flags.length).toBe(3); // > 7 hari, nyeri 8, demam
  });
});

describe("triggerAnalysis", () => {
  it("counts foods eaten in the 48h before a flare, splitting combinations and skipping refusals", () => {
    const r = triggerAnalysis(flares, [
      { food: "sate kambing + es teh manis", portion: "porsi penuh", status: "merah", garam: "tinggi", at: "2026-10-03T19:00:00Z" },
      { food: "emping melinjo", portion: "ditolak", status: "hijau", garam: null, at: "2026-10-03T20:00:00Z" },
      { food: "ketoprak", portion: "sesuai saran", status: "kuning", garam: "tinggi", at: "2026-09-01T12:00:00Z" },
    ]);
    expect(r.suspects).toEqual([{ food: "sate kambing", count: 1 }, { food: "es teh manis", count: 1 }]);
  });
});
