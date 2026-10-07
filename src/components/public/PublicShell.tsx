import Link from "next/link";
import { SEO_CONDITIONS, SITE_NAME } from "@/lib/seo";

/** Kerangka halaman publik (bisa dibaca mesin pencari): kepala, isi, kaki dengan tautan internal. */
export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="pub-top">
        <Link href="/" className="pub-brand" aria-label={`${SITE_NAME} — beranda`}>
          <span className="pub-light" aria-hidden="true"><i /><i /><i /></span>
          {SITE_NAME}
        </Link>
        <nav className="pub-nav" aria-label="Menu">
          <Link href="/makanan">Daftar makanan</Link>
          <Link href="/mulai" className="btn sm primary">Buka aplikasi</Link>
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot">
        <nav aria-label="Makanan per kondisi">
          <p className="eyebrow">Makanan per kondisi</p>
          <ul>{SEO_CONDITIONS.map((c) => <li key={c.slug}><Link href={`/kondisi/${c.slug}`}>{c.emoji} {c.name}</Link></li>)}</ul>
        </nav>
        <p className="small">
          {SITE_NAME} membantu memilih makanan, <b>bukan pengganti dokter atau ahli gizi</b>. Penilaian memakai Tabel Komposisi Pangan Indonesia,
          USDA FoodData Central, dan pedoman Kemenkes, PERKENI, ACR, AHA, dan WHO.
        </p>
        <p className="small"><Link href="/privasi">Privasi</Link> · <Link href="/makanan">Semua makanan</Link> · <Link href="/mulai">Mulai gratis</Link></p>
      </footer>
    </>
  );
}

/** Data terstruktur schema.org (JSON-LD). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function Light({ status }: { status: "hijau" | "kuning" | "merah" }) {
  return <i className={`pub-dot ${status}`} aria-hidden="true" />;
}
