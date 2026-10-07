import Link from "next/link";
import PublicShell, { JsonLd, Light } from "./PublicShell";
import ReturningRedirect from "./ReturningRedirect";
import { foodBySlug, FOODS, SEO_CONDITIONS, SITE_DESC, SITE_NAME, SITE_URL, slugify, STATUS_TEXT, titleCase, verdict } from "@/lib/seo";

const POPULAR = ["soto ayam", "nasi padang", "martabak manis", "bakso", "gado-gado", "nasi goreng", "sate kambing", "indomie goreng", "es teh manis", "emping", "durian", "kopi susu"];

const FAQ = [
  ["Apakah aplikasi ini gratis?", `Ya, ${SITE_NAME} gratis dan tidak perlu daftar akun atau email. Data tersimpan aman dan bisa dipulihkan dengan kode pemulihan atau WhatsApp.`],
  ["Dari mana penilaian boleh atau tidaknya?", "Lampu ditentukan tabel aturan berdasarkan Tabel Komposisi Pangan Indonesia (Kemenkes), USDA FoodData Central, dan pedoman PERKENI, ACR, AHA, serta WHO. AI hanya membantu menulis saran dan menguraikan resep makanan baru."],
  ["Bisa untuk beberapa penyakit sekaligus?", "Bisa. Pilih semua kondisi yang dimiliki, misalnya diabetes dan darah tinggi, ditambah obat dan alergi. Penilaian memakai yang paling ketat."],
  ["Apakah bisa dipakai orang tua?", "Bisa. Tanya cukup pakai suara atau foto, jawabannya dibacakan, dan keluarga bisa mengingatkan lewat notifikasi atau WhatsApp."],
  ["Apakah ini pengganti dokter?", "Bukan. Aplikasi membantu memilih makanan sehari-hari. Ikuti anjuran dokter atau ahli gizimu, terutama untuk diet khusus."],
] as const;

export default function Landing() {
  const examples = POPULAR.map((n) => foodBySlug(slugify(n))).filter(Boolean).slice(0, 8);
  return (
    <PublicShell>
      <ReturningRedirect />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebApplication",
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESC,
            inLanguage: "id-ID",
            applicationCategory: "HealthApplication",
            operatingSystem: "Android, iOS, Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
          },
          {
            "@type": "FAQPage",
            mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          },
        ],
      }} />

      <section className="pub-hero">
        <p className="eyebrow">Teman makan untuk yang sedang menjaga kesehatan</p>
        <h1>Boleh gak makan ini? <span>Cek dulu sebelum makan.</span></h1>
        <p className="lead-sm">Ketik, foto, atau ucapkan makanannya. Langsung tahu <b>boleh</b>, <b>dibatasi</b>, atau <b>sebaiknya jangan</b>, sesuai diabetes, darah tinggi, asam urat, kolesterol, stroke, darah rendah, dan alergi.</p>
        <div className="row pub-hero-cta">
          <Link href="/mulai" className="btn big primary">Mulai gratis →</Link>
          <Link href="/makanan" className="btn big">Lihat {FOODS.length} makanan</Link>
        </div>
        <p className="small muted">Tanpa daftar · tanpa iklan · bisa dipasang di layar HP</p>
      </section>

      <section className="pub-features">
        {[
          ["🚦", "Lampu dari tabel gizi", "Penilaian dari tabel komposisi pangan dan pedoman resmi, bukan tebakan."],
          ["🎤", "Tanya pakai suara atau foto", "Cocok untuk orang tua: ucapkan saja, jawabannya dibacakan."],
          ["🧩", "Semua kondisi sekaligus", "Diabetes plus darah tinggi plus obat? Satu jawaban, yang paling aman."],
          ["👪", "Keluarga ikut menjaga", "Lihat siapa yang belum mencatat dan ingatkan lewat notifikasi atau WhatsApp."],
        ].map(([e, t, d]) => (
          <div key={t} className="card pub-feature"><span aria-hidden="true">{e}</span><h2>{t}</h2><p className="small">{d}</p></div>
        ))}
      </section>

      <section className="card">
        <h2>Contoh penilaian</h2>
        <div className="pub-table" role="table" aria-label="Contoh penilaian makanan">
          <div role="row" className="pub-tr head">
            <span role="columnheader">Makanan</span>
            {SEO_CONDITIONS.slice(0, 4).map((c) => <span role="columnheader" key={c.id}>{c.emoji}<small>{c.name}</small></span>)}
          </div>
          {examples.map((f) => (
            <div role="row" className="pub-tr" key={f!.name}>
              <Link role="cell" href={`/makanan/${slugify(f!.name)}`}>{titleCase(f!.name)}</Link>
              {SEO_CONDITIONS.slice(0, 4).map((c) => {
                const s = verdict(f!, c.id).status;
                return <span role="cell" key={c.id} title={STATUS_TEXT[s].label}><Light status={s} /><small>{STATUS_TEXT[s].label}</small></span>;
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Panduan makan per kondisi</h2>
        <ul className="pub-conds">
          {SEO_CONDITIONS.map((c) => (
            <li key={c.slug}><Link href={`/kondisi/${c.slug}`}><span aria-hidden="true">{c.emoji}</span><b>{c.name}</b><small>{c.focus}</small></Link></li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Cara kerjanya</h2>
        <ol className="install-steps">
          <li><span>1</span><div><b>Pilih kondisi</b> yang dijaga, untuk diri sendiri atau keluarga.</div></li>
          <li><span>2</span><div><b>Tanya sebelum makan</b>: ketik, foto, atau ucapkan makanannya.</div></li>
          <li><span>3</span><div><b>Dapat lampu & porsi aman</b>, plus cara menolak dengan sopan kalau ditawari.</div></li>
        </ol>
      </section>

      <section className="card">
        <h2>Pertanyaan umum</h2>
        {FAQ.map(([q, a]) => <details key={q} className="pub-faq"><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <section className="card pub-cta">
        <h2>Siap mencoba?</h2>
        <p>Gratis, tanpa daftar. Pasang di layar HP supaya mudah dibuka kapan saja.</p>
        <Link href="/mulai" className="btn big primary">Mulai sekarang →</Link>
      </section>
    </PublicShell>
  );
}
