// Boleh Gak, Pa? — frontend PWA (vanilla JS, tanpa build step)
const $ = (s) => document.querySelector(s);
const state = { note: "Ditraktir teman", joint: "jempol kaki", last: null, vision: false, foods: [], cat: "Semua", status: "semua" };

const FOOD_CHIPS = ["ketoprak", "sate kambing", "soto betawi", "bakso", "gado-gado", "nasi padang", "seafood", "martabak manis"];
const NOTE_CHIPS = ["Ditraktir teman", "Kondangan", "Di rumah", "Beli sendiri"];
const JOINT_CHIPS = ["jempol kaki", "pergelangan kaki", "lutut", "tangan / jari", "siku"];
const STATUS_LABEL = { hijau: "Aman", kuning: "Batasi", merah: "Hindari" };
const VERDICT_LABEL = { hijau: "Aman", kuning: "Boleh, dibatasi", merah: "Sebaiknya jangan" };
const LEVEL = { rendah: 1, sedang: 2, tinggi: 3 };

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), 2600);
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function chips(el, items, current, onPick, single = true) {
  el.innerHTML = "";
  items.forEach((item) => {
    const [value, label] = Array.isArray(item) ? item : [item, item];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (value === current ? " on" : "");
    b.dataset.s = value;
    b.textContent = label;
    b.onclick = () => {
      onPick(value);
      if (single) [...el.children].forEach((c) => c.classList.toggle("on", c === b));
    };
    el.appendChild(b);
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) return toast("HP ini belum bisa membacakan");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "id-ID";
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

function meter(label, level) {
  const n = LEVEL[level] || 0;
  return `<div class="meter"><span>${label}</span><span class="segs">${[1, 2, 3].map((i) => `<i class="${i <= n ? "f" : ""}"></i>`).join("")}</span><span>${esc(level || "?")}</span></div>`;
}

// ---------------------------------------------------------------- tabs
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
  document.querySelectorAll("nav.bottom button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  window.scrollTo(0, 0);
  if (name === "daftar") loadFoods();
  if (name === "catatan") loadMeals();
  if (name === "kambuh") loadFlares();
  if (name === "review") loadReview();
}
document.querySelectorAll("nav.bottom button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

// ---------------------------------------------------------------- health
async function health() {
  const pill = $("#ai-pill");
  try {
    const h = await api("/api/health");
    pill.textContent = h.ai ? h.model.replace("gemma3:", "Gemma ") + " · lokal" : "Mode tabel";
    pill.title = h.ai ? `${h.model} jalan di laptop, tanpa internet` : "Gemma belum siap, pakai tabel makanan saja";
    pill.classList.toggle("on", h.ai);
    state.vision = h.vision;
  } catch {
    pill.textContent = "Offline";
    pill.classList.remove("on");
  }
}

async function flareBanner() {
  const flares = await api("/api/flares").catch(() => []);
  const active = flares.find((f) => !f.ended);
  const el = $("#flare-banner");
  if (active) {
    el.textContent = `Asam urat lagi kambuh (${active.joint}). Saran dibuat lebih ketat.`;
    el.classList.remove("hidden");
  } else el.classList.add("hidden");
}

// ---------------------------------------------------------------- foto → nama makanan
function resizeImage(file, max = 768) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Hasil lama disembunyikan begitu ada foto/ketikan baru, supaya tidak salah baca.
function clearResult() {
  $("#result").classList.add("hidden");
  $("#result").innerHTML = "";
  state.last = null;
}

function renderPhotoInfo(r) {
  const el = $("#photo-info");
  const picks = [r.food, ...(r.alternatives || [])];
  el.innerHTML = `
    ${r.nama ? `<p class="small"><b>Gemma melihat:</b> ${esc(r.nama)}</p>` : ""}
    ${r.komponen?.length ? `<p class="small"><b>Isinya:</b> ${esc(r.komponen.join(", "))}</p>` : ""}
    ${r.corrected && r.model_guess !== "lainnya" ? `<p class="small muted">Pilihan awal "${esc(r.model_guess)}" tidak cocok dengan yang terlihat, jadi dikoreksi.</p>` : ""}
    ${r.in_table === false ? `<p class="small"><b>⚠️ Belum ada di daftar</b> — nanti dinilai Gemma, atau simpan ke daftar.</p>` : ""}
    <p class="eyebrow">Betul yang mana, Pa?</p>
    <div class="chips">${picks.map((n, i) => `<button type="button" class="chip${i === 0 ? " on" : ""}" data-pick="${esc(n)}">${esc(n)}</button>`).join("")}</div>`;
  el.classList.remove("hidden");
  el.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => {
    $("#food").value = b.dataset.pick;
    el.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
    clearResult();
  }));
}

$("#food").addEventListener("input", clearResult);

$("#photo").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  clearResult();
  $("#food").value = "";
  $("#photo-info").classList.add("hidden");
  const dataUrl = await resizeImage(file);
  $("#preview").src = dataUrl;
  $("#preview").classList.remove("hidden");
  if (!state.vision) return toast("Fitur foto butuh Gemma 4B (masih diunduh). Ketik namanya dulu ya, Pa.");
  setLoading(true, "Gemma lagi melihat fotonya…");
  try {
    const r = await api("/api/identify", { image: dataUrl });
    $("#food").value = r.food === "lainnya" ? "" : r.food;
    renderPhotoInfo(r);
    toast(r.confidence === "yakin" ? `Kelihatannya ${r.food}. Betul, Pa?` : `Mungkin ${r.food}? Pilih yang betul ya.`);
    e.target.value = "";
  } catch {
    toast("Belum bisa baca foto. Ketik saja namanya ya.");
  } finally {
    setLoading(false);
  }
};

// ---------------------------------------------------------------- cek
function setLoading(on, text) {
  $("#loading").classList.toggle("hidden", !on);
  if (text) $("#loading-text").innerHTML = `<b>${esc(text)}</b>`;
  if (on) $("#loading").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function check(food) {
  clearResult();
  setLoading(true, "Gemma lagi mikir di laptop…");
  const t0 = performance.now();
  try {
    const r = await api("/api/assess", { food, note: state.note });
    r.elapsed = ((performance.now() - t0) / 1000).toFixed(0);
    state.last = r;
    renderResult(r);
  } catch (err) {
    toast("Gagal: " + err.message);
  } finally {
    setLoading(false);
  }
}

$("#cek-form").onsubmit = (e) => {
  e.preventDefault();
  const food = $("#food").value.trim();
  if (!food) return toast("Ketik atau foto makanannya dulu, Pa");
  check(food);
};

function renderResult(r) {
  const el = $("#result");
  el.innerHTML = `
    <div class="verdict ${esc(r.status)}">
      <span class="stamp">${VERDICT_LABEL[r.status] || esc(r.status)}</span>
      ${r.in_table ? "" : `<span class="estimate">⚠️ Belum ada di daftar · lampu ini perkiraan Gemma</span>`}
      <div class="food-name">${(r.components || []).length > 1 ? `Kombinasi ${r.components.length} makanan` : esc(r.food)}</div>
      <div class="headline">${esc(r.headline)}</div>
      ${(r.components || []).length > 1 || (r.components || []).some((c) => c.matched?.includes("(dari")) ? `
        <div class="parts">${r.components.map((c) => `
          <span class="part"><i class="dot ${esc(c.status)}"></i>${esc(c.name)}${c.matched?.includes("(dari") ? `<small>${esc(c.matched.split("(dari ")[1].replace(/[')]/g, ""))}?</small>` : ""}</span>`).join('<span class="plus">+</span>')}
        </div>
        ${r.components.filter((c) => c.garam === "tinggi").length >= 2 ? `<p class="combo-warn">Dobel garam: ${r.components.filter((c) => c.garam === "tinggi").map((c) => esc(c.name)).join(" + ")}</p>` : ""}` : ""}
      ${r.in_table ? `<div class="meters">${meter("Purin", r.purin)}${meter("Garam", r.garam)}</div>` : ""}
      ${r.flare_active ? `<span class="flare-tag">Lagi kambuh, lebih ketat</span>` : ""}
    </div>

    <div class="card">
      <p class="eyebrow">Porsi aman</p>
      <p class="portion">${esc(r.portion)}</p>
      <p class="eyebrow">Biar lebih aman</p>
      <ol class="tips">${(r.tips || []).map((t) => `<li><span>${esc(t)}</span></li>`).join("")}</ol>
    </div>

    <div class="card">
      <h2>Cara bilang ke teman</h2>
      ${(r.refusals || []).map((x, i) => `
        <div class="refusal">
          <b>${esc(x.label)}</b>
          <p>“${esc(x.text)}”</p>
          <div class="row">
            <button class="btn sm" data-speak="${i}">Bacakan</button>
            <button class="btn sm" data-copy="${i}">Salin</button>
          </div>
        </div>`).join("")}
      <details>
        <summary>Kalau tetap dimakan semua?</summary>
        <p>${esc(r.if_forced)}</p>
      </details>
      <details>
        <summary>Kenapa?</summary>
        <p>${esc(r.why)}</p>
        <p class="muted small">${r.in_table ? "Lampu dari tabel makanan lokal." : "Tidak ada di tabel — perkiraan Gemma, hati-hati."}
          ${r.source === "gemma" ? `Ditulis ${esc(r.model)} di laptop dalam ${r.elapsed} detik.` : "Mode tabel (Gemma belum siap)."}</p>
      </details>
    </div>

    <div class="card">
      <h2>Jadinya gimana, Pa?</h2>
      <div class="stack">
        <button class="btn big good" data-log="sesuai saran">Makan sesuai saran</button>
        <button class="btn big" data-log="porsi penuh">Makan 1 porsi penuh</button>
        <button class="btn big primary" data-log="ditolak">Berhasil menolak!</button>
      </div>
    </div>
    ${r.in_table ? "" : `<button class="btn big ink" id="save-unknown">+ Simpan "${esc(r.food)}" ke daftar</button>`}`;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth" });

  el.querySelectorAll("[data-speak]").forEach((b) => (b.onclick = () => speak(r.refusals[b.dataset.speak].text)));
  el.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(r.refusals[b.dataset.copy].text); toast("Tersalin"); }
    catch { toast("Tidak bisa menyalin di HP ini"); }
  }));
  el.querySelectorAll("[data-log]").forEach((b) => (b.onclick = () => logMeal(b.dataset.log)));
  const su = $("#save-unknown");
  if (su) su.onclick = () => { showTab("daftar"); openAdd(r.food, true); };
}

async function logMeal(portion) {
  const r = state.last;
  if (!r) return;
  await api("/api/meals", { food: r.food, portion, status: portion === "ditolak" ? "hijau" : r.status, note: state.note });
  toast(portion === "ditolak" ? "Mantap, Pa! Tercatat." : "Tercatat di catatan makan");
  clearResult();
  $("#food").value = "";
  $("#preview").classList.add("hidden");
  $("#photo-info").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------- daftar makanan
async function fetchFoods() {
  if (!state.foods.length) state.foods = await api("/api/foods");
  return state.foods;
}

async function loadFoods() {
  const foods = await fetchFoods();
  const cats = ["Semua", ...new Set(foods.map((f) => f.kategori))];
  chips($("#cat-filter"), cats, state.cat, (c) => { state.cat = c; renderFoods(); });
  chips($("#status-filter"), [["semua", "Semua"], ["hijau", "Aman"], ["kuning", "Batasi"], ["merah", "Hindari"]], state.status,
    (s) => { state.status = s; renderFoods(); });
  renderFoods();
}

function renderFoods() {
  const q = $("#search").value.trim().toLowerCase();
  const list = state.foods.filter((f) =>
    (state.cat === "Semua" || f.kategori === state.cat) &&
    (state.status === "semua" || f.status === state.status) &&
    (!q || [f.name, ...f.aliases].some((n) => n.includes(q))));
  $("#food-count").textContent = `${list.length} dari ${state.foods.length} makanan · ketuk untuk cek`;
  $("#food-grid").innerHTML = list.length ? list.map((f) => `
    <article class="food" data-name="${esc(f.name)}">
      <div class="rail ${f.status}"></div>
      <div class="body">
        <div class="top-line"><h3>${esc(f.name)}</h3><span class="kat">${esc(f.kategori)}</span></div>
        ${f.aliases.length ? `<div class="alias">${esc(f.aliases.slice(0, 4).join(", "))}</div>` : ""}
        <div class="badges">
          <span class="badge ${f.status === "hijau" ? "rendah" : f.status === "kuning" ? "sedang" : "tinggi"}">${STATUS_LABEL[f.status]}</span>
          <span class="badge ${f.purin}">Purin ${f.purin}</span>
          <span class="badge ${f.garam}">Garam ${f.garam}</span>
          ${f.custom ? `<span class="badge keluarga">Buatan keluarga</span>` : ""}
        </div>
        <p class="porsi">${esc(f.porsi_aman)}</p>
        ${f.custom ? `<button class="btn del" data-del="${f.id}">Hapus</button>` : ""}
      </div>
    </article>`).join("") : `<div class="card empty">Belum ada di daftar. Coba cek langsung di tab Cek, Gemma akan menilai.</div>`;
  document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Hapus makanan ini dari daftar?")) return;
    await api(`/api/foods/${b.dataset.del}/delete`, {});
    state.foods = [];
    loadFoods();
  }));
  document.querySelectorAll(".food").forEach((card) => (card.onclick = () => {
    $("#food").value = card.dataset.name;
    showTab("cek");
    check(card.dataset.name);
  }));
}
$("#search").oninput = () => state.foods.length && renderFoods();

// ---------------------------------------------------------------- tambah makanan sendiri
function openAdd(name = "", autoAnalyze = false) {
  $("#add-card").classList.remove("hidden");
  $("#add-open").classList.add("hidden");
  $("#add-review").classList.add("hidden");
  $("#add-form").classList.remove("hidden");
  $("#add-name").value = name;
  $("#add-bahan").value = "";
  fetchFoods().then((foods) => {
    const cats = [...new Set(foods.map((f) => f.kategori).filter((k) => k !== "Buatan keluarga"))];
    $("#add-kategori").innerHTML = cats.map((c) => `<option>${esc(c)}</option>`).join("");
  });
  $("#add-card").scrollIntoView({ behavior: "smooth" });
  if (autoAnalyze && name) $("#add-bahan").focus();
  else $("#add-name").focus();
}

function closeAdd() {
  $("#add-card").classList.add("hidden");
  $("#add-open").classList.remove("hidden");
}

$("#add-open").onclick = () => openAdd();
$("#add-cancel").onclick = closeAdd;

$("#add-form").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#add-name").value.trim();
  if (!name) return;
  $("#add-loading").classList.remove("hidden");
  $("#add-review").classList.add("hidden");
  try {
    const a = await api("/api/foods/analyze", { name, bahan: $("#add-bahan").value });
    $("#add-purin").value = a.purin;
    $("#add-garam").value = a.garam;
    if ([...$("#add-kategori").options].some((o) => o.value === a.kategori)) $("#add-kategori").value = a.kategori;
    $("#add-porsi").value = a.porsi_aman;
    $("#add-trik").value = (a.trik || []).join("\n");
    $("#add-alasan").textContent = a.alasan;
    $("#add-refs").textContent = a.refs?.length ? `Dibandingkan dengan: ${a.refs.join(", ")}` : "";
    state.pemicu = a.pemicu || [];
    $("#add-form").classList.add("hidden");
    $("#add-review").classList.remove("hidden");
  } catch (err) {
    toast("Gagal menganalisis: " + err.message);
  } finally {
    $("#add-loading").classList.add("hidden");
  }
};

$("#add-save").onclick = async () => {
  const name = $("#add-name").value.trim();
  try {
    await api("/api/foods", {
      name, bahan: $("#add-bahan").value, kategori: $("#add-kategori").value,
      purin: $("#add-purin").value, garam: $("#add-garam").value, porsi_aman: $("#add-porsi").value,
      trik: $("#add-trik").value.split("\n").map((t) => t.trim()).filter(Boolean),
      aliases: $("#add-alias").value.split(","), pemicu: state.pemicu || [], alasan: $("#add-alasan").textContent,
    });
    toast(`"${name}" masuk daftar keluarga`);
    closeAdd();
    state.foods = [];
    state.cat = "Semua";
    $("#search").value = name;
    await loadFoods();
  } catch (err) {
    toast(err.message);
  }
};

// ---------------------------------------------------------------- catatan
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const CAT_EMOJI = {
  "Kaki lima": "🥜", "Nasi & lauk": "🍚", "Berkuah": "🍲", "Sate & bakar": "🍢", "Daging & jeroan": "🥩",
  "Seafood": "🦐", "Mi & bakso": "🍜", "Gorengan & camilan": "🍘", "Kue & manis": "🍰", "Sayur & lalapan": "🥬",
  "Buah": "🍉", "Minuman": "🥤", "Fast food & western": "🍔", "Chinese & oriental": "🥟", "Jepang & Korea": "🍣",
  "Masakan daerah": "🍛", "Buatan keluarga": "🏠",
};
const PORTION_TAG = {
  "sesuai saran": ["✅", "sesuai saran", "hijau"],
  "porsi penuh": ["🍛", "porsi penuh", "merah"],
  "ditolak": ["🙅", "berhasil menolak", "biru"],
};
const SALT_LIMIT = 2; // kira-kira: lebih dari 2 makanan tinggi garam sehari = terlalu banyak

function foodEmoji(name) {
  const first = String(name).split(" + ")[0];
  const f = state.foods.find((x) => x.name === first);
  return CAT_EMOJI[f?.kategori] || "🍽️";
}

const dayKey = (iso) => iso.slice(0, 10);

function streakNoRed(meals) {
  // berapa hari berturut-turut (sampai hari ini) tanpa makanan merah yang dimakan
  const redDays = new Set(meals.filter((m) => m.status === "merah" && m.portion !== "ditolak").map((m) => dayKey(m.at)));
  let n = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    const key = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`;
    if (redDays.has(key)) break;
    n++;
  }
  return n;
}

function last7Days() {
  const out = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    out.push({
      key: `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`,
      label: k.toLocaleDateString("id-ID", { weekday: "short" }),
      date: k.getDate(),
      today: i === 0,
    });
  }
  return out;
}

async function loadMeals() {
  await fetchFoods().catch(() => {});
  const meals = await api("/api/meals");
  const today = dayKey(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString());
  const todays = meals.filter((m) => dayKey(m.at) === today);
  const eaten = todays.filter((m) => m.portion !== "ditolak");
  const count = (arr, st) => arr.filter((m) => m.status === st).length;
  const saltToday = eaten.filter((m) => m.garam === "tinggi").length;
  const refused = meals.filter((m) => m.portion === "ditolak").length;
  const streak = streakNoRed(meals);

  // 7 hari: tabel
  const days = last7Days().map((d) => {
    const dm = meals.filter((m) => dayKey(m.at) === d.key);
    const de = dm.filter((m) => m.portion !== "ditolak");
    return { ...d, n: dm.length, h: count(de, "hijau"), k: count(de, "kuning"), m: count(de, "merah"),
             g: de.filter((m) => m.garam === "tinggi").length, t: dm.filter((m) => m.portion === "ditolak").length };
  });

  // makanan paling sering
  const freq = {};
  meals.forEach((m) => m.food.split(" + ").forEach((f) => (freq[f] = (freq[f] || 0) + 1)));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTop = top.length ? top[0][1] : 1;

  const saltBlocks = Array.from({ length: Math.max(SALT_LIMIT + 1, saltToday) }, (_, i) =>
    `<i class="${i < saltToday ? (i >= SALT_LIMIT ? "over" : "f") : ""}"></i>`).join("");

  $("#meal-summary").innerHTML = `
    <div class="sticker-row">
      <div class="sticker yellow"><span class="emo">🔥</span><b>${streak}</b><small>hari tanpa merah</small></div>
      <div class="sticker blue"><span class="emo">🙅</span><b>${refused}</b><small>kali menolak</small></div>
      <div class="sticker pink"><span class="emo">📒</span><b>${meals.length}</b><small>total catatan</small></div>
    </div>

    <div class="card">
      <div class="title-row"><span class="emo-box">📅</span><h2>Hari ini</h2></div>
      <div class="stat-grid">
        <div class="stat hijau"><b>${count(eaten, "hijau")}</b><span>aman</span></div>
        <div class="stat kuning"><b>${count(eaten, "kuning")}</b><span>dibatasi</span></div>
        <div class="stat merah"><b>${count(eaten, "merah")}</b><span>berisiko</span></div>
      </div>
      <div class="salt">
        <div class="salt-head"><span>🧂 Garam tinggi hari ini</span><b>${saltToday}/${SALT_LIMIT}</b></div>
        <div class="salt-bar">${saltBlocks}</div>
        <p class="small">${saltToday === 0 ? "Belum ada makanan asin hari ini. Mantap, Pa! 👍"
          : saltToday < SALT_LIMIT ? "Masih aman. Makan berikutnya pilih yang tidak asin ya."
          : saltToday === SALT_LIMIT ? "Sudah cukup garamnya hari ini. Sisanya pilih yang hijau. 🥬"
          : "Garam sudah lewat batas. Minum air putih yang banyak dan cek tensi. 💧"}</p>
      </div>
    </div>

    <div class="card">
      <div class="title-row"><span class="emo-box">🗓️</span><h2>7 hari terakhir</h2></div>
      <div class="table-wrap">
        <table class="neo-table">
          <thead><tr><th>Hari</th><th>🟢</th><th>🟡</th><th>🔴</th><th>🧂</th><th>🙅</th></tr></thead>
          <tbody>${days.map((d) => `
            <tr class="${d.today ? "today" : ""}${d.m ? " bad" : ""}">
              <td><b>${d.label}</b> ${d.date}</td>
              <td>${d.h || "·"}</td><td>${d.k || "·"}</td><td>${d.m || "·"}</td>
              <td class="${d.g > SALT_LIMIT ? "warn" : ""}">${d.g || "·"}</td><td>${d.t || "·"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="small muted">🟢 aman · 🟡 dibatasi · 🔴 berisiko · 🧂 tinggi garam · 🙅 berhasil menolak</p>
    </div>

    ${top.length ? `<div class="card">
      <div class="title-row"><span class="emo-box">🏆</span><h2>Paling sering</h2></div>
      ${top.map(([f, n], i) => `
        <div class="rank">
          <span class="rank-no">${i + 1}</span>
          <span class="rank-emo">${foodEmoji(f)}</span>
          <span class="rank-name">${esc(f)}</span>
          <span class="rank-bar"><i style="width:${Math.round((n / maxTop) * 100)}%"></i></span>
          <b>${n}×</b>
        </div>`).join("")}
    </div>` : ""}`;

  const el = $("#meal-list");
  if (!meals.length) {
    el.innerHTML = `<div class="empty-state"><span class="emo-big">🍽️</span><p><b>Belum ada catatan.</b><br>Cek makanan di tab Cek, lalu tekan salah satu tombol di bawah hasilnya.</p></div>`;
    return;
  }
  let html = "", day = "";
  meals.forEach((m) => {
    const d = fmtDay(m.at);
    if (d !== day) { html += `<div class="day-group">${d}</div>`; day = d; }
    const [pe, pl, pc] = PORTION_TAG[m.portion] || ["🍽️", m.portion || "dicatat", ""];
    html += `<div class="meal-row ${esc(m.status)}">
      <span class="meal-emo">${foodEmoji(m.food)}</span>
      <span class="what"><b>${esc(m.food)}</b>
        <span class="meal-tags"><span class="mtag ${pc}">${pe} ${esc(pl)}</span>${m.garam === "tinggi" ? `<span class="mtag salt">🧂 garam tinggi</span>` : ""}${m.purin === "tinggi" ? `<span class="mtag purin">⚠️ purin tinggi</span>` : ""}</span>
      </span>
      <span class="when">${fmtTime(m.at)}</span></div>`;
  });
  el.innerHTML = html;
}

// ---------------------------------------------------------------- kambuh
chips($("#joint-chips"), JOINT_CHIPS, state.joint, (j) => (state.joint = j));

function painFace(n) {
  if (n <= 2) return ["🙂", "ringan"];
  if (n <= 4) return ["😐", "lumayan"];
  if (n <= 6) return ["😣", "sakit"];
  if (n <= 8) return ["😖", "sakit sekali"];
  return ["😭", "tak tertahankan"];
}
function setPainFace(n, emoEl, valEl, wordEl) {
  const [e, w] = painFace(n);
  emoEl.textContent = e; valEl.textContent = n; if (wordEl) wordEl.textContent = w;
}
$("#pain").oninput = (e) => setPainFace(+e.target.value, $("#pain-emo"), $("#pain-val"), $("#pain-word"));

$("#flare-save").onclick = async () => {
  try {
    await api("/api/flares", { joint: state.joint, pain: +$("#pain").value, fever: $("#fever").checked });
    toast("Tercatat. Semoga cepat reda, Pa.");
    state.foods = [];
    loadFlares();
    flareBanner();
  } catch (err) { toast(err.message); }
};

function rangeText(rec) {
  if (!rec.active) return "";
  const [lo, hi] = rec.remaining;
  if (hi <= 0) return "Biasanya sudah mulai reda di titik ini.";
  return lo === 0 || lo === hi ? `Kira-kira ${hi} hari lagi` : `Kira-kira ${lo}–${hi} hari lagi`;
}

const flareDays = (f) => Math.max(1, Math.round((new Date(f.ended) - new Date(f.started)) / 864e5));

// checklist "sambil menunggu" diingat per hari di HP ini saja
const CARE = [["💧", "Minum air putih 8+ gelas"], ["🧊", "Kompres dingin 15–20 menit"], ["🛌", "Istirahatkan & tinggikan sendi"],
              ["🚫", "Hindari jeroan, emping, seafood, alkohol"], ["💊", "Obat sesuai resep dokter saja"]];
function careKey() { return "care-" + new Date().toDateString(); }
function careGet() { try { return JSON.parse(localStorage.getItem(careKey()) || "[]"); } catch { return []; } }
function careSet(v) { try { localStorage.setItem(careKey(), JSON.stringify(v)); } catch {} }

async function loadFlares() {
  const [flares, rv] = await Promise.all([api("/api/flares"), api("/api/review")]);
  const active = flares.find((f) => !f.ended);
  const done = flares.filter((f) => f.ended);
  const rec = rv.recovery;
  const last = flares[0];
  const sinceLast = last ? Math.floor((Date.now() - new Date(last.ended || last.started)) / 864e5) : null;
  const avg = done.length ? (done.reduce((a, f) => a + flareDays(f), 0) / done.length).toFixed(1).replace(".0", "") : "–";

  $("#flare-summary").innerHTML = `
    <div class="sticker-row">
      <div class="sticker ${active ? "pink" : "yellow"}"><span class="emo">${active ? "🤕" : "🗓️"}</span><b>${active ? rec.day : sinceLast ?? "–"}</b><small>${active ? "hari kambuh" : "hari sejak kambuh"}</small></div>
      <div class="sticker blue"><span class="emo">🔁</span><b>${flares.length}</b><small>total kambuh</small></div>
      <div class="sticker pink"><span class="emo">⏱️</span><b>${avg}</b><small>rata-rata hari sembuh</small></div>
    </div>`;

  $("#flare-new").classList.toggle("hidden", !!active);
  if (active) {
    const pains = active.pains || [];
    const [emo, word] = painFace(rec.current_pain);
    const care = careGet();
    const suspects = rv.triggers.suspects.slice(0, 3);
    $("#flare-active").innerHTML = `
      <div class="verdict merah">
        <span class="stamp">Hari ke-${rec.day}</span>
        <div class="food-name">${esc(active.joint)} · ${emo} ${rec.current_pain}/10 ${word}${rec.trend ? ` · ${rec.trend === "membaik" ? "📉 membaik" : rec.trend === "memburuk" ? "📈 memburuk" : "➖ sama"}` : ""}</div>
        <div class="big-num">${rangeText(rec)}</div>
        <p class="small"><b>Estimasi dari ${rec.basis === "riwayat Papa" ? `${rec.history_count} kali kambuh sebelumnya (biasanya ${rec.typical_days} hari)` : "kisaran umum serangan asam urat (3–10 hari). Makin banyak catatan, makin pas untuk Papa"}.</b></p>
      </div>
      ${rec.red_flags.map((f) => `<div class="flag">🚨 ${esc(f)}</div>`).join("")}

      <div class="card">
        <div class="title-row"><span class="emo-box">📉</span><h2>Grafik nyeri</h2></div>
        <div class="pain-chart">${pains.map((p) => `
          <div class="pc-col"><span class="pc-val">${p.pain}</span><i class="${p.pain >= 7 ? "hi" : p.pain >= 4 ? "mid" : "lo"}" style="height:${Math.max(6, p.pain * 10)}%"></i>
          <small>${new Date(p.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</small></div>`).join("")}
        </div>
        <p class="eyebrow">Nyeri hari ini</p>
        <div class="pain-face"><span id="upd-emo">${emo}</span><b id="upd-val">${rec.current_pain}</b><small>/10</small><em id="upd-word">${word}</em></div>
        <input id="upd-pain" type="range" min="0" max="10" value="${rec.current_pain}">
        <label class="check"><input id="upd-fever" type="checkbox"> 🌡️ Ada demam</label>
        <div class="row">
          <button id="upd-save" class="btn">Simpan nyeri</button>
          <button id="upd-end" class="btn good">Sudah sembuh 🎉</button>
        </div>
      </div>

      <div class="card">
        <div class="title-row"><span class="emo-box">✅</span><h2>Sambil menunggu</h2></div>
        <div class="care">${CARE.map(([e, t], i) => `
          <label class="care-item${care.includes(i) ? " on" : ""}"><input type="checkbox" data-care="${i}" ${care.includes(i) ? "checked" : ""}><span class="ce">${e}</span>${t}</label>`).join("")}
        </div>
      </div>

      ${suspects.length ? `<div class="card">
        <div class="title-row"><span class="emo-box">🔎</span><h2>Mungkin pemicunya</h2></div>
        <p class="small muted">Dimakan dalam 48 jam sebelum kambuh:</p>
        <div class="chips">${suspects.map((x) => `<span class="chip">${foodEmoji(x.food)} ${esc(x.food)} · ${x.count}×</span>`).join("")}</div>
      </div>` : ""}`;

    $("#upd-pain").oninput = (e) => setPainFace(+e.target.value, $("#upd-emo"), $("#upd-val"), $("#upd-word"));
    $("#upd-save").onclick = async () => {
      await api(`/api/flares/${active.id}/pain`, { pain: +$("#upd-pain").value, fever: $("#upd-fever").checked });
      toast("Nyeri tercatat");
      loadFlares();
    };
    $("#upd-end").onclick = async () => {
      await api(`/api/flares/${active.id}/end`, {});
      toast("Alhamdulillah, sudah sembuh! 🎉");
      state.foods = [];
      loadFlares();
      flareBanner();
    };
    document.querySelectorAll("[data-care]").forEach((cb) => (cb.onchange = () => {
      const v = new Set(careGet());
      cb.checked ? v.add(+cb.dataset.care) : v.delete(+cb.dataset.care);
      careSet([...v]);
      cb.closest(".care-item").classList.toggle("on", cb.checked);
    }));
  } else {
    $("#flare-active").innerHTML = "";
  }

  $("#flare-list").innerHTML = done.length ? done.map((f) => {
    const days = flareDays(f);
    const [e] = painFace(f.pain);
    return `<div class="meal-row merah">
      <span class="meal-emo">${e}</span>
      <span class="what"><b>${esc(f.joint)}</b>
        <span class="meal-tags"><span class="mtag merah">nyeri ${f.pain}/10</span><span class="mtag biru">⏱️ ${days} hari</span>${f.fever ? `<span class="mtag purin">🌡️ demam</span>` : ""}</span>
      </span>
      <span class="when">${new Date(f.started).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span></div>`;
  }).join("") : `<div class="empty-state"><span class="emo-big">🙏</span><p><b>Belum ada riwayat kambuh.</b><br>Semoga tetap begitu, Pa.</p></div>`;
}

// ---------------------------------------------------------------- review
async function loadReview(withAi = false) {
  const el = $("#review");
  if (!withAi) el.innerHTML = `<div class="card"><p class="muted">Memuat…</p></div>`;
  const rv = await api("/api/review" + (withAi ? "?ai=1" : ""));
  const w = rv.week, t = rv.triggers, rec = rv.recovery;
  el.innerHTML = `
    <div class="card">
      <h2>7 hari terakhir</h2>
      <div class="stat-grid">
        <div class="stat hijau"><b>${w.status.hijau}</b><span>aman / tolak</span></div>
        <div class="stat kuning"><b>${w.status.kuning}</b><span>dibatasi</span></div>
        <div class="stat merah"><b>${w.status.merah}</b><span>berisiko</span></div>
      </div>
      <p><b>${w.garam_tinggi} dari ${w.meals}</b> makanan tinggi garam — penting untuk tensi Papa.</p>
    </div>
    <div class="card">
      <h2>Tersangka pemicu</h2>
      ${t.suspects.length ? `<p class="muted small">Dimakan dalam 48 jam sebelum ${t.flares} kali kambuh:</p>
        ${t.suspects.map((s) => `<div class="meal"><span class="what"><b>${esc(s.food)}</b></span><span class="when">${s.count}×</span></div>`).join("")}`
        : `<p class="muted">Belum cukup data. Catat makan & kambuh, nanti polanya kelihatan.</p>`}
    </div>
    <div class="card">
      <h2>Lama sembuh</h2>
      <p>${rec.basis === "riwayat Papa"
        ? `Dari ${rec.history_count} kali kambuh, Papa biasanya pulih dalam <b>${rec.typical_days} hari</b> (${rec.range[0]}–${rec.range[1]} hari).`
        : `Belum ada riwayat. Kisaran umum serangan asam urat: <b>3–10 hari</b>.`}</p>
      ${rec.active ? `<p><b>Sekarang:</b> hari ke-${rec.day}. ${rangeText(rec)}.</p>` : ""}
    </div>
    <div class="card">
      <h2>Kata Gemma</h2>
      ${rv.summary ? `<div class="ai-summary">${esc(rv.summary)}</div>
        <div class="row" style="margin-top:14px"><button class="btn sm" id="say-sum">Bacakan</button></div>`
        : `<button class="btn primary" id="ask-ai">Minta ringkasan minggu ini</button>`}
    </div>`;
  const ask = $("#ask-ai");
  if (ask) ask.onclick = async () => { ask.disabled = true; ask.textContent = "Gemma lagi menulis…"; await loadReview(true); };
  const say = $("#say-sum");
  if (say) say.onclick = () => speak(rv.summary);
}

// ---------------------------------------------------------------- init
chips($("#food-chips"), FOOD_CHIPS, undefined, (f) => { $("#food").value = f; clearResult(); }, false);
chips($("#note-chips"), NOTE_CHIPS, state.note, (n) => (state.note = n));
fetchFoods().then((foods) => {
  $("#food-names").innerHTML = foods.flatMap((f) => [f.name, ...f.aliases]).map((n) => `<option value="${esc(n)}">`).join("");
}).catch(() => {});
health();
flareBanner();
setInterval(health, 30000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
