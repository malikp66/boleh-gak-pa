"""Sumber tabel makanan. Edit baris di bawah (dan tools/nutrition.py), lalu jalankan: python3 tools/build_foods.py

Format: nama | alias;alias | kategori | purin | garam | porsi aman | trik;trik | pemicu;pemicu
purin/garam: r = rendah, s = sedang, t = tinggi
Ringkasan panduan umum diet rendah purin & rendah garam, bukan data laboratorium.
"""
import json, os

L = {"r": "rendah", "s": "sedang", "t": "tinggi"}

ROWS = """
# ---------------- Jajanan kaki lima
ketoprak | katoprak | Kaki lima | s | t | setengah porsi, bumbu kacang sedikit | minta bumbu kacang dipisah;kecap tidak usah ditambah;kerupuk 1-2 keping;minum 2 gelas air putih | bumbu kacang + kecap tinggi garam;tahu (purin nabati, risiko lebih kecil);kerupuk asin
gado-gado | gado gado | Kaki lima | s | t | 1 porsi, bumbu setengah | minta tanpa emping;bumbu dipisah;perbanyak sayur | bumbu kacang tinggi garam;emping kalau ada
lotek | karedok | Kaki lima | r | s | 1 porsi, bumbu secukupnya | bumbu kacang sedikit;tanpa kerupuk tambahan | bumbu kacang
pecel | nasi pecel;pecel sayur | Kaki lima | r | s | 1 porsi, sambal secukupnya | hindari rempeyek teri;sambal kacang sedikit | sambal kacang;rempeyek teri
siomay | siomai | Kaki lima | s | t | 1 porsi, bumbu sedikit | bumbu kacang sedikit;perbanyak kol dan kentang | ikan olahan;bumbu kacang
batagor | | Kaki lima | s | t | setengah porsi | bumbu sedikit;jangan tambah kecap | gorengan ikan;bumbu kacang
tahu gejrot | | Kaki lima | s | s | 1 porsi | kuah secukupnya | tahu;kuah gula merah asin
kerak telor | | Kaki lima | r | s | 1 porsi | serundeng secukupnya | ebi (udang kering) sedikit
cilok | cimol;cireng | Kaki lima | r | s | 1 porsi kecil | saus kacang sedikit | tepung + saus asin
seblak | | Kaki lima | s | t | setengah porsi | pilih kerupuk & telur;tanpa ceker dan sosis | bumbu kencur asin;olahan daging
cakwe | | Kaki lima | r | s | 2-3 potong | saus secukupnya | gorengan
otak-otak | | Kaki lima | s | t | 3-4 buah | saus kacang sedikit | ikan olahan;saus
pempek | empek-empek | Kaki lima | s | s | 2-3 buah kecil | cuko secukupnya | ikan;cuko manis
kue cubit | | Kaki lima | r | r | 4-5 buah | jangan topping manis berlebihan | gula
telur gulung | | Kaki lima | r | s | 2-3 tusuk | saus sedikit | saus botol asin
sosis bakar | sosis | Kaki lima | s | t | 1 tusuk | jarang-jarang saja | daging olahan tinggi garam
bakso bakar | | Kaki lima | s | t | 2 tusuk | saus sedikit | bakso + saus kecap
# ---------------- Nasi & lauk
nasi putih | nasi;nasi merah;nasi hangat | Nasi & lauk | r | r | 1 centong (porsi biasa) | aman, batasi kalau ada diabetes | -
nasi goreng | nasgor | Nasi & lauk | s | t | 1 porsi biasa | pilih telur/ayam;tanpa seafood dan ati;tambah acar timun | kecap, garam, terasi;topping seafood/ati
bubur ayam | bubur;bubur cirebon;bubur ayam cianjur | Nasi & lauk | s | t | 1 mangkuk | tanpa sate usus/ati;kecap asin sedikit;kerupuk secukupnya | kecap asin, kerupuk;ati ampela / usus
nasi uduk | nasi lemak | Nasi & lauk | r | s | 1 porsi | lauk telur/tempe | santan;gorengan
nasi kuning | tumpeng | Nasi & lauk | r | s | 1 porsi | hindari sambal goreng ati;lauk telur/ayam | santan;lauk jeroan kalau ada
nasi liwet | | Nasi & lauk | r | t | 1 porsi | ikan asin/teri sedikit saja | teri dan ikan asin
nasi padang rendang | rendang;nasi padang | Nasi & lauk | t | t | 1 potong kecil | pilih ayam pop/sayur;kuah gulai sedikit | daging merah;santan;kuah gulai
ayam pop | | Nasi & lauk | s | s | 1 potong | buang kulit | ayam
dendeng balado | dendeng | Nasi & lauk | t | t | 1-2 lembar | jarang-jarang | daging merah kering + garam
nasi campur | nasi rames | Nasi & lauk | s | s | 1 porsi | pilih sayur, telur, tempe | tergantung lauk
nasi kucing | angkringan | Nasi & lauk | r | t | 2 bungkus | hindari sate usus/ati;sambal teri sedikit | sambal teri;sate jeroan
nasi bebek | bebek goreng | Nasi & lauk | s | s | 1 potong | buang kulit;sambal secukupnya | daging bebek;kulit berlemak
nasi kebuli | nasi biryani | Nasi & lauk | t | s | setengah porsi | daging kambing sedikit | daging kambing;kaldu
lontong sayur | | Nasi & lauk | r | s | 1 porsi | kuah santan secukupnya | santan;sambal goreng ati kalau ada
ketupat sayur | opor;opor ayam | Nasi & lauk | s | s | 1 porsi | hindari sambal goreng ati;kuah sedikit | santan;ayam
sambal goreng ati | | Nasi & lauk | t | t | sebaiknya dihindari | ganti telur pindang | ati dan ampela tinggi purin
semur daging | semur | Nasi & lauk | t | t | 1 potong kecil | kuah kecap sedikit | daging merah;kecap
empal | empal gentong | Nasi & lauk | t | s | 1 potong kecil | pilih yang tanpa jeroan | daging sapi
telur | telur balado;telur dadar;telur ceplok;telur rebus;telur mata sapi;telur goreng;telur orak-arik | Nasi & lauk | r | r | 1-2 butir | lauk aman untuk asam urat;dadar/balado jangan terlalu asin | -
telur asin | | Nasi & lauk | r | t | setengah butir | jangan setiap hari | garam sangat tinggi
pindang telur | telur pindang | Nasi & lauk | r | s | 1 butir | aman | kecap
ayam goreng | ayam;ayam bakar;ayam penyet;pecel ayam;ayam geprek | Nasi & lauk | s | s | 1 potong | buang kulit;pilih dada/paha tanpa kulit | kulit ayam;sambal & kecap
ayam taliwang | | Nasi & lauk | s | s | 1 potong | sambal secukupnya | ayam
tahu goreng | tahu;tahu isi;tahu bacem | Nasi & lauk | s | r | 2-3 potong | bacem tinggi gula, secukupnya | purin nabati (risiko lebih kecil)
tempe goreng | tempe;mendoan;tempe orek;tempe bacem | Nasi & lauk | s | r | 2-3 potong | orek manis & asin, secukupnya | purin nabati (risiko lebih kecil)
perkedel | perkedel kentang | Nasi & lauk | r | s | 1-2 buah | aman | -
abon | abon sapi | Nasi & lauk | t | t | 1 sendok | sedikit saja | daging kering tinggi garam
kornet | | Nasi & lauk | t | t | 1-2 sendok | jarang-jarang | daging olahan tinggi garam
# ---------------- Berkuah
soto ayam | soto lamongan;soto kudus | Berkuah | s | t | 1 mangkuk, kuah tidak dihabiskan | tanpa ati ampela;jangan tambah garam/kecap;kuah sisakan setengah | kuah kaldu;koya;ati ampela
soto betawi | soto babat;soto jeroan;soto padang | Berkuah | t | t | isi daging saja, setengah mangkuk | minta tanpa jeroan;jangan habiskan kuah | jeroan;kuah santan berkaldu
coto makassar | coto | Berkuah | t | t | sebaiknya dihindari | kalau terpaksa pilih isi daging saja | jeroan + kuah kacang
rawon | | Berkuah | t | t | setengah mangkuk | pilih daging tanpa babat;kuah sedikit | daging sapi;kaldu pekat
sop buntut | sop iga;sop konro;konro | Berkuah | t | t | setengah porsi, kuah sedikit | fokus ke sayur;jangan habiskan kuah | daging merah;kaldu tulang pekat
sup kambing | sop kaki kambing;sop kambing | Berkuah | t | t | sebaiknya dihindari | kalau terpaksa beberapa sendok kuah saja | daging & kaki kambing;kaldu pekat
tengkleng | | Berkuah | t | t | sebaiknya dihindari | ganti menu lain | tulang dan jeroan kambing
gulai kambing | tongseng | Berkuah | t | t | maksimal 3 potong kecil | jangan minum kuahnya;banyak air putih | daging merah;kuah santan/kecap
gulai ayam | kari ayam | Berkuah | s | s | 1 potong | kuah sedikit | ayam;santan
sayur lodeh | lodeh | Berkuah | r | s | 1 mangkuk | aman | santan
sayur asem | sayur bening;sop sayur | Berkuah | r | s | bebas, kuah jangan terlalu asin | pilihan aman | -
sup ayam | sop ayam;sup jagung | Berkuah | s | s | 1 mangkuk | buang kulit ayam | kaldu ayam
pindang ikan | pindang patin | Berkuah | s | s | 1 potong | kuah secukupnya | ikan
garang asem | | Berkuah | s | s | 1 porsi | aman | ayam
brongkos | | Berkuah | t | s | sedikit | pilih tahu dan telurnya | daging + kuah kluwek
# ---------------- Sate & bakaran
sate ayam | sate madura | Sate & bakar | s | t | 5 tusuk, bumbu sedikit | hindari sate kulit dan ati ampela;bumbu sedikit;makan dengan lontong dan timun | daging ayam;bumbu kacang + kecap
sate kambing | | Sate & bakar | t | t | maksimal 3 tusuk | pilih tanpa jeroan;banyak air putih;hindari saat kambuh | daging merah;kecap
sate padang | | Sate & bakar | t | t | 3 tusuk | kuah sedikit | daging dan lidah/jeroan sapi
sate maranggi | | Sate & bakar | t | s | 3-4 tusuk | sambal oncom sedikit | daging sapi/kambing
sate taichan | | Sate & bakar | s | s | 5 tusuk | sambal secukupnya | ayam
sate usus | sate ati;sate ampela;sate kulit | Sate & bakar | t | t | sebaiknya dihindari | ganti sate telur puyuh | jeroan tinggi purin
sate telur puyuh | telur puyuh | Sate & bakar | r | s | 1-2 tusuk | aman | -
ikan bakar | ikan nila;ikan gurame;gurame | Sate & bakar | s | s | 1 ekor kecil | kecap secukupnya | ikan
ayam bakar madu | | Sate & bakar | s | s | 1 potong | buang kulit | ayam;gula
# ---------------- Daging & jeroan
gulai otak | otak;babat;usus;paru;ati ampela;jeroan;kikil;limpa;hati sapi | Daging & jeroan | t | t | sebaiknya dihindari | ganti telur atau ayam tanpa kulit | jeroan termasuk paling tinggi purin
ceker | ceker ayam;kepala ayam | Daging & jeroan | s | s | 2-3 buah | kuah sedikit | kolagen + kaldu
iga bakar | iga;daging sapi | Daging & jeroan | t | s | 1 potong kecil | pilih porsi kecil;banyak sayur | daging merah
daging kambing | kambing | Daging & jeroan | t | s | sebaiknya dibatasi | porsi kecil, jarang | daging merah
bebek | daging bebek | Daging & jeroan | s | s | 1 potong | buang kulit | unggas berlemak
# ---------------- Seafood
seafood | seafood saus padang | Seafood | t | t | sedikit saja, pilih ikan putih | pilih ikan bakar biasa;hindari teri, sarden, kerang | kerang, teri, sarden tinggi purin;saus padang tinggi garam
udang | udang goreng;udang balado | Seafood | t | s | 3-4 ekor | jangan sering | udang cukup tinggi purin
kerang | kerang hijau;kerang dara;remis | Seafood | t | t | sebaiknya dihindari | ganti ikan putih | kerang tinggi purin
cumi | cumi goreng;cumi hitam | Seafood | s | s | sedikit | jangan tiap hari | cumi
kepiting | rajungan | Seafood | s | t | sedikit | saus sedikit | kepiting + saus
sarden | ikan sarden | Seafood | t | t | sebaiknya dihindari | ganti telur | sarden tinggi purin + kalengan asin
ikan teri | teri;teri medan;sambal teri | Seafood | t | t | sebaiknya dihindari | ganti tempe | teri tinggi purin dan asin
ikan tongkol | tongkol;cakalang;ikan kembung;kembung | Seafood | t | s | 1 potong kecil | jangan sering | ikan berlemak, purin cukup tinggi
ikan asin | asin;jambal | Seafood | s | t | 1 potong kecil | rendam/cuci dulu;makan dengan banyak sayur | garam sangat tinggi
pecel lele | lele goreng;lele | Seafood | s | s | 1 ekor | lalapan diperbanyak | ikan goreng;sambal terasi
ikan salmon | salmon | Seafood | s | r | 1 potong | dipanggang lebih baik | ikan
# ---------------- Mi & bakso
bakso | baso;bakso urat | Mi & bakso | s | t | 1 mangkuk kecil, kuah sedikit | hindari tetelan banyak;kuah tidak dihabiskan | daging olahan;kuah kaldu + MSG
mi ayam | mie ayam | Mi & bakso | s | t | 1 porsi, kuah sedikit | tanpa ceker/kepala;kecap dan saus tidak ditambah | topping ayam kecap;kuah kaldu
mi instan | indomie;mie instan;mie goreng instan;mie kuah | Mi & bakso | r | t | jarang-jarang, bumbu setengah | pakai setengah bumbu;tambah sayur dan telur | bumbu sangat tinggi garam
mi goreng | mie goreng;bakmi goreng;kwetiau goreng;kwetiau | Mi & bakso | s | t | 1 porsi | tanpa seafood;kecap sedikit | kecap;topping seafood
bihun goreng | bihun | Mi & bakso | r | s | 1 porsi | kecap secukupnya | kecap
mi aceh | mie aceh | Mi & bakso | t | t | setengah porsi | pilih topping ayam, bukan kepiting/kambing | kepiting/kambing;bumbu kari
mi kocok | mie kocok | Mi & bakso | t | t | setengah porsi | minta tanpa kikil | kikil + kaldu sapi
pangsit | mi pangsit;wonton | Mi & bakso | s | s | 1 porsi | kuah sedikit | -
# ---------------- Gorengan & camilan
gorengan | bakwan;pisang goreng;ubi goreng;tahu goreng tepung;combro;misro | Gorengan & camilan | r | s | 2 potong | jangan lebih dari 2;tiriskan minyak | minyak + tepung
emping melinjo | emping | Gorengan & camilan | t | s | sebaiknya dihindari | ganti kerupuk biasa 1-2 keping | melinjo dikenal tinggi purin
kerupuk | kerupuk udang;krupuk;kerupuk kulit | Gorengan & camilan | r | t | 1-2 keping | jangan lebih dari 2 | garam
rempeyek | peyek;rempeyek kacang | Gorengan & camilan | s | s | 1-2 keping | pilih kacang, bukan teri/udang | kacang;teri/udang kalau ada
kacang goreng | kacang tanah;kacang bawang;kacang kulit | Gorengan & camilan | s | t | segenggam kecil | pilih yang tanpa garam | kacang asin
keripik | keripik singkong;keripik kentang;keripik pedas;chitato;potato chips;qtela;taro;lays;pringles;cheetos | Gorengan & camilan | r | t | segenggam kecil | jangan habiskan sebungkus | garam dan minyak
martabak telur | martabak;martabak asin;martabak mesir | Gorengan & camilan | s | t | 1-2 potong | acar diperbanyak | daging cincang;minyak
risoles | risol;lumpia;pastel | Gorengan & camilan | s | s | 1-2 buah | aman dalam jumlah kecil | isian daging/ragout
# ---------------- Kue & manis
martabak manis | terang bulan;martabak bangka;martabak coklat;martabak keju | Kue & manis | r | r | 1-2 potong | hindari topping super manis | gula tinggi (fruktosa/gula bisa menaikkan asam urat)
klepon | kue lapis;onde-onde;nagasari;kue basah | Kue & manis | r | r | 1-2 buah | aman dalam jumlah kecil | gula
bubur kacang hijau | burjo;kacang hijau;bubur kacang ijo;kacang ijo;bubur kacang | Kue & manis | s | r | 1 mangkuk kecil | gula sedikit | kacang hijau (purin nabati);gula
kolak | kolak pisang | Kue & manis | r | r | 1 mangkuk kecil | gula sedikit | gula + santan
es campur | es teler;es buah | Kue & manis | r | r | 1 gelas kecil | sirup sedikit | gula/sirup tinggi
roti bakar | roti;roti tawar | Kue & manis | r | s | 1-2 lembar | selai secukupnya | roti mengandung garam
sourdough | roti sourdough;roti gandum;roti gandum utuh;baguette;roti prancis | Kue & manis | r | s | 1-2 iris | pilih isian sayur/telur, bukan daging asap;mentega dan keju sedikit | roti mengandung garam
croissant | roti mentega;danish;pastry | Kue & manis | r | s | 1 buah | jangan sering, tinggi mentega | mentega + garam
roti manis | roti sobek;roti isi;roti coklat;roti keju;bakery | Kue & manis | r | s | 1 buah | pilih yang tidak terlalu manis | gula + garam
donat | donut;kue | Kue & manis | r | r | 1 buah | jangan sering | gula
# ---------------- Sayur & lalapan
capcay | cap cay | Sayur & lalapan | s | s | 1 porsi | minta tanpa ati ayam/seafood | topping ati/seafood kalau ada
tumis kangkung | kangkung;cah kangkung | Sayur & lalapan | r | s | 1 porsi | terasi sedikit | purin nabati (aman);terasi
bayam | sayur bayam | Sayur & lalapan | r | r | 1 mangkuk | aman | purin nabati (aman)
urap | | Sayur & lalapan | r | r | 1 porsi | aman | -
lalapan | lalap;lalapan sunda | Sayur & lalapan | r | r | bebas | sangat dianjurkan, sambal secukupnya | -
tumis jamur | jamur | Sayur & lalapan | s | s | 1 porsi | aman | jamur (purin sedang)
sayur nangka | gudeg | Sayur & lalapan | r | s | 1 porsi | hindari krecek & ati ampela | gula;krecek
oseng tempe | oseng-oseng | Sayur & lalapan | s | s | 1 porsi | aman | tempe
sambal | sambal terasi;sambal botol;saus sambal | Sayur & lalapan | r | t | 1 sendok | sedikit saja | terasi/garam
# ---------------- Buah
buah potong | buah;buah-buahan;potongan buah | Buah | r | r | 1 piring kecil | bagus untuk camilan pengganti gorengan | -
ceri | cherry | Buah | r | r | segenggam | bagus untuk penderita asam urat | -
durian | | Buah | r | r | 1-2 biji | jangan banyak | gula tinggi
nangka | cempedak | Buah | r | r | 3-4 biji | secukupnya | gula
alpukat | jus alpukat | Buah | r | r | 1 buah | jus tanpa susu kental manis | gula kalau dijus
# ---------------- Minuman
es teh manis | teh manis;es jeruk;minuman manis;jus kemasan;teh botol | Minuman | r | r | 1 gelas, minta kurang manis | minta gula sedikit;ganti air putih | gula/fruktosa tinggi bisa menaikkan asam urat
minuman soda | soda;minuman bersoda;coca cola;coca-cola;cola;sprite;fanta;pepsi;big cola;7up;a&w;root beer;soda gembira;fruit tea;teh pucuk;nu green tea;teh kotak | Minuman | r | r | sebaiknya dihindari, maksimal 1 kaleng kecil sesekali | ganti air putih atau teh tawar;kalau terpaksa, minum setengah;jangan tiap hari | minuman berfruktosa tinggi: terbukti menaikkan risiko asam urat;gula tinggi
soda tanpa gula | coca cola zero;coke zero;diet coke;pepsi black;sprite zero;soda zero;air soda;soda water | Minuman | r | r | 1 kaleng sesekali | lebih baik dari soda biasa, tapi air putih tetap terbaik | pemanis buatan;kafein (cola)
air putih | air mineral;air | Minuman | r | r | 8+ gelas sehari | sangat dianjurkan | -
teh tawar | teh hijau;es teh tawar | Minuman | r | r | bebas | pilihan aman | -
kopi | kopi hitam;kopi tubruk | Minuman | r | r | 1-2 cangkir tanpa banyak gula | hindari kopi sachet manis | kopi sachet tinggi gula
kopi susu | es kopi susu;kopi sachet | Minuman | r | r | 1 gelas | minta gula aren sedikit | gula
susu | susu rendah lemak;yogurt | Minuman | r | r | 1 gelas | susu rendah lemak baik untuk asam urat | -
jus buah | jus jeruk;jus mangga | Minuman | r | r | 1 gelas kecil | tanpa gula tambahan | fruktosa
wedang jahe | jahe;bandrek;bajigur;sekoteng | Minuman | r | r | 1 gelas | gula sedikit | gula
bir | alkohol;tuak;ciu;anggur merah | Minuman | t | r | sebaiknya tidak sama sekali | ganti air putih atau teh tawar | alkohol, terutama bir, pemicu kuat asam urat
minuman energi | kratingdaeng;extra joss;minuman isotonik | Minuman | r | s | jarang | ganti air putih | gula + natrium

# ---------------- Fast food & western
pizza | piza;pizza keju;pizza pepperoni;pizza hut;domino | Fast food & western | s | t | 1-2 potong | pilih topping sayur/ayam;hindari pepperoni, sosis, extra cheese;jangan tambah saus | keju + daging olahan tinggi garam;pepperoni/sosis
burger | hamburger;cheeseburger;burger daging;burger king;mcd | Fast food & western | s | t | 1 buah, tanpa extra keju | pilih burger ayam panggang;tanpa bacon dan extra cheese;saus sedikit | patty daging sapi;keju + saus tinggi garam
fried chicken | ayam goreng tepung;kfc;ayam krispi;richeese;ayam crispy | Fast food & western | s | t | 1 potong, kulit dikurangi | buang kulit tepungnya;jangan pesan nasi + kentang + soda sekaligus | tepung berbumbu asin;kulit berlemak
kentang goreng | french fries;fries | Fast food & western | r | t | porsi kecil | minta tanpa garam;saus sedikit | garam taburan
hot dog | corn dog | Fast food & western | s | t | 1 buah | jarang-jarang | sosis olahan tinggi garam
spaghetti | spageti;pasta;bolognese;carbonara;lasagna;makaroni | Fast food & western | s | s | 1 porsi | pilih saus tomat;hindari carbonara bacon | daging cincang/bacon;keju
steak sapi | steak;sirloin;tenderloin;wagyu | Fast food & western | t | s | 1 potong kecil (100 g) | saus blackpepper sedikit;perbanyak sayur | daging merah
chicken steak | steak ayam;chicken katsu;katsu | Fast food & western | s | s | 1 porsi | saus sedikit | ayam goreng tepung
sandwich | roti lapis;sandwich tuna;kebab;shawarma;burrito | Fast food & western | s | s | 1 buah | pilih isian ayam/telur;saus sedikit | daging olahan;saus
salad | salad sayur;salad buah | Fast food & western | r | r | bebas | dressing sedikit | dressing manis/mayones
sup krim | cream soup;sup jamur;clam chowder | Fast food & western | s | t | 1 mangkuk kecil | hindari yang isi kerang | kaldu + krim
nugget | chicken nugget;sosis goreng | Fast food & western | s | t | 3-4 buah | jangan sering | olahan tinggi garam
# ---------------- Chinese & oriental
bakmi | bakmi ayam;bakmi babi;mie pangsit;bakmi gm | Chinese & oriental | s | t | 1 porsi | kuah sedikit;minyak dan kecap jangan ditambah | kuah kaldu;kecap asin
kwetiau siram | kwetiau sapi;ifumie;i fu mie;mie siram | Chinese & oriental | s | t | 1 porsi | pilih ayam, bukan seafood/sapi | kuah kental berkaldu
fuyunghai | fu yung hai;puyonghai | Chinese & oriental | s | s | 1 porsi | saus asam manis sedikit | telur + udang/kepiting
dimsum | dim sum;hakau;siomay ayam;bakpao;lumpia udang | Chinese & oriental | s | s | 3-4 buah | pilih ayam;hindari ceker saus & udang | udang;saus
ayam asam manis | sapo tahu;ayam kungpao;koloke | Chinese & oriental | s | s | 1 porsi | saus sedikit | gula + saus
bebek peking | peking duck;babi panggang;char siu | Chinese & oriental | t | t | sedikit | jarang-jarang | daging berlemak + saus asin
nasi hainan | nasi ayam hainan;hainanese chicken rice | Chinese & oriental | s | s | 1 porsi | kecap asin sedikit | kaldu ayam
bubur ayam kanton | bubur kanton;bubur hongkong;congee | Chinese & oriental | s | s | 1 mangkuk | hindari ati dan century egg banyak | kaldu;topping jeroan
hotpot | shabu shabu;suki;suki-suki;steamboat | Chinese & oriental | t | t | sedikit kuah | pilih sayur, jamur, tahu;jangan minum kuahnya | kaldu pekat + seafood/daging
mala | mala hotpot;malatang | Chinese & oriental | t | t | sedikit | jangan minum kuahnya | kuah pedas berkaldu + jeroan
# ---------------- Jepang & Korea
sushi | sashimi;onigiri;sushi roll | Jepang & Korea | s | t | 4-6 potong | kecap asin sedikit;hindari telur ikan dan sarden | kecap asin;ikan/telur ikan
ramen | shoyu ramen;tonkotsu;miso ramen | Jepang & Korea | t | t | setengah porsi, kuah sedikit | jangan habiskan kuah;minta tanpa topping babi berlemak | kaldu tulang pekat + kecap asin
udon | soba | Jepang & Korea | r | t | 1 porsi, kuah sedikit | jangan habiskan kuah | kuah dashi asin
takoyaki | okonomiyaki | Jepang & Korea | s | s | 4-5 butir | saus sedikit | gurita;saus
beef bowl | gyudon;yoshinoya;rice bowl;donburi | Jepang & Korea | t | t | 1 porsi kecil | minta saus sedikit | daging sapi + saus kecap
chicken teriyaki | teriyaki;ayam teriyaki;yakitori | Jepang & Korea | s | t | 1 porsi | saus sedikit | kecap manis/asin
tempura | ebi furai;ebi tempura | Jepang & Korea | s | s | 3-4 potong | pilih sayur | udang goreng tepung
korean bbq | samgyeopsal;bulgogi;daging panggang | Jepang & Korea | t | t | sedikit | perbanyak selada;saus sedikit | daging merah + saus
tteokbokki | toppoki;topokki | Jepang & Korea | r | t | setengah porsi | saus sedikit | saus gochujang asin manis
kimchi | | Jepang & Korea | r | t | 2-3 sendok | sedikit saja | fermentasi tinggi garam
ramyeon | samyang;mi korea;jjajangmyeon | Jepang & Korea | r | t | jarang, bumbu setengah | pakai setengah bumbu | bumbu sangat tinggi garam
ayam korea | korean fried chicken;chicken wings;sayap ayam | Jepang & Korea | s | t | 3-4 potong | saus dipisah | saus manis asin;kulit
# ---------------- Masakan daerah
nasi tutug oncom | tutug oncom;nasi tutug | Masakan daerah | s | t | 1 porsi kecil | ikan asin sedikit | oncom;ikan asin
nasi timbel | timbel;nasi bakar | Masakan daerah | s | s | 1 porsi | ikan asin dan sambal secukupnya | lauk ikan asin/jeroan kalau ada
gudeg krecek | krecek;gudeg komplit | Masakan daerah | s | t | 1 porsi | krecek sedikit;hindari ati ampela | krecek;ati ampela
pecak lele | pecak ikan | Masakan daerah | s | s | 1 porsi | sambal secukupnya | ikan
papeda | ikan kuah kuning | Masakan daerah | s | s | 1 porsi | aman | ikan
ayam betutu | betutu;bebek betutu;babi guling | Masakan daerah | t | t | sedikit | pilih daging tanpa kulit | daging berbumbu asin;babi/bebek berlemak
sate lilit | | Masakan daerah | s | s | 3 tusuk | aman | ikan/ayam cincang
rujak cingur | cingur | Masakan daerah | t | t | sebaiknya dihindari | minta tanpa cingur | cingur (moncong sapi) + petis
rujak buah | rujak;rujak serut | Masakan daerah | r | s | 1 porsi | bumbu gula merah secukupnya | gula + garam bumbu
lontong balap | lontong kupang;kupang | Masakan daerah | t | t | setengah porsi | minta tanpa kupang | kupang (kerang) + petis
tahu tek | tahu campur | Masakan daerah | s | t | 1 porsi | bumbu petis sedikit | petis + kecap
pallubasa | konro bakar;sop saudara | Masakan daerah | t | t | sebaiknya dihindari | kalau terpaksa sedikit, tanpa jeroan | jeroan + kuah pekat
ikan bakar rica | rica-rica;ayam rica;woku | Masakan daerah | s | s | 1 porsi | sambal secukupnya | ikan/ayam
nasi jamblang | nasi lengko;empal asem | Masakan daerah | s | s | 1 porsi | pilih lauk tahu, tempe, telur | lauk jeroan kalau ada
bakso malang | bakwan malang;cuanki | Masakan daerah | s | t | 1 mangkuk kecil | kuah sedikit | bakso + kuah kaldu
soto banjar | soto bandung;soto mie | Masakan daerah | s | t | 1 mangkuk | kuah sedikit;tanpa jeroan | kaldu;jeroan kalau ada
kerupuk mie | seblak kering;basreng | Masakan daerah | r | t | segenggam kecil | jangan habiskan sebungkus | bumbu asin pedas
# ---------------- Jajanan & camilan tambahan
roti bakar bandung | roti bakar coklat;roti john | Kue & manis | r | r | 1-2 potong | selai secukupnya | gula
pisang goreng keju | pisang molen;pisang nugget | Kue & manis | r | r | 1-2 buah | topping sedikit | gula + keju
bolu | brownies;cake;kue tart;bolu kukus;black forest | Kue & manis | r | r | 1 potong | jangan sering | gula
kue kering | nastar;kastengel;putri salju;biskuit;oreo;wafer;tango;roma;biskuit kemasan;good time | Kue & manis | r | s | 3-4 buah | jangan habiskan setoples | gula/keju
es krim | eskrim;ice cream;gelato | Kue & manis | r | r | 1 scoop | jangan sering | gula
puding | agar-agar;jelly | Kue & manis | r | r | 1 potong | aman | gula
permen | permen jelly;gummy;gummies;chupa chups;yupi;lolipop;lollipop;permen asam;permen karet;mentos;sugus;kopiko;marshmallow | Kue & manis | r | r | 1-2 butir saja | jangan jadi camilan rutin;sikat gigi/kumur setelahnya;pilih buah sebagai ganti | gula tinggi (fruktosa/gula bisa menaikkan asam urat)
cokelat | coklat;chocolate;silverqueen;cadbury;kitkat;coklat batang | Kue & manis | r | r | 1-2 potong kecil | pilih dark chocolate | gula
serabi | surabi;apem;kue pukis;kue lumpur | Kue & manis | r | r | 1-2 buah | aman | gula + santan
lemper | arem-arem;lontong isi | Kue & manis | s | s | 1-2 buah | aman | isian ayam
mi lidi | makaroni pedas;chiki;snack kemasan;jajanan kemasan;ciki | Gorengan & camilan | r | t | segenggam kecil | baca label natrium | bumbu tinggi garam
popcorn | berondong | Gorengan & camilan | r | s | 1 mangkuk kecil | pilih tanpa garam/karamel | garam/gula
kacang mete | mete;almond;kenari | Gorengan & camilan | s | r | segenggam kecil | pilih tanpa garam | kacang (purin nabati)
# ---------------- Minuman tambahan
boba | bubble tea;milk tea;thai tea;chatime | Minuman | r | r | 1 gelas kecil, less sugar | minta gula 25% | gula/fruktosa tinggi
es kelapa muda | air kelapa;kelapa muda | Minuman | r | r | 1 gelas | tanpa sirup | -
jus sayur | jus seledri;jus tomat;jus wortel | Minuman | r | r | 1 gelas | tanpa gula | -
cincau | es cincau;dawet;cendol;es doger | Minuman | r | r | 1 gelas | gula sedikit | gula
susu kedelai | sari kedelai | Minuman | s | r | 1 gelas | tanpa gula banyak | kedelai (purin nabati)
jamu | kunyit asam;beras kencur | Minuman | r | r | 1 gelas | gula sedikit | gula

# ---------------- Buah satuan
pisang | pisang ambon;pisang raja;pisang kepok | Buah | r | r | 1-2 buah | kaya kalium, bagus untuk tensi | -
pepaya | | Buah | r | r | 1 potong besar | bagus untuk pencernaan | -
jeruk | jeruk manis;jeruk medan;jeruk peras;sunkist | Buah | r | r | 1-2 buah | makan buahnya lebih baik dari jus | -
jeruk bali | grapefruit;pomelo | Buah | r | r | sedikit, tanya dokter dulu | bisa berinteraksi dengan beberapa obat darah tinggi (mis. amlodipin) — tanya dokter | interaksi dengan obat tensi
semangka | | Buah | r | r | 2-3 potong | segar dan banyak air | -
melon | blewah | Buah | r | r | 2-3 potong | aman | -
apel | apel malang;apel fuji | Buah | r | r | 1 buah | makan dengan kulitnya | -
mangga | mangga harum manis;mangga muda | Buah | r | r | 1 buah kecil | jangan berlebihan, cukup manis | fruktosa
nanas | nenas | Buah | r | r | 2-3 potong | aman | -
anggur | anggur hijau;anggur merah buah | Buah | r | r | segenggam kecil | jangan berlebihan | fruktosa
salak | salak pondoh | Buah | r | r | 2-3 buah | aman | -
rambutan | | Buah | r | r | 5-6 buah | jangan berlebihan | gula
duku | langsat;kokosan | Buah | r | r | segenggam | aman | -
manggis | | Buah | r | r | 3-4 buah | aman | -
jambu biji | jambu merah;jambu klutuk | Buah | r | r | 1 buah | tinggi vitamin C, bagus untuk asam urat | -
jambu air | jambu semarang | Buah | r | r | 3-4 buah | aman | -
belimbing | belimbing manis | Buah | r | r | 1 buah | hindari kalau ada gangguan ginjal | berbahaya untuk penderita gangguan ginjal
sirsak | jus sirsak | Buah | r | r | 1 potong / 1 gelas tanpa gula | aman | -
sawo | sawo manila | Buah | r | r | 1-2 buah | manis, secukupnya | gula
kelengkeng | lengkeng;leci | Buah | r | r | segenggam kecil | jangan berlebihan | gula
buah naga | naga merah | Buah | r | r | setengah buah | aman | -
stroberi | strawberry | Buah | r | r | segenggam | bagus untuk camilan | -
kiwi | | Buah | r | r | 1-2 buah | tinggi vitamin C | -
pir | pear;pir yali | Buah | r | r | 1 buah | aman | -
markisa | | Buah | r | r | 1-2 buah | tanpa gula tambahan | -
kedondong | | Buah | r | r | 1-2 buah | rujak kedondong: bumbu secukupnya | -
srikaya | buah nona | Buah | r | r | 1 buah kecil | manis, secukupnya | gula
kurma | | Buah | r | r | 3 butir | manis sekali, secukupnya | gula tinggi
kelapa | daging kelapa;kelapa parut | Buah | r | r | sedikit | lemak jenuh, secukupnya | lemak
# ---------------- Sayur satuan
timun | mentimun;ketimun | Sayur & lalapan | r | r | bebas | sangat dianjurkan | -
selada | lettuce;selada air | Sayur & lalapan | r | r | bebas | aman | -
kemangi | | Sayur & lalapan | r | r | bebas | aman | -
wortel | | Sayur & lalapan | r | r | bebas | aman | -
tomat | | Sayur & lalapan | r | r | 1-2 buah | aman | -
brokoli | | Sayur & lalapan | r | r | 1 porsi | aman | -
kembang kol | bunga kol | Sayur & lalapan | s | r | 1 porsi | purin nabati, risiko kecil | purin nabati
kol | kubis;kol goreng | Sayur & lalapan | r | r | bebas (kol goreng secukupnya) | kol goreng menyerap minyak | -
sawi | sawi hijau;caisim;pakcoy;sawi putih | Sayur & lalapan | r | r | 1 porsi | aman | -
buncis | | Sayur & lalapan | r | r | 1 porsi | aman | -
kacang panjang | | Sayur & lalapan | r | r | 1 porsi | aman | -
tauge | toge;kecambah | Sayur & lalapan | s | r | 1 porsi | rebus/tumis, secukupnya | purin nabati sedang
terong | terong balado;terong goreng | Sayur & lalapan | r | s | 1 porsi | balado/goreng menyerap minyak & garam | bumbu balado
labu siam | jipang | Sayur & lalapan | r | r | 1 porsi | aman | -
labu kuning | waluh | Sayur & lalapan | r | r | 1 porsi | aman | -
oyong | gambas | Sayur & lalapan | r | r | 1 porsi | aman | -
pare | paria | Sayur & lalapan | r | r | 1 porsi | aman | -
daun singkong | daun singkong rebus | Sayur & lalapan | r | r | 1 porsi | aman (versi gulai: santan secukupnya) | -
daun pepaya | | Sayur & lalapan | r | r | 1 porsi | aman | -
asparagus | | Sayur & lalapan | s | r | 1 porsi | purin nabati, risiko kecil | purin nabati
daun melinjo | melinjo;biji melinjo;sayur daun melinjo | Sayur & lalapan | t | r | sebaiknya dihindari | di sayur asem: sisihkan melinjonya | melinjo dikenal tinggi purin
petai | pete | Sayur & lalapan | s | r | sedikit | secukupnya | -
jengkol | semur jengkol | Sayur & lalapan | s | s | sebaiknya dihindari | bisa membebani ginjal, minum banyak air | asam jengkolat (ginjal)
jagung | jagung rebus;jagung bakar | Sayur & lalapan | r | r | 1 tongkol | rebus lebih baik dari bakar bermentega | -
kentang | kentang rebus | Sayur & lalapan | r | r | 1-2 buah | rebus/kukus lebih baik dari goreng | -
singkong | ubi kayu;singkong rebus | Sayur & lalapan | r | r | 1 potong | rebus lebih baik dari goreng | -
ubi | ubi jalar;ubi ungu;ubi cilembu | Sayur & lalapan | r | r | 1 buah | aman | -
genjer | | Sayur & lalapan | r | r | 1 porsi | aman | -
pakis | paku;sayur pakis | Sayur & lalapan | r | r | 1 porsi | aman | -
rebung | | Sayur & lalapan | r | r | 1 porsi | aman | -
nangka muda | sayur nangka muda | Sayur & lalapan | r | s | 1 porsi | kuah santan secukupnya | santan
kacang merah | sup kacang merah;kacang tolo | Sayur & lalapan | s | r | 1 mangkuk kecil | purin nabati, secukupnya | purin nabati
edamame | kedelai rebus | Sayur & lalapan | s | r | segenggam | purin nabati, secukupnya | purin nabati
cabai | cabe;cabai rawit | Sayur & lalapan | r | r | secukupnya | aman, asal bukan sambal asin | -
bawang putih | bawang merah;bawang bombay | Sayur & lalapan | r | r | secukupnya | aman | -
"""


ALERGEN = {"gl": "gluten", "tl": "telur", "su": "susu", "kt": "kacang tanah", "kd": "kedelai",
           "ik": "ikan", "kr": "krustasea", "mo": "moluska", "kp": "kacang pohon"}


def build():
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from nutrition import N

    foods = []
    for line in ROWS.strip().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        name, aliases, kat, purin, garam, porsi, trik, pemicu = parts
        split = lambda s: [x.strip() for x in s.split(";") if x.strip() and x.strip() != "-"]
        if name not in N:
            raise SystemExit(f"data gizi belum ada untuk: {name}")
        kgl, _, alg = N[name].partition(" ")
        if len(kgl) != 3 or any(c not in L for c in kgl):
            raise SystemExit(f"format KGL salah untuk {name}: {kgl!r}")
        codes = [a for a in alg.split(",") if a]
        bad = [a for a in codes if a not in ALERGEN]
        if bad:
            raise SystemExit(f"kode alergen tidak dikenal untuk {name}: {bad}")
        foods.append({"name": name, "aliases": split(aliases), "kategori": kat,
                      "purin": L[purin], "garam": L[garam],
                      "karbo": L[kgl[0]], "gula": L[kgl[1]], "lemak": L[kgl[2]],
                      "alergen": [ALERGEN[a] for a in codes],
                      "porsi_aman": porsi, "trik": split(trik), "pemicu": split(pemicu)})
    extra = set(N) - {f["name"] for f in foods}
    if extra:
        raise SystemExit(f"data gizi untuk makanan yang tidak ada: {sorted(extra)}")
    out = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "foods", "foods.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"_note": "Dibuat oleh tools/build_foods.py + tools/nutrition.py. Perkiraan per porsi khas; sumber & ambang di docs/SUMBER-GIZI.md. Bukan data laboratorium.",
                   "foods": foods}, f, ensure_ascii=False, indent=1)
    names = [n for f in foods for n in [f["name"]] + f["aliases"]]
    dup = {n for n in names if names.count(n) > 1}
    print(len(foods), "makanan,", len(names), "nama/alias", "| duplikat:", dup or "-")


if __name__ == "__main__":
    build()
