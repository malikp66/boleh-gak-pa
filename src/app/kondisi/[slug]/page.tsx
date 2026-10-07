import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell, { JsonLd } from "@/components/public/PublicShell";
import type { Status } from "@/lib/foods/types";
import { conditionBySlug, FOODS, SEO_CONDITIONS, SITE_NAME, SITE_URL, slugify, STATUS_TEXT, titleCase, verdict } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return SEO_CONDITIONS.map((c) => ({ slug: c.slug }));
}

function groups(id: (typeof SEO_CONDITIONS)[number]["id"]) {
  const out: Record<Status, typeof FOODS> = { hijau: [], kuning: [], merah: [] };
  for (const f of FOODS) out[verdict(f, id).status].push(f);
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = conditionBySlug((await params).slug);
  if (!c) return {};
  const g = groups(c.id);
  return {
    title: `Makanan untuk ${c.who}: yang aman, dibatasi & dihindari`,
    description: `${g.hijau.length} makanan aman, ${g.kuning.length} perlu dibatasi, dan ${g.merah.length} sebaiknya dihindari ${c.who}. Fokus: ${c.focus}. Contoh aman: ${g.hijau.slice(0, 4).map((f) => f.name).join(", ")}.`.slice(0, 160),
    alternates: { canonical: `/kondisi/${c.slug}` },
  };
}

const SECTION: Record<Status, string> = {
  hijau: "Aman dimakan",
  kuning: "Boleh, tapi dibatasi porsinya",
  merah: "Sebaiknya dihindari",
};

export default async function ConditionPage({ params }: Props) {
  const c = conditionBySlug((await params).slug);
  if (!c) notFound();
  const g = groups(c.id);
  const url = `${SITE_URL}/kondisi/${c.slug}`;
  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: `Makanan untuk ${c.name.toLowerCase()}`, item: url },
        ],
      }} />
      <nav className="crumbs" aria-label="Lokasi"><Link href="/">Beranda</Link> › <span>{c.name}</span></nav>
      <section className="card">
        <p className="eyebrow">{c.emoji} Panduan makan</p>
        <h1>Makanan untuk {c.who}</h1>
        <p>Yang paling diperhatikan: <b>{c.focus}</b>. Daftar di bawah dinilai dari {FOODS.length} makanan yang biasa dimakan di Indonesia, per porsi khas.</p>
        <div className="pub-counts">
          {(["hijau", "kuning", "merah"] as Status[]).map((s) => <a key={s} href={`#${s}`} className={`pub-count ${s}`}><b>{g[s].length}</b>{STATUS_TEXT[s].label}</a>)}
        </div>
      </section>
      {(["hijau", "kuning", "merah"] as Status[]).map((s) => (
        <section key={s} id={s} className={`card pub-group ${s}`}>
          <h2>{STATUS_TEXT[s].dot} {SECTION[s]} <small>({g[s].length})</small></h2>
          <ul className="pub-links">
            {g[s].map((f) => <li key={f.name}><Link href={`/makanan/${slugify(f.name)}`}>{titleCase(f.name)}</Link></li>)}
          </ul>
        </section>
      ))}
      <section className="card pub-cta">
        <h2>Punya kondisi lain juga?</h2>
        <p>Aplikasi {SITE_NAME} menggabungkan beberapa kondisi sekaligus, ditambah obat dan alergi, lalu memberi satu jawaban sebelum makan.</p>
        <Link href="/mulai" className="btn big primary">Mulai gratis →</Link>
      </section>
      <p className="disclaimer">Penilaian umum, bukan pengganti saran dokter. Ikuti anjuran dokter atau ahli gizimu.</p>
    </PublicShell>
  );
}
