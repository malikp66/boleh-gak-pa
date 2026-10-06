import Link from "next/link";

export const metadata = { title: "Kebijakan Privasi · Boleh Gak, Ya?" };

export default function Privasi() {
  return (
    <main>
      <div className="card">
        <h1 className="hero-title">Kebijakan Privasi</h1>
        <p className="small muted">Versi 5 Oktober 2026</p>
        <h3>Data apa yang disimpan</h3>
        <ul className="plain">
          <li>Tanpa akun, tanpa email: setiap perangkat punya kunci acak di cookie. Database hanya menyimpan sidik (hash) kunci itu.</li>
          <li>Profil orang yang dijaga: nama panggilan, usia, kondisi kesehatan, catatan dokter.</li>
          <li>Catatan makan, catatan kambuh asam urat, dan skala nyeri.</li>
        </ul>
        <h3>Siapa yang bisa melihat</h3>
        <p>Hanya kamu dan anggota keluarga yang bergabung dengan kode undanganmu. Server memeriksa keanggotaan keluarga di setiap permintaan data.</p>
        <h3>Foto makanan</h3>
        <p>Foto dikirim ke model AI (Google AI Studio) untuk dikenali, lalu <b>tidak disimpan</b> di mana pun oleh aplikasi ini.</p>
        <h3>AI</h3>
        <p>Nama makanan, kondisi kesehatan, dan situasi dikirim ke Google AI Studio untuk membuat saran. Identitasmu tidak ikut dikirim. Saran umum yang sama dapat dipakai ulang (cache) untuk keluarga lain tanpa data pribadi.</p>
        <h3>Hak kamu</h3>
        <p>Kamu bisa meminta data keluargamu dihapus kapan saja dengan menghubungi pengelola aplikasi. Data disimpan di database Neon (region Singapura). Kode pemulihan memberi akses penuh ke datamu, jadi jangan dibagikan.</p>
        <h3>Bukan saran medis</h3>
        <p>Aplikasi ini membantu keluarga, bukan pengganti dokter. Ikuti selalu saran dokter atau ahli gizi.</p>
        <p style={{ marginTop: 20 }}><Link href="/">← Kembali</Link></p>
      </div>
    </main>
  );
}
