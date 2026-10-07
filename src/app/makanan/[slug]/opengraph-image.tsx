import { ImageResponse } from "next/og";
import { foodBySlug, foodSlugs, SITE_NAME, STATUS_TEXT, titleCase, verdicts } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Penilaian makanan per kondisi";

export function generateStaticParams() {
  return foodSlugs().map((slug) => ({ slug }));
}

const COLOR = { hijau: "#7bd88f", kuning: "#ffd23f", merah: "#ff6b6b" } as const;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const food = foodBySlug((await params).slug);
  const name = food ? titleCase(food.name) : SITE_NAME;
  const vs = food ? verdicts(food).slice(0, 4) : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 70, background: "#fff4e0", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 34, color: "#555" }}>Bolehkah makan</div>
        <div style={{ fontSize: 92, fontWeight: 900, color: "#111", letterSpacing: -2, marginTop: 4 }}>{`${name}?`}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 40 }}>
          {vs.map((v) => (
            <div key={v.condition.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", background: "#fff", border: "5px solid #111", borderRadius: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: COLOR[v.status], border: "4px solid #111" }} />
              <div style={{ fontSize: 34, color: "#111" }}>{`${v.condition.name}: ${STATUS_TEXT[v.status].label}`}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", fontSize: 32, fontWeight: 900, color: "#111" }}>{SITE_NAME}</div>
      </div>
    ),
    size,
  );
}
