#!/usr/bin/env python3
"""
Bangun tabel BAHAN DASAR (per 100 g) → src/lib/foods/ingredients.json

Sumber angka (bukan tebakan):
  - USDA FoodData Central, SR Legacy 2018-04 (domain publik): karbohidrat, gula total, natrium, lemak jenuh.
    Unduh: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
  - Open Food Facts (ODbL): bahan khas Indonesia yang tidak ada di USDA → median dari beberapa label kemasan.
  - Purin: kelompok menurut ACR 2020 & Choi 2004 (sama dengan tabel makanan utama; USDA tidak mencatat purin).
  - Indeks glikemik: Atkinson et al. 2021 (nilai kelompok), hanya untuk bahan sumber karbohidrat.

"gula" yang disimpan = GULA BEBAS (definisi WHO): gula total untuk bahan yang gulanya ditambahkan,
0 untuk buah utuh, susu tawar, sayur, dan bahan pokok tanpa gula tambahan.

Pakai:  python3 tools/build_ingredients.py /path/ke/FoodData_Central_sr_legacy_food_csv_2018-04
"""
import csv, json, statistics, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/lib/foods/ingredients.json"
UA = "BolehGakYa/0.1 (https://github.com/malikp66/boleh-gak-pa)"

R, S, T = "rendah", "sedang", "tinggi"
TOTAL, NONE = "total", "none"  # cara menghitung gula bebas

# id, label, kategori, USDA (semua potongan teks harus ada di deskripsi; fdc id juga boleh), purin, gula, ig, alergen
USDA = [
  # ---- karbohidrat pokok
  ("nasi_putih", "nasi putih", "pokok", ["Rice, white, long-grain, regular, enriched, cooked"], R, NONE, 73, []),
  ("nasi_merah", "nasi merah", "pokok", ["Rice, brown, long-grain, cooked"], R, NONE, 68, []),
  ("ketan", "nasi ketan / lemper", "pokok", ["Rice, white, glutinous, unenriched, cooked"], R, NONE, 87, []),
  ("lontong", "lontong / ketupat", "pokok", ["Rice, white, long-grain, regular, enriched, cooked"], R, NONE, 73, []),
  ("mi_telur", "mi telur matang", "pokok", ["Noodles, egg, enriched, cooked"], R, NONE, 57, ["gluten", "telur"]),
  ("mi_instan", "mi instan kering (tanpa bumbu)", "pokok", ["Soup, ramen noodle, any flavor, dry"], R, NONE, 47, ["gluten"]),
  ("bihun", "bihun / kwetiau matang", "pokok", ["Rice noodles, cooked"], R, NONE, 53, []),
  ("soun", "soun kering", "pokok", ["Noodles, chinese, cellophane or long rice (mung beans), dehydrated"], R, NONE, 39, []),
  ("pasta", "pasta / spageti matang", "pokok", ["Pasta, cooked, enriched, without added salt"], R, NONE, 49, ["gluten"]),
  ("roti_tawar", "roti tawar putih", "pokok", ["Bread, white, commercially prepared (includes soft bread crumbs)"], R, TOTAL, 75, ["gluten"]),
  ("roti_gandum", "roti gandum", "pokok", ["Bread, whole-wheat, commercially prepared"], R, TOTAL, 74, ["gluten"]),
  ("croissant", "adonan croissant / pastry mentega", "kue", ["Croissants, butter"], R, TOTAL, 67, ["gluten", "susu", "telur"]),
  ("donat", "donat", "kue", ["Doughnuts, yeast-leavened, glazed, enriched"], R, TOTAL, 76, ["gluten", "susu", "telur"]),
  ("bolu", "bolu / cake", "kue", ["Cake, sponge, commercially prepared"], R, TOTAL, 69, ["gluten", "susu", "telur"]),
  ("terigu", "tepung terigu", "pokok", ["Wheat flour, white, all-purpose, enriched, bleached"], R, NONE, 70, ["gluten"]),
  ("tepung_beras", "tepung beras", "pokok", ["Rice flour, white, unenriched"], R, NONE, 75, []),
  ("tapioka", "tepung tapioka / aci / boba", "pokok", ["Tapioca, pearl, dry"], R, NONE, 70, []),
  ("singkong", "singkong", "pokok", ["Cassava, raw"], R, NONE, 46, []),
  ("ubi", "ubi jalar rebus", "pokok", ["Sweet potato, cooked, boiled, without skin"], R, NONE, 63, []),
  ("kentang", "kentang rebus", "pokok", ["Potatoes, boiled, cooked without skin, flesh, without salt"], R, NONE, 78, []),
  ("kentang_goreng", "kentang goreng", "pokok", ["Potatoes, french fried, all types, salt added in processing, frozen, home-prepared, oven heated"], R, NONE, 63, []),
  ("jagung", "jagung manis", "pokok", ["Corn, sweet, yellow, cooked, boiled, drained, without salt"], R, NONE, 52, []),
  ("oat", "oat kering", "pokok", ["Cereals, oats, regular and quick, not fortified, dry"], R, NONE, 55, ["gluten"]),
  ("biskuit", "biskuit / kue kering", "kue", ["Cookies, butter, commercially prepared, enriched"], R, TOTAL, 60, ["gluten", "susu", "telur"]),
  ("krekers", "krekers asin", "kue", ["Crackers, saltines (includes oyster, soda, soup)"], R, TOTAL, 74, ["gluten"]),
  # ---- lauk hewani
  ("ayam_dada", "ayam bagian dada", "lauk", ["Chicken, broilers or fryers, breast, meat only, cooked, roasted"], S, NONE, None, []),
  ("ayam_paha", "ayam paha dengan kulit", "lauk", ["Chicken, broilers or fryers, thigh, meat and skin, cooked, roasted"], S, NONE, None, []),
  ("ayam_goreng", "ayam goreng tepung", "lauk", ["Chicken, broilers or fryers, thigh, meat and skin, cooked, fried, batter"], S, NONE, None, ["gluten", "telur"]),
  ("kulit_ayam", "kulit ayam", "lauk", ["Chicken, broilers or fryers, skin only, cooked, roasted"], S, NONE, None, []),
  ("ceker", "ceker ayam", "lauk", ["Chicken, feet, boiled"], S, NONE, None, []),
  ("hati_ayam", "hati ayam / ampela", "jeroan", ["Chicken, liver, all classes, cooked, simmered"], T, NONE, None, []),
  ("daging_sapi", "daging sapi", "lauk", ["Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned"], S, NONE, None, []),
  ("hati_sapi", "hati sapi", "jeroan", ["Beef, variety meats and by-products, liver, cooked, braised"], T, NONE, None, []),
  ("babat", "babat / usus sapi", "jeroan", ["Beef, variety meats and by-products, tripe, cooked, simmered"], T, NONE, None, []),
  ("kambing", "daging kambing", "lauk", ["Game meat, goat, cooked, roasted"], T, NONE, None, []),
  ("bebek", "daging bebek", "lauk", ["Duck, domesticated, meat and skin, cooked, roasted"], S, NONE, None, []),
  ("telur", "telur ayam", "lauk", ["Egg, whole, cooked, hard-boiled"], R, NONE, None, ["telur"]),
  ("telur_puyuh", "telur puyuh", "lauk", ["Egg, quail, whole, fresh, raw"], R, NONE, None, ["telur"]),
  ("ikan_nila", "ikan nila / mujair", "lauk", ["Fish, tilapia, cooked, dry heat"], S, NONE, None, ["ikan"]),
  ("lele", "ikan lele", "lauk", ["Fish, catfish, channel, cooked, breaded and fried"], S, NONE, None, ["ikan", "gluten"]),
  ("tuna", "tongkol / tuna", "lauk", ["Fish, tuna, fresh, yellowfin, raw"], S, NONE, None, ["ikan"]),
  ("teri", "ikan teri", "lauk", ["Fish, anchovy, european, canned in oil, drained solids"], T, NONE, None, ["ikan"]),
  ("sarden", "sarden kaleng", "lauk", ["Fish, sardine, Pacific, canned in tomato sauce, drained solids with bone"], T, NONE, None, ["ikan"]),
  ("ikan_asin", "ikan asin", "lauk", ["Fish, cod, Atlantic, dried and salted"], T, NONE, None, ["ikan"]),
  ("udang", "udang", "lauk", ["Crustaceans, shrimp, cooked"], S, NONE, None, ["krustasea"]),
  ("cumi", "cumi", "lauk", ["Mollusks, squid, mixed species, raw"], S, NONE, None, ["moluska"]),
  ("kerang", "kerang", "lauk", ["Mollusks, clam, mixed species, cooked, moist heat"], T, NONE, None, ["moluska"]),
  ("kepiting", "kepiting / rajungan", "lauk", ["Crustaceans, crab, blue, cooked, moist heat"], S, NONE, None, ["krustasea"]),
  ("sosis", "sosis", "lauk", ["Sausage, pork and beef, fresh, cooked"], S, TOTAL, None, []),
  ("kornet", "kornet", "lauk", ["Beef, cured, corned beef, canned"], S, NONE, None, []),
  ("nugget", "nugget ayam", "lauk", ["Chicken, nuggets, dark and white meat, precooked, frozen, not reheated"], S, NONE, None, ["gluten", "telur"]),
  # ---- lauk nabati & kacang
  ("tahu", "tahu", "lauk", ["Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)"], S, NONE, None, ["kedelai"]),
  ("tahu_goreng", "tahu goreng", "lauk", ["Tofu, fried"], S, NONE, None, ["kedelai"]),
  ("tempe", "tempe", "lauk", ["Tempeh"], S, NONE, None, ["kedelai"]),
  ("kacang_tanah", "kacang tanah", "kacang", ["Peanuts, all types, oil-roasted, with salt"], S, NONE, None, ["kacang tanah"]),
  ("selai_kacang", "selai kacang", "kacang", ["Peanut butter, smooth style, with salt"], S, TOTAL, None, ["kacang tanah"]),
  ("mete", "kacang mete", "kacang", ["Nuts, cashew nuts, oil roasted, with salt added"], S, NONE, None, ["kacang pohon"]),
  ("almond", "almond", "kacang", ["Nuts, almonds"], R, NONE, None, ["kacang pohon"]),
  ("kacang_hijau", "kacang hijau rebus", "kacang", ["Mung beans, mature seeds, cooked, boiled, without salt"], S, NONE, 31, []),
  ("kacang_merah", "kacang merah rebus", "kacang", ["Beans, kidney, all types, mature seeds, cooked, boiled, without salt"], S, NONE, 24, []),
  ("jamur", "jamur", "sayur", ["Mushrooms, white, cooked, boiled, drained, without salt"], S, NONE, None, []),
  # ---- susu & lemak
  ("susu", "susu sapi full cream", "susu", ["Milk, whole, 3.25% milkfat, with added vitamin D"], R, NONE, 39, ["susu"]),
  ("skm", "susu kental manis", "susu", ["Milk, canned, condensed, sweetened"], R, TOTAL, 61, ["susu"]),
  ("keju", "keju cheddar", "susu", ["Cheese, cheddar"], R, NONE, None, ["susu"]),
  ("keju_olahan", "keju olahan / slice", "susu", ["Cheese, pasteurized process, American, fortified with vitamin D"], R, NONE, None, ["susu"]),
  ("yogurt", "yogurt tawar", "susu", ["Yogurt, plain, whole milk"], R, NONE, 41, ["susu"]),
  ("es_krim", "es krim", "susu", ["Ice creams, vanilla"], R, TOTAL, 51, ["susu"]),
  ("krim", "krim kental", "susu", ["Cream, fluid, heavy whipping"], R, NONE, None, ["susu"]),
  ("mentega", "mentega", "lemak", ["Butter, salted"], R, NONE, None, ["susu"]),
  ("margarin", "margarin", "lemak", ["Margarine, regular, 80% fat, composite, stick, with salt"], R, NONE, None, []),
  ("minyak", "minyak goreng sawit", "lemak", ["Oil, palm"], R, NONE, None, []),
  ("minyak_kelapa", "minyak kelapa", "lemak", ["Oil, coconut"], R, NONE, None, []),
  ("santan", "santan", "lemak", ["Nuts, coconut milk, raw (liquid expressed from grated meat and water)"], R, NONE, None, []),
  ("kelapa", "kelapa parut", "lemak", ["Nuts, coconut meat, raw"], R, NONE, None, []),
  ("mayones", "mayones", "lemak", ["Salad dressing, mayonnaise, regular"], R, TOTAL, None, ["telur"]),
  # ---- gula, cokelat, bumbu
  ("gula", "gula pasir", "gula", ["Sugars, granulated"], R, TOTAL, 65, []),
  ("gula_merah", "gula merah / aren", "gula", ["Sugars, brown"], R, TOTAL, 54, []),
  ("madu", "madu", "gula", ["Honey"], R, TOTAL, 61, []),
  ("sirup", "sirup (cocopandan, merah)", "gula", ["Syrups, grenadine"], R, TOTAL, 68, []),
  ("selai", "selai buah", "gula", ["Jams and preserves"], R, TOTAL, 51, []),
  ("cokelat_susu", "cokelat susu / meses", "gula", ["Candies, milk chocolate"], R, TOTAL, 40, ["susu"]),
  ("cokelat_hitam", "cokelat hitam", "gula", ["Chocolate, dark, 70-85% cacao solids"], R, TOTAL, 23, []),
  ("kakao", "bubuk kakao tanpa gula", "gula", ["Cocoa, dry powder, unsweetened"], R, NONE, None, []),
  ("kecap_asin", "kecap asin", "bumbu", ["Soy sauce made from soy and wheat (shoyu)"], R, NONE, None, ["kedelai", "gluten"]),
  ("saus_tomat", "saus tomat", "bumbu", ["Catsup"], R, TOTAL, None, []),
  ("garam", "garam dapur", "bumbu", ["Salt, table"], R, NONE, None, []),
  ("kaldu_blok", "kaldu blok / bubuk", "bumbu", ["Soup, chicken broth or bouillon, dry"], S, NONE, None, []),
  ("cabai", "cabai", "bumbu", ["Peppers, hot chili, red, raw"], R, NONE, None, []),
  ("bawang_merah", "bawang merah", "bumbu", ["Shallots, raw"], R, NONE, None, []),
  ("bawang_putih", "bawang putih", "bumbu", ["Garlic, raw"], R, NONE, None, []),
  ("tomat", "tomat", "sayur", ["Tomatoes, red, ripe, raw, year round average"], R, NONE, None, []),
  # ---- sayur
  ("kangkung", "kangkung", "sayur", ["Water convolvulus, cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("bayam", "bayam", "sayur", ["Spinach, cooked, boiled, drained, without salt"], S, NONE, None, []),
  ("sawi", "sawi / pakcoy", "sayur", ["Cabbage, chinese (pak-choi), cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("kol", "kol / kubis", "sayur", ["Cabbage, cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("wortel", "wortel", "sayur", ["Carrots, cooked, boiled, drained, without salt"], R, NONE, 39, []),
  ("tauge", "tauge", "sayur", ["Mung beans, mature seeds, sprouted, raw"], R, NONE, None, []),
  ("timun", "timun", "sayur", ["Cucumber, with peel, raw"], R, NONE, None, []),
  ("terong", "terong", "sayur", ["Eggplant, cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("labu_siam", "labu siam", "sayur", ["Chayote, fruit, cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("buncis", "buncis / kacang panjang", "sayur", ["Beans, snap, green, cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("brokoli", "brokoli", "sayur", ["Broccoli, cooked, boiled, drained, without salt"], R, NONE, None, []),
  ("selada", "selada / lalapan", "sayur", ["Lettuce, green leaf, raw"], R, NONE, None, []),
  # ---- buah
  ("pisang", "pisang", "buah", ["Bananas, raw"], R, NONE, 51, []),
  ("apel", "apel", "buah", ["Apples, raw, with skin"], R, NONE, 36, []),
  ("jeruk", "jeruk", "buah", ["Oranges, raw, all commercial varieties"], R, NONE, 43, []),
  ("mangga", "mangga", "buah", ["Mangos, raw"], R, NONE, 51, []),
  ("pepaya", "pepaya", "buah", ["Papayas, raw"], R, NONE, 60, []),
  ("semangka", "semangka", "buah", ["Watermelon, raw"], R, NONE, 76, []),
  ("nanas", "nanas", "buah", ["Pineapple, raw, all varieties"], R, NONE, 59, []),
  ("alpukat", "alpukat", "buah", ["Avocados, raw, all commercial varieties"], R, NONE, None, []),
  ("durian", "durian", "buah", ["Durian, raw or frozen"], R, NONE, 49, []),
  ("nangka", "nangka", "buah", ["Jackfruit, raw"], R, NONE, 75, []),
  ("anggur", "anggur", "buah", ["Grapes, red or green (European type, such as Thompson seedless), raw"], R, NONE, 59, []),
  ("jambu", "jambu biji", "buah", ["Guavas, common, raw"], R, NONE, None, []),
  ("melon", "melon", "buah", ["Melons, cantaloupe, raw"], R, NONE, 65, []),
  ("stroberi", "stroberi", "buah", ["Strawberries, raw"], R, NONE, 40, []),
  ("kurma", "kurma", "buah", ["Dates, deglet noor"], R, NONE, 42, []),
  # ---- minuman
  ("teh", "teh seduh tawar", "minuman", ["Beverages, tea, black, brewed, prepared with tap water"], R, NONE, None, []),
  ("kopi", "kopi seduh tawar", "minuman", ["Beverages, coffee, brewed, prepared with tap water"], R, NONE, None, []),
  ("soda", "minuman bersoda", "minuman", ["Beverages, carbonated, cola, regular"], R, TOTAL, 63, []),
  ("jus_jeruk", "jus jeruk kemasan", "minuman", ["Orange juice, chilled, includes from concentrate"], R, TOTAL, 50, []),
  ("susu_cokelat", "susu cokelat", "minuman", ["Milk, chocolate, fluid, commercial, whole"], R, TOTAL, 43, ["susu"]),
  ("bir", "bir", "minuman", ["Alcoholic beverage, beer, regular, all"], T, NONE, None, ["gluten"]),
  # ---- camilan
  ("keripik_kentang", "keripik kentang", "camilan", ["Snacks, potato chips, plain, salted"], R, NONE, 56, []),
  ("popcorn", "popcorn", "camilan", ["Snacks, popcorn, oil-popped, microwave, regular flavor, no trans fat"], R, NONE, 65, []),
]

# Bahan khas Indonesia yang tidak ada di USDA → median label kemasan di Open Food Facts.
OFF = [
  # id, label, kategori, kata kunci pencarian, kata wajib di nama produk, purin, gula, ig, alergen
  ("kecap_manis", "kecap manis", "bumbu", "kecap manis", ["kecap"], R, TOTAL, None, ["kedelai"]),
  ("sambal", "sambal ulek", "bumbu", "sambal oelek", ["sambal"], R, TOTAL, None, []),
  ("kerupuk", "kerupuk udang / ikan", "camilan", "prawn crackers", ["cracker"], S, NONE, 70, ["krustasea"]),
  ("emping", "emping melinjo", "camilan", "kerupuk udang", ["emping melindjo"], T, NONE, None, []),
  ("mi_instan_goreng", "mi instan goreng + bumbu (per 100 g)", "pokok", "indomie goreng", ["indomie"], R, TOTAL, 47, ["gluten", "kedelai"]),
]

# Nilai TKPI (Kemenkes) untuk bahan yang tidak ada di USDA maupun Open Food Facts: per 100 g,
# {"karbo", "gula", "natrium", "lemak_jenuh", "sumber", "ref"}. Isi HANYA dari panganku.org yang sudah dicek.
TKPI: dict[str, dict] = {}

NUTR = {"1005": "karbo", "2000": "gula_total", "1093": "natrium", "1258": "lemak_jenuh"}


def load_usda(folder: Path):
    foods = {r["fdc_id"]: r["description"] for r in csv.DictReader(open(folder / "food.csv"))}
    vals: dict[str, dict] = {}
    with open(folder / "food_nutrient.csv") as f:
        for r in csv.DictReader(f):
            k = NUTR.get(r["nutrient_id"])
            if k:
                vals.setdefault(r["fdc_id"], {})[k] = float(r["amount"] or 0)
    return foods, vals


def pick(foods, query: str):
    exact = [i for i, d in foods.items() if d.lower() == query.lower()]
    if exact:
        return exact[0]
    part = sorted((i for i, d in foods.items() if d.lower().startswith(query.lower())), key=lambda i: len(foods[i]))
    return part[0] if part else None


def off_median(query: str, must: list[str]):
    url = "https://search.openfoodfacts.org/search?" + urllib.parse.urlencode({
        "q": query, "page_size": 40, "fields": "code,product_name,countries_tags,nutriments",
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    rows = []
    for p in data.get("hits", []):
        name = (p.get("product_name") or "").lower()
        n = p.get("nutriments") or {}
        if not all(m in name for m in must):
            continue
        need = ["carbohydrates_100g", "sugars_100g", "saturated-fat_100g"]
        if not all(isinstance(n.get(k), (int, float)) for k in need):
            continue
        sodium = n.get("sodium_100g")
        if not isinstance(sodium, (int, float)):
            salt = n.get("salt_100g")
            if not isinstance(salt, (int, float)):
                continue
            sodium = salt / 2.5
        rows.append({"code": p["code"], "karbo": n["carbohydrates_100g"], "gula_total": n["sugars_100g"],
                     "natrium": sodium * 1000, "lemak_jenuh": n["saturated-fat_100g"]})
    if len(rows) < 1:
        raise SystemExit(f"Open Food Facts: data '{query}' kurang ({len(rows)} produk)")
    med = {k: round(statistics.median(r[k] for r in rows), 2) for k in ["karbo", "gula_total", "natrium", "lemak_jenuh"]}
    return med, [r["code"] for r in rows][:10]


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    foods, vals = load_usda(Path(sys.argv[1]))
    out = []
    for iid, label, kat, (query,), purin, gula_mode, ig, alergen in USDA:
        if iid in TKPI:
            t = TKPI[iid]
            out.append({"id": iid, "label": label, "kategori": kat, "karbo": t["karbo"], "gula": t["gula"], "natrium": t["natrium"],
                        "lemak_jenuh": t["lemak_jenuh"], "purin": purin, "ig": ig, "alergen": alergen, "sumber": t["sumber"], "ref": t["ref"]})
            continue
        fid = pick(foods, query)
        if not fid:
            raise SystemExit(f"USDA tidak menemukan: {iid} → {query}")
        v = vals.get(fid, {})
        if gula_mode == TOTAL and "gula_total" not in v:
            raise SystemExit(f"USDA tidak punya data gula untuk {iid} → {foods[fid]}")
        gula = v["gula_total"] if gula_mode == TOTAL else 0.0
        out.append({"id": iid, "label": label, "kategori": kat, "karbo": round(v.get("karbo", 0), 2), "gula": round(gula, 2),
                    "natrium": round(v.get("natrium", 0), 1), "lemak_jenuh": round(v.get("lemak_jenuh", 0), 2),
                    "purin": purin, "ig": ig, "alergen": alergen, "sumber": "USDA SR Legacy", "ref": f"FDC {fid}: {foods[fid]}"})
    for iid, label, kat, query, must, purin, gula_mode, ig, alergen in OFF:
        med, codes = off_median(query, must)
        time.sleep(7)  # batas Open Food Facts: 10 pencarian per menit
        out.append({"id": iid, "label": label, "kategori": kat, "karbo": med["karbo"],
                    "gula": med["gula_total"] if gula_mode == TOTAL else 0.0, "natrium": round(med["natrium"], 1),
                    "lemak_jenuh": med["lemak_jenuh"], "purin": purin, "ig": ig, "alergen": alergen,
                    "sumber": f"Open Food Facts (median {len(codes)} label)", "ref": "kode: " + ", ".join(codes)})
    ids = [i["id"] for i in out]
    assert len(ids) == len(set(ids)), "id ganda"
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(out)} bahan → {OUT.relative_to(ROOT)}")
    for i in out:
        print(f"  {i['id']:<16} karbo {i['karbo']:>6} gula {i['gula']:>6} Na {i['natrium']:>7} jenuh {i['lemak_jenuh']:>6}  {i['ref'][:70]}")


if __name__ == "__main__":
    main()
