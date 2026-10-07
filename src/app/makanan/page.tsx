import type { Metadata } from "next";
import Link from "next/link";
import PublicShell from "@/components/public/PublicShell";
import { CATEGORIES, FOODS, SEO_CONDITIONS, slugify, titleCase } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Daftar ${FOODS.length} makanan Indonesia: boleh gak untuk diabetes, asam urat, darah tinggi?`,
  description: `Cek ${FOODS.length} makanan sehari-hari (kaki lima, nasi & lauk, berkuah, gorengan, kue, minuman) untuk diabetes, darah tinggi, asam urat, kolesterol, stroke, dan darah rendah.`,
  alternates: { canonical: "/makanan" },
};

export default function FoodsIndex() {
  return (
    <PublicShell>
      <nav className="crumbs" aria-label="Lokasi"><Link href="/">Beranda</Link> › <span>Makanan</span></nav>
      <section className="card">
        <h1>Daftar {FOODS.length} makanan</h1>
        <p>Pilih makanan untuk melihat apakah boleh dimakan, dibatasi, atau sebaiknya dihindari untuk setiap kondisi.</p>
        <p className="eyebrow">Lihat per kondisi</p>
        <div className="chips">{SEO_CONDITIONS.map((c) => <Link key={c.slug} href={`/kondisi/${c.slug}`} className="chip">{c.emoji} {c.name}</Link>)}</div>
      </section>
      {CATEGORIES.map((cat) => (
        <section key={cat} className="card">
          <h2>{cat}</h2>
          <ul className="pub-links">
            {FOODS.filter((f) => f.kategori === cat).map((f) => <li key={f.name}><Link href={`/makanan/${slugify(f.name)}`}>{titleCase(f.name)}</Link></li>)}
          </ul>
        </section>
      ))}
    </PublicShell>
  );
}
