import { ImageResponse } from "next/og";
import { FOODS, SITE_NAME } from "@/lib/seo";

export const alt = `${SITE_NAME} — cek makanan sebelum makan`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Gambar pratinjau saat tautan dibagikan (WhatsApp, Facebook, X). */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#fff4e0", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", gap: 18, padding: "18px 26px", background: "#111", borderRadius: 999, alignSelf: "flex-start" }}>
          {["#ff6b6b", "#ffd23f", "#7bd88f"].map((c) => <div key={c} style={{ width: 46, height: 46, borderRadius: 999, background: c }} />)}
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, color: "#111", marginTop: 36, letterSpacing: -2 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 44, color: "#111", marginTop: 12, maxWidth: 1000 }}>Cek dulu sebelum makan: boleh, dibatasi, atau jangan.</div>
        <div style={{ fontSize: 30, color: "#555", marginTop: 28 }}>{`Diabetes · darah tinggi · asam urat · kolesterol · stroke · ${FOODS.length} makanan Indonesia`}</div>
      </div>
    ),
    size,
  );
}
