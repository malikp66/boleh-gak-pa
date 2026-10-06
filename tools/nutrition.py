"""Dimensi gizi tambahan per makanan, untuk diabetes, kolesterol, dan alergi.

Format:  "nama": "KGL alergen,alergen"
  K = karbohidrat per porsi aman   r < 15 g | s 15–40 g (≤ 1 penukar KH) | t > 40 g
  G = gula bebas/tambahan per porsi r < 5 g  | s 5–12,5 g (≤ 1 sdm)        | t > 12,5 g
  L = lemak jenuh per porsi         r < 3 g  | s 3–6 g                       | t > 6 g
  (gula alami buah utuh & laktosa susu tidak dihitung sebagai gula bebas — definisi WHO;
   karbohidratnya tetap dihitung di K)

Alergen (daftar wajib label BPOM No. 31/2018 + kacang pohon):
  gl gluten · tl telur · su susu · kt kacang tanah · kd kedelai · ik ikan
  kr krustasea (udang, kepiting, terasi, petis udang, ebi) · mo moluska (cumi, kerang, gurita) · kp kacang pohon (mete, almond)
  wj wijen

IG (indeks glikemik, hanya untuk makanan dengan karbohidrat sedang/tinggi), kategori Atkinson et al. 2021:
  r ≤ 55 · s 56–69 · t ≥ 70. Untuk hidangan campuran dipakai komponen karbohidrat utamanya.

Nilai adalah PERKIRAAN untuk porsi khas di Indonesia, disusun dari TKPI Kemenkes,
satuan penukar Kemenkes, dan tabel indeks glikemik internasional. Lihat docs/SUMBER-GIZI.md.
"""

N = {
    # ---------------- Kaki lima
    "ketoprak": "tss kt,kd,tl", "gado-gado": "sss kt,kd,tl", "lotek": "ssr kt", "pecel": "ssr kt",
    "siomay": "ssr ik,kt,kd,tl", "batagor": "sss ik,kt,kd", "tahu gejrot": "rss kd", "kerak telor": "trs tl,kr",
    "cilok": "tsr kt", "seblak": "trs tl", "cakwe": "srs gl", "otak-otak": "ssr ik,kt", "pempek": "ttr ik,tl,gl",
    "kue cubit": "sts gl,tl,su", "telur gulung": "rrs tl", "sosis bakar": "rst gl", "bakso bakar": "rss ",
    # ---------------- Nasi & lauk
    "nasi putih": "trr ", "nasi goreng": "tss tl,kd", "bubur ayam": "trr kd,gl", "nasi uduk": "trs kd",
    "nasi kuning": "trs tl", "nasi liwet": "trs ik", "nasi padang rendang": "trt ", "ayam pop": "rrs ",
    "dendeng balado": "rss ", "nasi campur": "tss tl", "nasi kucing": "srr ik", "nasi bebek": "trt ",
    "nasi kebuli": "trt su", "lontong sayur": "trs tl", "ketupat sayur": "trs tl", "sambal goreng ati": "rss ",
    "semur daging": "rss kd", "empal": "rss ", "telur": "rrr tl", "telur asin": "rrr tl", "pindang telur": "rsr tl,kd",
    "ayam goreng": "rrs ", "ayam taliwang": "rrs ", "tahu goreng": "rrr kd", "tempe goreng": "rrr kd",
    "perkedel": "srs tl", "abon": "rss ", "kornet": "rrt ",
    # ---------------- Berkuah
    "soto ayam": "srs tl", "soto betawi": "srt su", "coto makassar": "srs kt", "rawon": "srs ",
    "sop buntut": "rrt ", "sup kambing": "rrt ", "tengkleng": "rrt ", "gulai kambing": "rrt ", "gulai ayam": "rrs ",
    "sayur lodeh": "rrs ", "sayur asem": "rrr kt", "sup ayam": "srr ", "pindang ikan": "rsr ik", "garang asem": "rrs ",
    "brongkos": "rss kd",
    # ---------------- Sate & bakar
    "sate ayam": "sss kt,kd", "sate kambing": "rst kd", "sate padang": "srs ", "sate maranggi": "rss kd",
    "sate taichan": "rrr ", "sate usus": "rss kd", "sate telur puyuh": "rsr tl,kd", "ikan bakar": "rsr ik,kd",
    "ayam bakar madu": "rts kd",
    # ---------------- Daging & jeroan
    "gulai otak": "rrt ", "ceker": "rrs ", "iga bakar": "rst kd", "daging kambing": "rrt ", "bebek": "rrt ",
    # ---------------- Seafood
    "seafood": "rss kr,mo,ik", "udang": "rrr kr", "kerang": "rrr mo", "cumi": "rrr mo", "kepiting": "rsr kr",
    "sarden": "rrs ik", "ikan teri": "rrr ik", "ikan tongkol": "rrr ik", "ikan asin": "rrr ik", "pecel lele": "rrs ik",
    "ikan salmon": "rrs ik",
    # ---------------- Mi & bakso
    "bakso": "srs gl", "mi ayam": "tss gl,kd", "mi instan": "trt gl,kd", "mi goreng": "tss gl,kd,tl",
    "bihun goreng": "tss kd,tl", "mi aceh": "trs gl,kr", "mi kocok": "trs gl", "pangsit": "trs gl",
    # ---------------- Gorengan & camilan
    "gorengan": "srs gl", "emping melinjo": "srr ", "kerupuk": "rrr kr", "rempeyek": "rrs kt", "kacang goreng": "rrs kt",
    "keripik": "srs ", "martabak telur": "srt gl,tl", "risoles": "srs gl,tl,su", "mi lidi": "srs gl", "popcorn": "srr ",
    "kacang mete": "rrs kp",
    # ---------------- Kue & manis
    "martabak manis": "ttt gl,tl,su,kt", "klepon": "sss ", "bubur kacang hijau": "tts ", "kolak": "tts ",
    "es campur": "str su", "roti bakar": "sss gl,su", "sourdough": "srr gl", "croissant": "srt gl,su,tl",
    "roti manis": "sss gl,su,tl", "donat": "sts gl,tl,su", "roti bakar bandung": "tts gl,su",
    "pisang goreng keju": "tts gl,su", "bolu": "sts gl,tl,su", "kue kering": "sss gl,tl,su", "es krim": "sts su",
    "puding": "str su", "permen": "rsr ", "cokelat": "rss su", "serabi": "tss ", "lemper": "srr ",
    # ---------------- Sayur & lalapan
    "capcay": "rrr ", "tumis kangkung": "rrr kr", "bayam": "rrr ", "urap": "rrs ", "lalapan": "rrr ",
    "tumis jamur": "rrr ", "sayur nangka": "sts tl", "oseng tempe": "rsr kd", "sambal": "rrr kr", "timun": "rrr ",
    "selada": "rrr ", "kemangi": "rrr ", "wortel": "rrr ", "tomat": "rrr ", "brokoli": "rrr ", "kembang kol": "rrr ",
    "kol": "rrr ", "sawi": "rrr ", "buncis": "rrr ", "kacang panjang": "rrr ", "tauge": "rrr ", "terong": "rrr ",
    "labu siam": "rrr ", "labu kuning": "rrr ", "oyong": "rrr ", "pare": "rrr ", "daun singkong": "rrr ",
    "daun pepaya": "rrr ", "asparagus": "rrr ", "daun melinjo": "rrr ", "petai": "rrr ", "jengkol": "srr ",
    "jagung": "srr ", "kentang": "srr ", "singkong": "srr ", "ubi": "srr ", "genjer": "rrr ", "pakis": "rrr ",
    "rebung": "rrr ", "nangka muda": "rrs ", "kacang merah": "srr ", "edamame": "rrr kd", "cabai": "rrr ",
    "bawang putih": "rrr ",
    # ---------------- Buah (gula alami buah utuh tidak dihitung sebagai gula bebas)
    "buah potong": "srr ", "ceri": "rrr ", "durian": "srr ", "nangka": "srr ", "alpukat": "rrr ", "pisang": "srr ",
    "pepaya": "srr ", "jeruk": "srr ", "jeruk bali": "srr ", "semangka": "srr ", "melon": "srr ", "apel": "srr ",
    "mangga": "srr ", "nanas": "srr ", "anggur": "srr ", "salak": "srr ", "rambutan": "srr ", "duku": "srr ",
    "manggis": "srr ", "jambu biji": "srr ", "jambu air": "rrr ", "belimbing": "rrr ", "sirsak": "srr ", "sawo": "srr ",
    "kelengkeng": "srr ", "buah naga": "srr ", "stroberi": "rrr ", "kiwi": "srr ", "pir": "srr ", "markisa": "rrr ",
    "kedondong": "rrr ", "srikaya": "srr ", "kurma": "srr ", "kelapa": "rrt ",
    # ---------------- Minuman
    "es teh manis": "str ", "minuman soda": "str ", "soda tanpa gula": "rrr ", "air putih": "rrr ", "teh tawar": "rrr ",
    "kopi": "rrr ", "kopi susu": "sts su", "susu": "rrs su", "jus buah": "str ", "wedang jahe": "ssr ", "bir": "srr gl",
    "minuman energi": "str ", "boba": "tts su", "es kelapa muda": "ssr ", "jus sayur": "rrr ", "cincau": "tts ",
    "susu kedelai": "ssr kd", "jamu": "ssr ",
    # ---------------- Fast food & western
    "pizza": "srt gl,su", "burger": "sst gl,su,tl", "fried chicken": "rrs gl", "kentang goreng": "srs ",
    "hot dog": "sst gl", "spaghetti": "tss gl,su,tl", "steak sapi": "rrt ", "chicken steak": "sss gl,tl",
    "sandwich": "srs gl,tl", "salad": "rsr tl", "sup krim": "srt su,gl,mo", "nugget": "srs gl,tl",
    # ---------------- Chinese & oriental
    "bakmi": "tss gl,kd,tl", "kwetiau siram": "tss kd,tl", "fuyunghai": "sts tl,kr", "dimsum": "sss gl,kr,kd",
    "ayam asam manis": "sts gl", "bebek peking": "stt gl,kd", "nasi hainan": "trs kd", "bubur ayam kanton": "trr tl,kd",
    "hotpot": "sst kr,mo,ik,kd,gl", "mala": "sst kd,gl,kt",
    # ---------------- Jepang & Korea
    "sushi": "tsr ik,kd,gl,kr,mo,tl", "ramen": "trt gl,kd,tl", "udon": "tsr gl,kd,ik", "takoyaki": "sss gl,tl,mo",
    "beef bowl": "tss kd,gl", "chicken teriyaki": "rss kd,gl", "tempura": "srs gl,tl,kr", "korean bbq": "rst kd,gl,wj",
    "tteokbokki": "ttr gl,kd,ik", "kimchi": "rrr ik,kr", "ramyeon": "trt gl,kd", "ayam korea": "sts gl,kd",
    # ---------------- Masakan daerah
    "nasi tutug oncom": "trs kt,ik", "nasi timbel": "trs ik,kd", "gudeg krecek": "ttt tl", "pecak lele": "rrs ik",
    "papeda": "trr ik", "ayam betutu": "rrt ", "sate lilit": "rss ik", "rujak cingur": "sss kt,kr",
    "rujak buah": "str kt,kr", "lontong balap": "tss mo,kd,kr", "tahu tek": "sss kd,kt,kr,tl", "pallubasa": "srt ",
    "ikan bakar rica": "rrr ik", "nasi jamblang": "trs kd,tl", "bakso malang": "srs gl,kd,tl", "soto banjar": "srs tl",
    "kerupuk mie": "srs ik,gl",
    # ---------------- Tambahan Okt 2026
    "nasi merah": "trr ", "nasi jagung": "trr ", "lontong": "trr ", "nasi goreng kambing": "tst su", "nasi bakar": "trs ",
    "oatmeal": "srr gl", "sereal": "ssr gl,su", "mie shirataki": "rrr ", "sukun": "srr ",
    "ayam kecap": "rss kd,gl", "opor ayam": "rrt ", "rendang ayam": "rrt ", "pepes ikan": "rrr ik", "pepes tahu": "rrr kd",
    "bandeng presto": "rrs ik", "sate bandeng": "rss ik", "gulai tunjang": "rrt ", "tahu bulat": "rrs kd", "keripik tempe": "rrs kd",
    "ikan goreng": "rrs ik", "tahu bakso": "rss kd", "amplang": "srs ik",
    "sop kaki sapi": "rrt ", "sayur sop": "srr ", "tekwan": "srr ik", "soto daging": "srs ", "gulai ikan": "rrs ik",
    "martabak india": "srt gl,tl,su", "kupat tahu": "tss kt,kd", "lumpia basah": "srs gl,kr,tl", "pisang epe": "str ",
    "kue putu": "sss ", "getuk": "ssr ", "lupis": "str ", "bubur sumsum": "sts ", "onde-onde": "sss wj,gl", "bakpia": "sss gl",
    "lapis legit": "stt gl,tl,su", "dodol": "sts ", "bubur ketan hitam": "tts ", "wingko": "sts tl", "biskuit krim": "sss gl,su",
    "keripik pisang": "sss ", "kuaci": "rrr ",
    "susu kental manis": "rtr su", "gula pasir": "rsr ", "madu": "rsr ", "sirup": "str ", "kecap manis": "rsr kd,gl",
    "saus tomat": "rsr ", "mayones": "rrs tl", "mentega": "rrs su", "keju": "rrs su", "santan": "rrt ", "minyak goreng": "rrs ",
    "selai kacang": "rss kt", "selai cokelat": "rts su,kp", "sambal matah": "rrr ", "acar": "rrr ",
    "teh tarik": "sts su", "matcha latte": "sts su", "cokelat panas": "sts su", "susu kotak": "ssr su", "yakult": "ssr su",
    "infused water": "rrr ", "wedang ronde": "tts kt", "stmj": "sss su,tl", "smoothie": "ssr su",
    "fish and chips": "srs ik,gl", "kesemek": "srr ", "kolang-kaling": "ssr ",
}

# Indeks glikemik untuk makanan berkarbohidrat sedang/tinggi (perkiraan dari komponen karbo utamanya).
IG = {
    # nasi & olahan beras (nasi putih rata-rata 73; ketan & lontong tinggi; beras merah 65; basmati ±58)
    "nasi putih": "t", "nasi goreng": "t", "bubur ayam": "t", "nasi uduk": "t", "nasi kuning": "t", "nasi liwet": "t",
    "nasi padang rendang": "t", "nasi campur": "t", "nasi kucing": "t", "nasi bebek": "t", "nasi kebuli": "s",
    "lontong sayur": "t", "ketupat sayur": "t", "lontong": "t", "nasi goreng kambing": "t", "nasi bakar": "t",
    "nasi merah": "s", "nasi jagung": "s", "nasi hainan": "t", "bubur ayam kanton": "t", "beef bowl": "t", "sushi": "s",
    "nasi tutug oncom": "t", "nasi timbel": "t", "nasi jamblang": "t", "lontong balap": "t", "kupat tahu": "t",
    "kerak telor": "t", "klepon": "t", "lupis": "t", "serabi": "t", "lemper": "t", "bubur ketan hitam": "t", "dodol": "t",
    "tteokbokki": "t", "papeda": "t",
    # mi & tepung (mi gandum ±45-55; bihun/kwetiau beras ±58-61; roti putih ±75)
    "mi instan": "r", "mi ayam": "r", "mi goreng": "r", "bihun goreng": "s", "mi aceh": "r", "mi kocok": "r", "pangsit": "r",
    "bakmi": "r", "kwetiau siram": "s", "udon": "r", "ramen": "r", "ramyeon": "r", "spaghetti": "r", "bakso": "s",
    "bakso malang": "s", "soto banjar": "s", "soto ayam": "s", "soto betawi": "s", "coto makassar": "t", "rawon": "s",
    "soto daging": "s", "sup ayam": "t", "sayur sop": "t", "tekwan": "s",
    "roti bakar": "t", "roti manis": "t", "roti bakar bandung": "t", "sourdough": "r", "croissant": "s", "donat": "t",
    "bolu": "s", "kue kering": "s", "martabak manis": "t", "martabak telur": "s", "martabak india": "s", "pizza": "s",
    "burger": "s", "hot dog": "s", "sandwich": "s", "chicken steak": "s", "sup krim": "s", "nugget": "s", "fish and chips": "s",
    "kue cubit": "s", "biskuit krim": "s", "bakpia": "s", "lapis legit": "s", "wingko": "s", "onde-onde": "s", "kue putu": "s",
    "cakwe": "s", "risoles": "s", "gorengan": "s", "lumpia basah": "s", "takoyaki": "s", "tempura": "s", "dimsum": "s",
    "fuyunghai": "s", "ayam asam manis": "s", "bebek peking": "s", "ayam korea": "s", "hotpot": "s", "mala": "s",
    # tepung tapioka/sagu
    "cilok": "t", "seblak": "t", "pempek": "t", "otak-otak": "s", "siomay": "s", "batagor": "s", "kerupuk mie": "t",
    "mi lidi": "t", "keripik": "s", "emping melinjo": "s", "amplang": "s",
    # umbi & jagung (kentang rebus ±78; ubi ±63; singkong bervariasi; jagung ±52; sukun ±?)
    "kentang": "t", "kentang goreng": "s", "perkedel": "t", "ubi": "s", "singkong": "s", "jagung": "r", "sukun": "s",
    "getuk": "s", "jengkol": "r", "kacang merah": "r", "sayur nangka": "s", "gudeg krecek": "s",
    # sereal
    "oatmeal": "r", "sereal": "t", "popcorn": "s",
    # buah (semangka ±76; pepaya ±60; nanas ±59; melon ±65; pisang ±51; apel ±36; jeruk ±43)
    "buah potong": "s", "durian": "r", "nangka": "s", "pisang": "r", "pepaya": "s", "jeruk": "r", "jeruk bali": "r",
    "semangka": "t", "melon": "s", "apel": "r", "mangga": "r", "nanas": "s", "anggur": "r", "salak": "s", "rambutan": "s",
    "duku": "s", "manggis": "s", "jambu biji": "r", "sirsak": "r", "sawo": "s", "kelengkeng": "s", "buah naga": "r",
    "kiwi": "r", "pir": "r", "srikaya": "s", "kurma": "r", "kesemek": "r", "pisang epe": "s", "pisang goreng keju": "s",
    "keripik pisang": "s",
    # manis & minuman (sukrosa ±65; glukosa/maltodekstrin tinggi; susu & yogurt rendah)
    "kolak": "s", "bubur kacang hijau": "s", "bubur sumsum": "t", "es campur": "s", "es krim": "r", "puding": "s",
    "es teh manis": "s", "minuman soda": "s", "jus buah": "r", "boba": "t", "cincau": "s", "wedang jahe": "s",
    "kopi susu": "s", "bir": "t", "minuman energi": "t", "es kelapa muda": "r", "susu kedelai": "r", "jamu": "s",
    "teh tarik": "s", "matcha latte": "s", "cokelat panas": "s", "susu kotak": "r", "yakult": "s", "wedang ronde": "t",
    "stmj": "s", "smoothie": "r", "sirup": "s", "kolang-kaling": "s",
    # hidangan campuran lain
    "ketoprak": "t", "gado-gado": "s", "lotek": "s", "pecel": "s", "sate ayam": "s", "sate padang": "t", "rujak cingur": "s",
    "rujak buah": "s", "tahu tek": "s", "pallubasa": "t", }

