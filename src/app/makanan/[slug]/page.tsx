import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell, { JsonLd, Light } from "@/components/public/PublicShell";
import {
  allergenNames, foodBySlug, foodDescription, foodSlugs, similarFoods, SITE_NAME, SITE_URL, slugify, STATUS_TEXT, titleCase, verdicts,
} from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

// 342 halaman dibuat saat build (statis, cepat, mudah dirayapi)
export const dynamicParams = false;
export function generateStaticParams() {
  return foodSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const food = foodBySlug((await params).slug);
  if (!food) return {};
  const name = titleCase(food.name);
  const title = `Bolehkah makan ${name}? Cek untuk diabetes & asam urat`;
  return {
    title,
    description: foodDescription(food),
    alternates: { canonical: `/makanan/${slugify(food.name)}` },
    openGraph: { type: "article", title: `${name}: boleh gak?`, description: foodDescription(food), url: `/makanan/${slugify(food.name)}` },
    keywords: [`${food.name} untuk diabetes`, `${food.name} asam urat`, `${food.name} darah tinggi`, `bolehkah makan ${food.name}`, ...food.aliases],
  };
}

const LEVEL_TEXT = { rendah: "Rendah", sedang: "Sedang", tinggi: "Tinggi" } as const;

export default async function FoodPage({ params }: Props) {
  const food = foodBySlug((await params).slug);
  if (!food) notFound();
  const name = titleCase(food.name);
  const url = `${SITE_URL}/makanan/${slugify(food.name)}`;
  const vs = verdicts(food);
  const alergen = allergenNames(food);
  const nutrients = [
    ["Karbohidrat", food.karbo], ["Gula tambahan", food.gula], ["Garam/natrium", food.garam],
    ["Lemak jenuh", food.lemak], ["Purin", food.purin], ["Indeks glikemik", food.ig],
  ].filter(([, v]) => v) as [string, keyof typeof LEVEL_TEXT][];

  const answer = (v: (typeof vs)[number]) =>
    `${STATUS_TEXT[v.status].long[0].toUpperCase()}${STATUS_TEXT[v.status].long.slice(1)} untuk ${v.condition.who}` +
    (v.reasons.length ? ` karena ${v.reasons.map((r) => r.text).join(", ")}` : "") +
    `. Porsi aman: ${food.porsi_aman}.`;

  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Daftar makanan", item: `${SITE_URL}/makanan` },
              { "@type": "ListItem", position: 3, name, item: url },
            ],
          },
          {
            "@type": "FAQPage",
            inLanguage: "id-ID",
            mainEntity: vs.map((v) => ({
              "@type": "Question",
              name: `Bolehkah ${v.condition.who} makan ${food.name}?`,
              acceptedAnswer: { "@type": "Answer", text: answer(v) },
            })),
          },
        ],
      }} />

      <nav className="crumbs" aria-label="Lokasi"><Link href="/">Beranda</Link> › <Link href="/makanan">Makanan</Link> › <span>{name}</span></nav>
      <article className="card pub-food">
        <p className="eyebrow">{food.kategori}</p>
        <h1>Bolehkah makan {name}?</h1>
        {food.aliases.length > 0 && <p className="small muted">Juga disebut: {food.aliases.join(", ")}</p>}
        <p className="lead-sm">Porsi aman: <b>{food.porsi_aman}</b></p>

        <h2>Penilaian per kondisi</h2>
        <ul className="pub-verdicts">
          {vs.map((v) => (
            <li key={v.condition.id} className={v.status}>
              <Light status={v.status} />
              <div>
                <Link href={`/kondisi/${v.condition.slug}`}><b>{v.condition.emoji} {v.condition.name}</b></Link>
                <span className={`pub-status ${v.status}`}>{STATUS_TEXT[v.status].label}</span>
                {v.reasons.length > 0 && <p className="small">{v.reasons.map((r) => r.text).join(" · ")}</p>}
              </div>
            </li>
          ))}
        </ul>

        {nutrients.length > 0 && (
          <>
            <h2>Kandungan per porsi</h2>
            <dl className="pub-nutri">
              {nutrients.map(([label, v]) => <div key={label}><dt>{label}</dt><dd className={v}>{LEVEL_TEXT[v]}</dd></div>)}
            </dl>
          </>
        )}

        {food.trik.length > 0 && (
          <>
            <h2>Biar lebih aman</h2>
            <ul className="pub-tips">{food.trik.map((t) => <li key={t}>{t}</li>)}</ul>
          </>
        )}
        {food.pemicu.length > 0 && <p className="small"><b>Yang perlu diwaspadai:</b> {food.pemicu.join(", ")}.</p>}
        {alergen.length > 0 && <p className="small"><b>Bisa mengandung alergen:</b> {alergen.join(", ")}.</p>}
      </article>

      <section className="card pub-cta">
        <h2>Punya kondisi lebih dari satu?</h2>
        <p>Aplikasi {SITE_NAME} menggabungkan semua kondisi, obat, dan alergi sekaligus, lalu memberi satu jawaban: boleh, dibatasi, atau jangan. Bisa tanya pakai suara atau foto.</p>
        <Link href="/mulai" className="btn big primary">Cek {name} untuk kondisiku →</Link>
      </section>

      {similarFoods(food).length > 0 && (
        <section className="card">
          <h2>Makanan serupa</h2>
          <ul className="pub-links">
            {similarFoods(food).map((f) => <li key={f.name}><Link href={`/makanan/${slugify(f.name)}`}>{titleCase(f.name)}</Link></li>)}
          </ul>
        </section>
      )}
      <p className="disclaimer">Penilaian umum per porsi khas Indonesia, bukan pengganti saran dokter. Ikuti anjuran dokter atau ahli gizimu.</p>
    </PublicShell>
  );
}
