#!/usr/bin/env python3
"""Boleh Gak, Pa? — teman makan untuk Papa (asam urat + darah tinggi).

Server kecil tanpa dependensi (Python stdlib) yang:
  * menyajikan PWA dari ./public
  * memanggil Gemma lewat Ollama yang jalan di laptop sendiri
  * menyimpan catatan makan & kambuh di SQLite lokal

Jalankan:  python3 server.py   lalu buka http://localhost:8787
"""
import base64
import difflib
import datetime as dt
import json
import os
import re
import sqlite3
import statistics
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
DB_PATH = os.path.join(ROOT, "data", "papa.db")
OLLAMA = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
# 4B bisa melihat foto; 1B lebih ringan (teks saja). Dipilih otomatis sesuai yang sudah terpasang.
MODEL_PREFS = os.environ.get("MODELS", "gemma3:4b,gemma3:1b").split(",")
VISION_MODELS = {"gemma3:4b", "gemma3:12b", "gemma3:27b"}
PORT = int(os.environ.get("PORT", "8787"))

with open(os.path.join(ROOT, "data", "foods.json"), encoding="utf-8") as f:
    FOODS = json.load(f)["foods"]
with open(os.path.join(ROOT, "data", "profile.json"), encoding="utf-8") as f:
    PROFILE = json.load(f)

LEVEL = {"rendah": 0, "sedang": 1, "tinggi": 2}


# ---------------------------------------------------------------- database
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS meals (
              id INTEGER PRIMARY KEY, at TEXT, food TEXT, portion TEXT,
              status TEXT, purin TEXT, garam TEXT, note TEXT);
            CREATE TABLE IF NOT EXISTS flares (
              id INTEGER PRIMARY KEY, started TEXT, ended TEXT,
              joint TEXT, pain INTEGER, fever INTEGER DEFAULT 0, note TEXT);
            CREATE TABLE IF NOT EXISTS pain_logs (
              id INTEGER PRIMARY KEY, flare_id INTEGER, at TEXT, pain INTEGER);
            CREATE TABLE IF NOT EXISTS custom_foods (
              id INTEGER PRIMARY KEY, created TEXT, name TEXT UNIQUE, aliases TEXT, kategori TEXT,
              bahan TEXT, purin TEXT, garam TEXT, porsi_aman TEXT, trik TEXT, pemicu TEXT, alasan TEXT);
            """
        )


def now():
    return dt.datetime.now().replace(microsecond=0).isoformat()


def rows(sql, *args):
    with db() as con:
        return [dict(r) for r in con.execute(sql, args).fetchall()]


# ---------------------------------------------------------------- food table
def custom_foods():
    out = []
    for r in rows("SELECT * FROM custom_foods ORDER BY created DESC"):
        out.append({"id": r["id"], "name": r["name"], "aliases": json.loads(r["aliases"] or "[]"),
                    "kategori": r["kategori"] or "Buatan keluarga", "purin": r["purin"], "garam": r["garam"],
                    "porsi_aman": r["porsi_aman"], "trik": json.loads(r["trik"] or "[]"),
                    "pemicu": json.loads(r["pemicu"] or "[]"), "bahan": r["bahan"], "alasan": r["alasan"], "custom": True})
    return out


def all_foods():
    return custom_foods() + FOODS


# kata yang tidak boleh dicocokkan secara "mirip" (bukan nama makanan)
STOPWORDS = {"dari", "temen", "teman", "sama", "pakai", "pake", "dengan", "porsi", "sedikit", "banyak", "makan",
             "minum", "warung", "beli", "dikasih", "ditraktir", "kondangan", "rumah", "terus", "lagi", "habis",
             "satu", "dua", "tiga", "piring", "mangkuk", "gelas", "sendiri", "tambah", "campur", "plus", "atau",
             "goreng", "rebus", "bakar", "ayam", "sapi", "ikan", "daging", "kuah", "manis", "pedas", "asin", "panas", "dingin", "spesial", "biasa"}


# ejaan sehari-hari → ejaan di tabel
SPELLING = {"telor": "telur", "sambel": "sambal", "ijo": "hijau", "sayor": "sayur", "pedes": "pedas",
            "mie": "mi", "bakmie": "bakmi", "nasgor": "nasi goreng", "krupuk": "kerupuk",
            "es teh": "es teh manis", "teh es": "es teh manis"}


def normalize(text):
    t = (text or "").lower()
    for a, b in SPELLING.items():
        t = re.sub(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])", b, t)
    return t


def find_foods(text):
    """Temukan SEMUA makanan dalam teks bebas ('indomi ketoprak', 'soto + es teh').

    1) cocok persis (nama/alias terpanjang dulu, tidak saling tumpang tindih)
    2) sisa kata dicocokkan secara mirip untuk salah ketik ('indomi' → 'indomie')
    """
    t = " " + re.sub(r"[^a-z0-9\s-]", " ", normalize(text)) + " "
    original = t
    names = sorted(((n, f) for f in all_foods() for n in [f["name"]] + f["aliases"] if n),
                   key=lambda x: -len(x[0]))
    found, seen = [], set()

    def add(food, matched, pos):
        if food["name"] not in seen:
            seen.add(food["name"])
            found.append({**food, "matched": matched, "_pos": pos})

    for name, food in names:
        m = re.search(r"(?<![a-z])" + re.escape(name) + r"(?![a-z])", t)
        if m:
            add(food, name, m.start())
            t = t[:m.start()] + " " * len(name) + t[m.end():]

    lookup = {n: f for n, f in names}
    words = [w for w in t.split() if len(w) >= 4 and w not in STOPWORDS]
    used = set()
    grams = [(i, i + 2) for i in range(len(words) - 1)] + [(i, i + 1) for i in range(len(words))]
    for a, b in grams:
        if used & set(range(a, b)):
            continue
        g = " ".join(words[a:b])
        close = difflib.get_close_matches(g, lookup.keys(), n=1, cutoff=0.84)
        if close:
            used |= set(range(a, b))
            add(lookup[close[0]], close[0] + f" (dari '{g}')", original.find(g))
    found.sort(key=lambda f: f.pop("_pos"))
    # buang yang sebenarnya bahan dari makanan lain ('ketoprak tahu' → tahu sudah termasuk ketoprak)
    order = ["hijau", "kuning", "merah"].index

    def is_ingredient(f):
        # hanya dibuang kalau risikonya tidak lebih berat dari makanan induknya
        return any(o is not f and f["matched"].split(" (")[0] in " ".join(o["pemicu"]).lower()
                   and order(rule_status(f, False)) <= order(rule_status(o, False)) for o in found)
    return [f for f in found if not is_ingredient(f)] or found


def find_food(text):
    foods = find_foods(text)
    return foods[0] if foods else None


def combine(foods):
    """Gabungkan beberapa makanan jadi satu penilaian: ambil tingkat terberat."""
    if not foods:
        return None
    if len(foods) == 1:
        return foods[0]
    top = lambda key: max((f[key] for f in foods), key=lambda v: LEVEL[v])
    return {
        "name": " + ".join(f["name"] for f in foods),
        "aliases": [], "kategori": "Kombinasi",
        "purin": top("purin"), "garam": top("garam"),
        "porsi_aman": "; ".join(f"{f['name']}: {f['porsi_aman']}" for f in foods),
        "trik": [t for f in foods for t in f["trik"][:2]],
        "pemicu": [p for f in foods for p in f["pemicu"][:2]],
        "components": foods,
    }


def rule_status(food, active_flare):
    """Lampu ditentukan tabel, bukan AI — supaya konsisten dan bisa dicek."""
    if not food:
        return None
    parts = food.get("components")
    if parts:
        statuses = [rule_status(f, active_flare) for f in parts]
        worst = max(statuses, key=["hijau", "kuning", "merah"].index)
        # dua makanan tinggi garam sekaligus = beban besar untuk tensi
        if sum(f["garam"] == "tinggi" for f in parts) >= 2:
            return "merah"
        return worst
    p, g = LEVEL[food["purin"]], LEVEL[food["garam"]]
    if p == 2 or (active_flare and p >= 1 and g == 2):
        return "merah"
    if p == 1 or g >= 1 or has_warning(food):
        return "kuning"
    return "hijau"


WARNING_WORDS = ("interaksi", "ginjal", "jengkolat", "berfruktosa tinggi")


def has_warning(food):
    """Peringatan di luar purin/garam (mis. jeruk bali × obat tensi, belimbing × ginjal)."""
    return any(w in p.lower() for p in food.get("pemicu", []) for w in WARNING_WORDS)


def active_flare():
    r = rows("SELECT * FROM flares WHERE ended IS NULL ORDER BY started DESC LIMIT 1")
    return r[0] if r else None


def meals_today():
    today = dt.date.today().isoformat()
    return rows("SELECT food, status FROM meals WHERE at >= ? ORDER BY at", today)


# ---------------------------------------------------------------- ollama
def installed_models():
    try:
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=3) as resp:
            return {m["name"] for m in json.loads(resp.read()).get("models", [])}
    except Exception:
        return set()


def pick_model(vision=False):
    have = installed_models()
    for m in MODEL_PREFS:
        if m in have and (not vision or m in VISION_MODELS):
            return m
    return None


def ollama_chat(messages, schema=None, timeout=240, vision=False, temperature=0.3):
    model = pick_model(vision)
    if not model:
        raise RuntimeError("model Gemma belum terpasang" + (" (perlu gemma3:4b untuk foto)" if vision else ""))
    body = {"model": model, "messages": messages, "stream": False,
            "options": {"temperature": temperature}, "keep_alive": "30m"}
    if schema:
        body["format"] = schema
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())["message"]["content"]


def identify_schema():
    names = sorted({f["name"] for f in all_foods()}) + ["lainnya"]
    return {
        "type": "object",
        "properties": {
            "nama": {"type": "string"},
            "jenis": {"type": "string", "enum": ["makanan jadi", "jajanan kemasan", "buah", "sayur", "minuman", "lainnya"]},
            "komponen": {"type": "array", "items": {"type": "string"}},
            "berkuah": {"type": "boolean"},
            "food": {"type": "string", "enum": names},
            "confidence": {"type": "string", "enum": ["yakin", "kurang yakin"]},
        },
        "required": ["nama", "jenis", "komponen", "berkuah", "food", "confidence"],
    }


# Ciri visual untuk makanan yang sering tertukar. Dipakai untuk mengecek ulang tebakan model.
CIRI = {
    "ketoprak": ["lontong", "ketupat", "tahu", "bihun", "soun", "tauge", "toge", "bumbu kacang", "saus kacang", "kerupuk", "telur", "bawang goreng"],
    "gado-gado": ["sayur", "kentang", "kol", "kubis", "kacang panjang", "tauge", "bumbu kacang", "saus kacang", "kerupuk", "telur", "lontong", "timun", "tempe"],
    "pecel": ["bayam", "kangkung", "tauge", "sayur", "sambal kacang", "bumbu kacang", "rempeyek", "peyek"],
    "lotek": ["sayur", "bumbu kacang", "kol", "tauge"],
    "siomay": ["siomay", "kol", "kentang", "pare", "tahu", "telur", "bumbu kacang", "saus kacang"],
    "batagor": ["batagor", "tahu goreng", "bumbu kacang", "kecap"],
    "soto ayam": ["kuah", "kuah kuning", "ayam suwir", "suwiran ayam", "soun", "bihun", "koya", "telur", "seledri", "mangkuk"],
    "soto betawi": ["kuah santan", "kuah susu", "daging", "babat", "tomat", "emping", "mangkuk"],
    "bakso": ["bakso", "bola daging", "kuah", "mie", "mangkuk", "tahu"],
    "mi ayam": ["mie", "mi", "ayam kecap", "sawi", "pangsit", "mangkuk"],
    "sate ayam": ["sate", "tusuk", "bumbu kacang", "lontong", "kecap", "bawang merah"],
    "nasi goreng": ["nasi goreng", "nasi", "telur ceplok", "telur mata sapi", "kerupuk", "acar", "timun"],
    "nasi padang rendang": ["nasi", "rendang", "daun singkong", "sambal hijau", "gulai", "kuah"],
    "lontong sayur": ["lontong", "kuah santan", "labu siam", "sayur", "telur"],
    "bubur ayam": ["bubur", "ayam suwir", "cakwe", "kerupuk", "kacang", "mangkuk"],
    "rawon": ["kuah hitam", "kuah gelap", "daging", "tauge", "telur asin"],
}
SOUPY = {"soto ayam", "soto betawi", "bakso", "rawon", "lontong sayur", "sop buntut", "mi ayam"}


def recheck(guess, komponen, berkuah):
    """Bandingkan komponen yang dilihat model dengan ciri tiap makanan."""
    seen = " ".join(komponen).lower()
    scores = {}
    for name, ciri in CIRI.items():
        score = sum(1 for c in ciri if c in seen)
        if name in SOUPY and not berkuah:
            score -= 3
        if name not in SOUPY and berkuah and name not in ("bubur ayam",):
            score -= 1
        scores[name] = score
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    best, best_score = ranked[0]
    guess_score = scores.get(guess, None)
    overridden = guess_score is not None and best != guess and best_score >= guess_score + 2
    if guess_score is None and best_score >= 4 and guess == "lainnya":
        overridden = True
    final = best if overridden else guess
    alts = [n for n, sc in ranked if n != final and sc > 0][:3]
    return final, overridden, alts

ASSESS_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "portion": {"type": "string"},
        "tips": {"type": "array", "items": {"type": "string"}},
        "refusals": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
        "if_forced": {"type": "string"},
        "why": {"type": "string"},
        "status": {"type": "string", "enum": ["hijau", "kuning", "merah"]},
    },
    "required": ["headline", "portion", "tips", "refusals", "if_forced", "why", "status"],
}


ANALYZE_SCHEMA = {
    "type": "object",
    "properties": {
        "kategori": {"type": "string", "enum": sorted({f["kategori"] for f in FOODS})},
        "purin": {"type": "string", "enum": ["rendah", "sedang", "tinggi"]},
        "garam": {"type": "string", "enum": ["rendah", "sedang", "tinggi"]},
        "porsi_aman": {"type": "string"},
        "trik": {"type": "array", "items": {"type": "string"}},
        "pemicu": {"type": "array", "items": {"type": "string"}},
        "alasan": {"type": "string"},
    },
    "required": ["kategori", "purin", "garam", "porsi_aman", "trik", "pemicu", "alasan"],
}

PURIN_RULES = (
    "Pedoman purin: TINGGI = jeroan (ati, ampela, usus, babat, paru, otak, kikil), emping melinjo, teri, sarden, kerang, "
    "daging kambing, kaldu tulang pekat, alkohol/bir. SEDANG = daging sapi/ayam/bebek, ikan, udang, cumi, tahu, tempe, kacang, jamur. "
    "RENDAH = nasi, telur, susu, sayur, buah, singkong, kentang, tepung. "
    "Pedoman garam: TINGGI = ikan asin, kecap, terasi, bumbu kacang, kerupuk, kuah kaldu, makanan olahan/kalengan, mi instan, abon. "
    "Purin nabati (tahu, tempe, bayam) risikonya lebih kecil dari purin hewani."
)


def similar_rows(text, n=4):
    words = set(re.findall(r"[a-z]+", (text or "").lower()))
    scored = []
    for f in FOODS:
        names = " ".join([f["name"]] + f["aliases"] + f["pemicu"]).lower()
        score = sum(1 for w in words if len(w) > 3 and w in names)
        if score:
            scored.append((score, f))
    scored.sort(key=lambda x: -x[0])
    return [f for _, f in scored[:n]]


def analyze_food(name, bahan):
    """Gemma menilai makanan baru; hasilnya usulan yang dicek manusia sebelum disimpan."""
    refs = similar_rows(name + " " + bahan)
    content = ollama_chat([
        {"role": "system", "content": "\n".join([
            "Kamu ahli gizi rumahan Indonesia. Nilai makanan untuk penderita asam urat DAN darah tinggi.",
            PURIN_RULES,
            "Nilai berdasarkan bahan yang paling berisiko. Kalau ragu, pilih tingkat yang lebih tinggi (lebih aman).",
            "porsi_aman: konkret dan singkat. trik: 2-4 cara praktis mengurangi dampak, masing-masing maks 10 kata. "
            "pemicu: bahan penyebab risiko. alasan: 1-2 kalimat. Bahasa Indonesia.",
            "Contoh penilaian dari tabel (untuk kalibrasi):",
            *[json.dumps({k: f[k] for k in ("name", "purin", "garam", "porsi_aman", "pemicu")}, ensure_ascii=False) for f in refs],
        ])},
        {"role": "user", "content": f"Makanan: {name}\nBahan / cara masak: {bahan or '(tidak disebutkan)'}"},
    ], schema=ANALYZE_SCHEMA)
    out = json.loads(content)
    out["refs"] = [f["name"] for f in refs]
    return out


def identify(image_b64):
    content = ollama_chat([
        {"role": "system", "content": "\n".join([
            "Kamu mengenali makanan Indonesia dari foto. Kerjakan berurutan:",
            "0) nama: tulis apa yang kamu lihat dengan bahasa sendiri, termasuk merek kalau itu produk kemasan (mis. 'permen jelly Chupa Chups', 'Indomie goreng', 'ketoprak'). jenis: kategori umumnya.",
            "1) komponen: sebutkan SEMUA isi yang benar-benar terlihat (mis. lontong, tahu goreng, bihun, tauge, telur, kerupuk, bumbu kacang).",
            "2) berkuah: true HANYA jika makanan terendam kuah cair di mangkuk. Bumbu kacang kental di piring = false.",
            "3) food: pilih nama dari daftar HANYA jika benar-benar makanan yang sama. Jika tidak ada yang sama, pilih 'lainnya' — JANGAN memilih asal.",
            "Petunjuk yang sering tertukar: ketoprak = lontong/ketupat + tahu goreng + bihun + tauge + bumbu kacang + kerupuk, di piring, TANPA kuah. "
            "gado-gado = sayur rebus (kol, kentang, kacang panjang) + bumbu kacang. soto = kuah kuning/bening di mangkuk. "
            "pecel = sayur + sambal kacang + rempeyek.",
            "Jika tidak yakin, confidence 'kurang yakin' dan tulis tebakanmu di nama_lain.",
        ])},
        {"role": "user", "content": "Makanan apa ini?", "images": [image_b64]},
    ], schema=identify_schema(), timeout=300, vision=True, temperature=0.1)
    r = json.loads(content)
    guess, nama, komponen = r.get("food", "lainnya"), r.get("nama", ""), r.get("komponen", [])
    # nama bebas dari model dicocokkan ke tabel (tahan typo & merek: 'chupa chups' → permen)
    text_hits = [f["name"] for f in find_foods(nama)] or [f["name"] for f in find_foods(" ".join(komponen))]

    if guess in CIRI:
        final, overridden, alts = recheck(guess, komponen, r.get("berkuah", False))
    else:
        guess_food = next((f for f in all_foods() if f["name"] == guess), None)
        words = set(re.findall(r"[a-z]+", (nama + " " + " ".join(komponen)).lower()))
        guess_words = set(re.findall(r"[a-z]+", " ".join([guess] + (guess_food["aliases"] if guess_food else [])).lower()))
        related = guess != "lainnya" and (guess in text_hits or bool(words & guess_words - {"dan", "atau"}))
        if related:
            final, overridden = guess, False
        elif text_hits:
            final, overridden = text_hits[0], guess != text_hits[0]
        else:
            final, overridden = (nama.strip().lower() or guess), guess != "lainnya"
        alts = [n for n in text_hits if n != final][:3]
    in_table = any(f["name"] == final for f in all_foods())
    if overridden:
        print(f"identify: model pilih {guess!r}, lihat {nama!r} {komponen} → {final!r}")
    return {"food": final, "confidence": "kurang yakin" if overridden or not in_table else r.get("confidence", "kurang yakin"),
            "nama": nama, "komponen": komponen, "berkuah": r.get("berkuah"), "model_guess": guess,
            "corrected": overridden, "in_table": in_table, "alternatives": alts}


def build_prompt(food_text, note, food, status, flare, today):
    p = PROFILE
    lines = [
        f"Kamu adalah 'Teman Makan' untuk {p['nama']}, {p['usia']} tahun.",
        f"Kondisi: {', '.join(p['kondisi'])}. Catatan dokter: {p['catatan_dokter']}",
        f"Bahasa: Indonesia santai dan hangat, kalimat pendek, mudah dibaca orang {p['usia']} tahun. Panggil dia '{p['panggilan']}'.",
        "Aturan keras: jangan menyarankan obat atau dosis obat; jangan menakut-nakuti; jujur soal risiko; selalu praktis.",
        "Perhatikan DUA hal: purin (asam urat) DAN garam (darah tinggi). Sering kali garam yang lebih penting.",
        "",
        f"Makanan yang ditawarkan: {food_text}",
    ]
    if note:
        lines.append(f"Situasi: {note}")
    parts = food.get("components") if food else None
    if parts:
        salty = [f["name"] for f in parts if f["garam"] == "tinggi"]
        lines += [
            f"INI KOMBINASI {len(parts)} MAKANAN DIMAKAN BERSAMAAN: {', '.join(f['name'] for f in parts)}.",
            "Nilai sebagai SATU kali makan: risiko purin dan garam BERTAMBAH. Sebut semua makanannya.",
            "DATA TABEL tiap makanan (sumber utama, jangan bertentangan):",
            *[json.dumps({k: f[k] for k in ("name", "purin", "garam", "porsi_aman", "trik", "pemicu")}, ensure_ascii=False) for f in parts],
            f"Status lampu gabungan: {status}. Gunakan status ini persis.",
        ]
        if len(salty) >= 2:
            lines.append(f"PERINGATAN: {' dan '.join(salty)} sama-sama tinggi garam — dobel garam berbahaya untuk darah tinggi. "
                         "Sarankan pilih SALAH SATU saja, atau setengah porsi masing-masing dengan bumbu/kuah dikurangi.")
        lines.append("portion: jelaskan porsi untuk kombinasi (misal 'pilih salah satu' atau 'setengah X + seperempat Y').")
    elif food:
        lines += [
            "DATA TABEL (pakai ini sebagai sumber utama, jangan bertentangan):",
            json.dumps({k: v for k, v in food.items() if k != "matched"}, ensure_ascii=False),
            f"Status lampu dari tabel: {status}. Gunakan status ini persis.",
        ]
    else:
        lines.append("Makanan ini tidak ada di tabel. Nilai dengan hati-hati berdasarkan pengetahuan umum diet rendah purin & rendah garam; kalau ragu pilih 'kuning'.")
    if flare:
        lines.append(f"PENTING: asam urat {p['panggilan']} SEDANG KAMBUH sejak {flare['started'][:10]} (nyeri {flare['pain']}/10 di {flare['joint']}). Lebih ketat.")
    if today:
        lines.append("Yang sudah dimakan hari ini: " + ", ".join(f"{m['food']} ({m['status']})" for m in today))
    lines += [
        "",
        "Isi JSON:",
        "- headline: satu kalimat jawaban inti (maks 12 kata)",
        "- portion: porsi yang aman, konkret (misal 'setengah porsi, bumbu kacang 2 sendok')",
        "- tips: 3-4 cara meminimalkan dampak yang bisa dilakukan saat itu juga di warung/di rumah teman",
        f"- refusals: 3 kalimat yang DIUCAPKAN {p['nama'].upper()} KEPADA TEMANNYA (orang pertama 'saya', menyapa teman), sopan dan berterima kasih supaya teman tidak tersinggung. Urutan: (1) menolak halus, (2) cicip sedikit saja, (3) minta dibungkus.",
        "  Contoh gaya (jangan disalin persis): Halus: 'Wah makasih banyak, Bro. Saya lagi dijaga dokter soal asam urat, jadi saya temenin ngobrol aja ya.' / Cicip sedikit: 'Makasih ya, saya cicip setengah aja, bumbunya sedikit, biar tetap bisa nemenin.' / Bungkus: 'Boleh saya bungkus? Nanti saya makan pelan-pelan di rumah, sayang kalau nggak dihabiskan.'",
        "- if_forced: kalau tetap makan satu porsi penuh, apa yang mungkin terjadi pada asam urat dan tensi, dan apa yang harus dilakukan setelahnya. Jujur, maksimal 2 kalimat, jangan diulang-ulang.",
        "- why: penjelasan singkat kenapa (sebut purin dan/atau garam), maksimal 2 kalimat.",
        "Semua tips maksimal 12 kata. Jangan mengulang kalimat yang sama.",
        "- status: hijau / kuning / merah",
    ]
    return "\n".join(lines)


def fallback_assess(food_text, food, status):
    """Dipakai kalau Gemma tidak bisa dihubungi — tetap berguna, tapi sederhana."""
    if not food:
        return {"headline": "Belum ada data, makan sedikit dulu ya, Pa.", "portion": "Setengah porsi",
                "tips": ["Kuah/bumbu sedikit", "Minum 2 gelas air putih"], "refusals": [
                    {"label": "Halus", "text": "Makasih banyak, saya lagi jaga makan dari dokter, saya cicip sedikit aja ya."}],
                "if_forced": "Belum ada data untuk makanan ini.", "why": "Makanan tidak ada di tabel.", "status": "kuning"}
    return {
        "headline": f"{food['name'].title()}: {food['porsi_aman']}.",
        "portion": food["porsi_aman"],
        "tips": food["trik"],
        "refusals": [
            {"label": "Halus", "text": "Makasih banyak ya, saya lagi dijaga dokter soal asam urat sama tensi."},
            {"label": "Cicip sedikit", "text": "Saya cicip sedikit aja ya, biar tetap bisa nemenin makan."},
            {"label": "Bungkus", "text": "Boleh saya bungkus? Nanti saya makan pelan-pelan di rumah."},
        ],
        "if_forced": "Purin " + food["purin"] + ", garam " + food["garam"] + ". Kalau habis satu porsi, minum banyak air dan pantau sendi serta tensi besok.",
        "why": "; ".join(food["pemicu"]) or "Relatif aman.",
        "status": status,
    }


def assess(food_text, note=""):
    found = find_foods(food_text)
    food = combine(found)
    flare = active_flare()
    status = rule_status(food, flare is not None)
    today = meals_today()
    source = "gemma"
    try:
        content = ollama_chat([
            {"role": "system", "content": build_prompt(food_text, note, food, status, flare, today)},
            {"role": "user", "content": f"{PROFILE['panggilan']} ditawari {food_text}. Boleh gak?"},
        ], schema=ASSESS_SCHEMA)
        result = json.loads(content)
        labels = ["Halus", "Cicip sedikit", "Bungkus"]
        result["refusals"] = [{"label": labels[i] if i < 3 else "Lain", "text": t if isinstance(t, str) else t.get("text", "")}
                              for i, t in enumerate(result.get("refusals", []))]
    except Exception as exc:  # Ollama mati / model belum siap
        print("assess fallback:", exc)
        result, source = fallback_assess(food_text, food, status), "tabel"
    result["model"] = pick_model() if source == "gemma" else None
    if status:  # tabel menang atas AI untuk lampu
        result["status"] = status
    result.update({
        "food": food["name"] if food else food_text,
        "purin": food["purin"] if food else None,
        "garam": food["garam"] if food else None,
        "in_table": bool(food),
        "components": [{"name": f["name"], "purin": f["purin"], "garam": f["garam"],
                        "status": rule_status(f, flare is not None), "matched": f.get("matched")} for f in found],
        "flare_active": flare is not None,
        "source": source,
    })
    return result


# ---------------------------------------------------------------- review
GENERAL_RANGE = (3, 10)  # hari; serangan asam urat umumnya reda dalam ~1-2 minggu


def days_between(a, b):
    return (dt.datetime.fromisoformat(b) - dt.datetime.fromisoformat(a)).total_seconds() / 86400


def recovery_estimate():
    done = rows("SELECT * FROM flares WHERE ended IS NOT NULL")
    durations = [max(1, round(days_between(f["started"], f["ended"]))) for f in done]
    flare = active_flare()
    est = {"history_count": len(durations), "red_flags": []}
    if durations:
        med = statistics.median(durations)
        est.update(basis="riwayat Papa", typical_days=med,
                   range=[min(durations), max(durations)])
    else:
        est.update(basis="kisaran umum", typical_days=None, range=list(GENERAL_RANGE))
    if flare:
        day = days_between(flare["started"], now()) + 1
        pains = rows("SELECT pain, at FROM pain_logs WHERE flare_id=? ORDER BY at", flare["id"])
        trend = None
        if len(pains) >= 2:
            trend = "membaik" if pains[-1]["pain"] < pains[0]["pain"] else (
                "memburuk" if pains[-1]["pain"] > pains[0]["pain"] else "sama")
        hi = est["typical_days"] or GENERAL_RANGE[1]
        lo = est["range"][0]
        est.update(active=True, day=int(day), trend=trend,
                   current_pain=pains[-1]["pain"] if pains else flare["pain"],
                   remaining=[max(0, int(lo - day)), max(1, int(round(hi - day)))])
        if day > 7:
            est["red_flags"].append("Sudah lebih dari 7 hari — sebaiknya periksa ke dokter.")
        if (pains[-1]["pain"] if pains else flare["pain"]) >= 8:
            est["red_flags"].append("Nyeri sangat berat (8+/10) — hubungi dokter.")
        if flare["fever"]:
            est["red_flags"].append("Ada demam — bisa tanda infeksi sendi, segera ke dokter.")
        if trend == "memburuk":
            est["red_flags"].append("Nyeri makin berat — konsultasikan ke dokter.")
    else:
        est["active"] = False
    return est


def trigger_analysis():
    """Makanan apa yang muncul dalam 48 jam sebelum tiap kambuh?"""
    out = {}
    flares = rows("SELECT * FROM flares ORDER BY started")
    for f in flares:
        start = dt.datetime.fromisoformat(f["started"])
        since = (start - dt.timedelta(hours=48)).isoformat()
        for m in rows("SELECT food FROM meals WHERE at BETWEEN ? AND ?", since, f["started"]):
            for name in m["food"].split(" + "):
                out[name] = out.get(name, 0) + 1
    ranked = sorted(out.items(), key=lambda kv: -kv[1])
    return {"flares": len(flares), "suspects": [{"food": k, "count": v} for k, v in ranked[:5]]}


def review(with_ai=False):
    week_ago = (dt.datetime.now() - dt.timedelta(days=7)).isoformat()
    meals = rows("SELECT * FROM meals WHERE at >= ? ORDER BY at", week_ago)
    counts = {"hijau": 0, "kuning": 0, "merah": 0}
    salty = 0
    for m in meals:
        counts[m["status"]] = counts.get(m["status"], 0) + 1
        salty += m["garam"] == "tinggi"
    data = {
        "week": {"meals": len(meals), "status": counts, "garam_tinggi": salty},
        "triggers": trigger_analysis(),
        "recovery": recovery_estimate(),
    }
    if with_ai:
        try:
            data["summary"] = ollama_chat([
                {"role": "system", "content": f"Kamu teman makan {PROFILE['panggilan']} ({', '.join(PROFILE['kondisi'])}). Tulis ringkasan mingguan maksimal 4 kalimat, hangat, Bahasa Indonesia, berdasarkan data. Puji yang baik, satu saran paling penting untuk minggu depan. Jangan menyarankan obat."},
                {"role": "user", "content": json.dumps({**data, "makanan": [m["food"] for m in meals]}, ensure_ascii=False)},
            ])
        except Exception as exc:
            print("review ai failed:", exc)
            data["summary"] = None
    return data


# ---------------------------------------------------------------- http
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=PUBLIC, **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def end_headers(self):
        if self.path.endswith("sw.js"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            text, vision = pick_model(), pick_model(vision=True)
            return self.send_json({"ok": True, "model": text, "vision": bool(vision), "ai": bool(text), "profile": PROFILE})
        if path == "/api/foods":
            flare = active_flare() is not None
            return self.send_json([{**f, "status": rule_status(f, flare)} for f in all_foods()])
        if path == "/api/meals":
            return self.send_json(rows("SELECT * FROM meals ORDER BY at DESC LIMIT 100"))
        if path == "/api/flares":
            fl = rows("SELECT * FROM flares ORDER BY started DESC LIMIT 50")
            for f in fl:
                f["pains"] = rows("SELECT pain, at FROM pain_logs WHERE flare_id=? ORDER BY at", f["id"])
            return self.send_json(fl)
        if path == "/api/review":
            return self.send_json(review(with_ai="ai=1" in self.path))
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            b = self.body()
            if path == "/api/identify":
                img = b["image"].split(",")[-1]
                base64.b64decode(img[:64] + "==")  # validasi ringan
                return self.send_json(identify(img))
            if path == "/api/foods/analyze":
                name = (b.get("name") or "").strip()
                if not name:
                    return self.send_json({"error": "Nama makanan kosong"}, 400)
                return self.send_json(analyze_food(name, (b.get("bahan") or "").strip()))
            if path == "/api/foods":
                name = (b.get("name") or "").strip().lower()
                if not name or b.get("purin") not in LEVEL or b.get("garam") not in LEVEL:
                    return self.send_json({"error": "Nama, purin, dan garam wajib diisi"}, 400)
                aliases = [a.strip().lower() for a in b.get("aliases", []) if a.strip()]
                with db() as con:
                    con.execute("""INSERT INTO custom_foods (created, name, aliases, kategori, bahan, purin, garam, porsi_aman, trik, pemicu, alasan)
                                   VALUES (?,?,?,?,?,?,?,?,?,?,?)
                                   ON CONFLICT(name) DO UPDATE SET aliases=excluded.aliases, kategori=excluded.kategori, bahan=excluded.bahan,
                                   purin=excluded.purin, garam=excluded.garam, porsi_aman=excluded.porsi_aman, trik=excluded.trik,
                                   pemicu=excluded.pemicu, alasan=excluded.alasan""",
                                (now(), name, json.dumps(aliases), b.get("kategori") or "Buatan keluarga", b.get("bahan", ""),
                                 b["purin"], b["garam"], b.get("porsi_aman", ""), json.dumps(b.get("trik", []), ensure_ascii=False),
                                 json.dumps(b.get("pemicu", []), ensure_ascii=False), b.get("alasan", "")))
                return self.send_json({"ok": True})
            m = re.match(r"^/api/foods/(\d+)/delete$", path)
            if m:
                with db() as con:
                    con.execute("DELETE FROM custom_foods WHERE id=?", (int(m.group(1)),))
                return self.send_json({"ok": True})
            if path == "/api/assess":
                return self.send_json(assess(b.get("food", ""), b.get("note", "")))
            if path == "/api/meals":
                food = combine(find_foods(b["food"]))
                with db() as con:
                    con.execute("INSERT INTO meals (at, food, portion, status, purin, garam, note) VALUES (?,?,?,?,?,?,?)",
                                (b.get("at") or now(), food["name"] if food else b["food"], b.get("portion", ""),
                                 b.get("status", "kuning"), food and food["purin"], food and food["garam"], b.get("note", "")))
                return self.send_json({"ok": True})
            if path == "/api/flares":
                if active_flare():
                    return self.send_json({"error": "Masih ada catatan kambuh yang aktif."}, 400)
                with db() as con:
                    cur = con.execute("INSERT INTO flares (started, joint, pain, fever, note) VALUES (?,?,?,?,?)",
                                      (b.get("started") or now(), b.get("joint", "jempol kaki"), int(b.get("pain", 5)),
                                       int(bool(b.get("fever"))), b.get("note", "")))
                    con.execute("INSERT INTO pain_logs (flare_id, at, pain) VALUES (?,?,?)",
                                (cur.lastrowid, b.get("started") or now(), int(b.get("pain", 5))))
                return self.send_json({"ok": True})
            m = re.match(r"^/api/flares/(\d+)/(pain|end)$", path)
            if m:
                fid, action = int(m.group(1)), m.group(2)
                with db() as con:
                    if action == "pain":
                        con.execute("INSERT INTO pain_logs (flare_id, at, pain) VALUES (?,?,?)", (fid, now(), int(b["pain"])))
                        if b.get("fever"):
                            con.execute("UPDATE flares SET fever=1 WHERE id=?", (fid,))
                    else:
                        con.execute("UPDATE flares SET ended=? WHERE id=?", (b.get("ended") or now(), fid))
                return self.send_json({"ok": True})
            return self.send_json({"error": "not found"}, 404)
        except (urllib.error.URLError, RuntimeError) as exc:
            return self.send_json({"error": f"AI lokal belum siap: {exc}"}, 503)
        except Exception as exc:
            print("error:", repr(exc))
            return self.send_json({"error": str(exc)}, 500)


if __name__ == "__main__":
    init_db()
    print(f"Boleh Gak, Pa? → http://localhost:{PORT}  (model: {pick_model() or 'belum ada'}, ollama {OLLAMA})")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
