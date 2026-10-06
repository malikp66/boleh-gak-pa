# Sumber & ambang gizi

Dokumen ini menjelaskan **dari mana setiap aturan lampu berasal**, supaya bisa diperiksa dan dikoreksi oleh ahli gizi atau dokter.
Semua nilai di tabel makanan adalah **perkiraan per porsi khas di Indonesia**, bukan hasil uji laboratorium.

> ⚠️ Belum ditinjau ahli gizi berlisensi. Kondisi berlabel **Beta** (diabetes, kolesterol, alergi) wajib ditinjau sebelum label Beta dilepas.

## Sumber utama

| Topik | Sumber |
|---|---|
| Komposisi zat gizi bahan pangan Indonesia | **Tabel Komposisi Pangan Indonesia (TKPI)**, Kemenkes RI, tersedia di [panganku.org](https://www.panganku.org) dan [repository Kemenkes](https://repository.kemkes.go.id/book/668) |
| Pola makan seimbang | **Isi Piringku / Pedoman Gizi Seimbang**, Kemenkes ([ayosehat.kemkes.go.id](https://ayosehat.kemkes.go.id/isi-piringku-pedoman-makan-kekinian-orang-indonesia)) |
| Batas gula, garam, lemak harian | **Permenkes No. 30/2013 (GGL)**: gula 50 g, natrium 2.000 mg (≈ garam 5 g), lemak 67 g per orang per hari |
| Garam | **WHO Guideline: Sodium intake for adults and children** (2012): natrium < 2 g/hari ([WHO IRIS](https://iris.who.int/handle/10665/77985)) |
| Diabetes, terapi nutrisi medis | **PERKENI, Pedoman Pengelolaan & Pencegahan DM Tipe 2 Dewasa di Indonesia 2021** ([PDF](https://pbperkeni.or.id/wp-content/uploads/2021/11/22-10-21-Website-Pedoman-Pengelolaan-dan-Pencegahan-DMT2-Ebook.pdf)); Kemenkes, [Terapi Nutrisi Medis pada DM Tipe 2](https://keslan.kemkes.go.id/view_artikel/2108/terapi-nutrisi-medis-pada-diabetes-melitus-tipe-2-series-1) |
| Indeks glikemik | **Atkinson et al., International tables of glycemic index and glycemic load values 2021**, *Am J Clin Nutr* ([PubMed 34258626](https://pubmed.ncbi.nlm.nih.gov/34258626/)). Contoh: nasi putih rata-rata IG 73, beras merah 65 |
| Hipoglikemia & tanda bahaya gula darah | **ADA, Standards of Care in Diabetes 2026**, bagian 6 ([Diabetes Care](https://diabetesjournals.org/care/article/49/Supplement_1/S132/163927/6-Glycemic-Goals-Hypoglycemia-and-Hyperglycemic)): level 1 < 70 mg/dL, level 2 < 54 mg/dL |
| Asam urat | **ACR 2020 Guideline for the Management of Gout** ([Arthritis Care Res](https://acrjournals.onlinelibrary.wiley.com/doi/10.1002/acr.24180)): batasi alkohol, purin, dan sirup jagung tinggi fruktosa. **Choi et al., NEJM 2004** ([PubMed 15195344](https://pubmed.ncbi.nlm.nih.gov/15195344/)): risiko naik pada daging & seafood, sayuran tinggi purin tidak meningkatkan risiko, dan susu cenderung melindungi |
| Kolesterol | **PERKENI, Panduan Pengelolaan Dislipidemia di Indonesia 2021** ([PDF](https://pbperkeni.or.id/wp-content/uploads/2022/02/23-11-21-Website-Panduan-Dislipidemia-2021-Ebook.pdf)); **AHA**, [Saturated Fats](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats): < 6% kalori (≈ 13 g/hari) untuk yang perlu menurunkan LDL; minyak kelapa, sawit, dan santan termasuk tinggi lemak jenuh |
| Tekanan darah & tanda bahaya | **AHA**, [Understanding Blood Pressure Readings](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings): ≥ 180/120 = krisis hipertensi |
| Alergen | Daftar ditambah **wijen** (alergen umum yang wajib dilabel di banyak negara). **Peraturan BPOM No. 31 Tahun 2018** tentang Label Pangan Olahan ([PDF](https://tabel-gizi.pom.go.id/regulasi/6_PerBPOM_Nomor_31_Tahun_2018_tentang_Label_Pangan_Olahan.pdf)): gluten, telur, ikan, krustasea, moluska, kacang tanah, kedelai, susu, sulfit |

| Stroke | Kemenkes, [Kenali Gejala Stroke dengan SeGeRa Ke RS](https://ayosehat.kemkes.go.id/kenali-gejala-stroke-dengan-segera-ke-rs); nomor darurat medis nasional **119** ([Kemenkes PSC 119](https://kemkes.go.id/eng/%20kejadian-gawat-darurat-medik-laporkan-ke-119)) |
| Interaksi obat | FDA, [Grapefruit Juice and Some Drugs Don't Mix](https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix); NIH ODS, [Vitamin K](https://ods.od.nih.gov/factsheets/VitaminK-Consumer/) (warfarin: asupan konsisten); MedlinePlus, [Metformin](https://medlineplus.gov/druginfo/meds/a696005.html) (alkohol) |
| Darah rendah setelah makan | [Postprandial Hypotension, Cleveland Clinic](https://my.clevelandclinic.org/health/diseases/postprandial-hypotension): porsi kecil, kurangi karbohidrat sekaligus, hindari alkohol |

## Makanan yang belum ada di tabel

Makanan baru **tidak dinilai langsung oleh AI**. Alurnya:

1. **Produk kemasan bermerek** (mis. Chitato, Indomie): angka diambil dari **label kemasan** di [Open Food Facts](https://world.openfoodfacts.org) (ODbL). Merek wajib cocok; kode produk dicatat.
2. **Masakan/jajanan**: AI hanya **menguraikan resep satu porsi** (bahan + gram). Angka karbohidrat, gula, natrium, dan lemak jenuh **dihitung dari tabel bahan dasar** `src/lib/foods/ingredients.json` (131 bahan, per 100 g):
   - **USDA FoodData Central, SR Legacy 2018-04** (domain publik), setiap bahan mencatat ID FDC-nya.
   - Bahan khas Indonesia yang tidak ada di USDA (kecap manis, sambal ulek, kerupuk, emping, mi instan goreng): **median label kemasan** di Open Food Facts, kode produknya dicatat.
   - Gula yang dihitung = **gula bebas** (WHO): gula total untuk bahan yang gulanya ditambahkan; 0 untuk buah utuh, susu tawar, sayur, dan bahan pokok.
   - Purin per bahan memakai kelompok ACR 2020 / Choi 2004 (USDA tidak mencatat purin). Satu porsi: bahan tinggi purin ≥ 30 g → tinggi; ≥ 10 g, atau bahan sedang ≥ 50 g → sedang.
   - IG porsi = rata-rata IG bahan berkarbohidrat, dibobot gram karbohidratnya.
3. Angka per porsi diubah ke rendah/sedang/tinggi dengan **ambang yang sama** seperti tabel utama (di bawah), lalu lampu ditentukan mesin aturan yang sama.
4. Hasilnya disimpan (`ai_foods`) beserta rincian bahan & sumbernya, dan ditampilkan di aplikasi ("Dari mana angkanya?").

Tabel bahan dibangun ulang dengan `python3 tools/build_ingredients.py <folder SR Legacy>`.
Keterbatasan: gram resep tetap perkiraan AI; bahan yang tidak ada di tabel tidak terhitung (aplikasi memberi tahu kalau cakupannya < 80%).

## Ambang per porsi aman

| Dimensi | Rendah | Sedang | Tinggi | Dasar |
|---|---|---|---|---|
| Karbohidrat | < 15 g | 15–40 g | > 40 g | 1 satuan penukar karbohidrat Kemenkes ≈ 40 g (≈ ¾ gelas nasi) |
| Gula bebas/tambahan | < 5 g | 5–12,5 g | > 12,5 g | 12,5 g = 1 sdm = ¼ batas gula harian GGL |
| Natrium (garam) | < 400 mg | 400–800 mg | > 800 mg | 800 mg ≈ 40% batas natrium harian GGL/WHO |
| Lemak jenuh | < 3 g | 3–6 g | > 6 g | 6 g ≈ separuh batas AHA 13 g/hari |
| Indeks glikemik (IG) | ≤ 55 | 56–69 | ≥ 70 | Kategori Atkinson et al. 2021; hanya untuk makanan berkarbohidrat sedang/tinggi, dari komponen karbo utamanya (nasi putih ±73, beras merah ±65, kentang rebus ±78, mi gandum ±45–55) |
| Purin | rendah | sedang | tinggi | Kelompok bahan pangan menurut ACR 2020 & Choi 2004 (jeroan, emping/melinjo, teri, sarden, kerang, kambing, kaldu pekat, alkohol = tinggi) |

Gula alami di **buah utuh** dan **laktosa susu** tidak dihitung sebagai gula bebas (definisi WHO), tapi karbohidratnya tetap dihitung.

## Aturan lampu per kondisi

| Kondisi | 🔴 Merah | 🟡 Kuning |
|---|---|---|
| Diabetes | gula tinggi; karbo tinggi + bergula; **dobel karbohidrat** dalam satu kali makan (mis. nasi + mi); diabetes kehamilan: gula tambahan sedang | karbo tinggi (pesan lebih tegas bila IG tinggi); karbo sedang + IG tinggi; gula sedang |
| Darah tinggi | **dobel garam** dalam satu kali makan | garam sedang/tinggi; jeruk bali (interaksi obat tensi) |
| Asam urat | purin tinggi; saat kambuh: purin sedang + garam tinggi | purin sedang; minuman manis berfruktosa |
| Kolesterol | lemak jenuh tinggi; **dobel lemak jenuh** (≥ 2 komponen berlemak jenuh sedang/tinggi) | lemak jenuh sedang; kemungkinan lemak trans (margarin, biskuit krim, minyak dipakai berulang); kolesterol makanan tinggi (jeroan, udang, cumi, kerang, kepiting) |
| Alergi | biasanya mengandung alergen yang dimiliki (resep umum) | risiko kontaminasi silang menurut kategori (mis. minyak gorengan dipakai bersama udang, bumbu kacang di kaki lima); makanan yang tidak ada di daftar |
| Pasca stroke / jantung | garam tinggi; lemak jenuh tinggi; alkohol; dobel garam / dobel lemak jenuh | garam sedang; lemak jenuh sedang; kemungkinan lemak trans |
| Darah rendah | — | porsi karbohidrat besar (tensi bisa turun setelah makan); alkohol. Garam **tidak** dinilai negatif |
| Makan sehat | — | gula, garam, atau lemak jenuh tinggi |
| Semua | — | belimbing & jengkol (hati-hati untuk ginjal) |

Kalau seseorang punya beberapa kondisi, **lampu yang ditampilkan adalah yang paling berat**, dan semua alasannya ikut ditampilkan.

## Interaksi makanan × obat

| Obat | Makanan | Lampu | Pesan |
|---|---|---|---|
| Statin (simvastatin, atorvastatin) | jeruk bali | 🔴 | bisa menaikkan kadar obat; risiko nyeri/kerusakan otot |
| CCB (amlodipin, nifedipin, felodipin) | jeruk bali | 🟡 | bisa menaikkan kadar obat (terutama felodipin/nifedipin) |
| Warfarin | sayuran hijau tinggi vitamin K | 🟡 | boleh, tapi jumlahnya harus **konsisten** setiap hari |
| Warfarin, antiplatelet | alkohol | 🔴 | risiko perdarahan |
| Metformin | alkohol | 🔴 | asidosis laktat & gula darah rendah |
| Sulfonilurea, insulin | alkohol | 🔴 | gula darah sangat rendah |
| Allopurinol | alkohol | 🟡 | melawan kerja obat asam urat |

Setiap peringatan obat menyarankan konfirmasi ke dokter. Aplikasi tidak pernah mengubah atau menyarankan dosis.

## Target dari dokter
Kalau profil berisi target dokter (gula puasa, gula 2 jam, tensi), target itu **menggantikan** target umum ADA/AHA. Tanda bahaya (gula < 70 atau > 250, tensi ≥ 180/120 atau < 80) tetap berlaku apa pun targetnya.

## Tanda bahaya pada catatan pemantauan

| Catatan | Ambang | Pesan |
|---|---|---|
| Gula darah (diabetes kehamilan) | puasa ≥ 95, 2 jam setelah makan ≥ 120 mg/dL | Di atas target kehamilan (ADA bagian 15): bicarakan dengan dokter kandungan |
| Gula darah | < 70 mg/dL | Hipoglikemia: segera makan/minum 15 g gula cepat (mis. ½ gelas jus/teh manis), cek ulang 15 menit (aturan 15-15 ADA) |
| Gula darah | < 54 mg/dL | Hipoglikemia berat: minta bantuan, hubungi dokter/IGD |
| Gula darah | > 250 mg/dL | Sangat tinggi: hubungi dokter, terutama jika sakit, mual, atau muntah |
| Tensi | < 80 sistolik | Sangat rendah: berbaring, kaki ditinggikan, minum; kalau pingsan/bingung/nyeri dada hubungi 119 |
| Tensi | ≥ 180/120 mmHg | Ukur ulang 5 menit lagi. Jika tetap setinggi itu, **atau** ada nyeri dada, sesak, lemah/kesemutan, bicara pelo, atau gangguan penglihatan: ke IGD |
| Asam urat | kambuh > 7 hari, nyeri ≥ 8/10, demam | Periksa ke dokter |

Aplikasi **tidak pernah** menyarankan obat, dosis obat, atau dosis insulin.

## Cara mengoreksi data
1. Ubah baris makanan di `tools/build_foods.py` (purin, garam, porsi, tips) atau `tools/nutrition.py` (karbo, gula, lemak, alergen).
2. Jalankan `python3 tools/build_foods.py`, lalu `npm test`.
3. Catat alasan perubahan dan sumbernya di commit.
