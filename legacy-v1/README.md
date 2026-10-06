# Boleh Gak, Pa? 🍽️

*"Is this okay, Dad?"*: a pocket food buddy for my dad, who has **gout and high blood pressure**.

A friend hands him a plate of *ketoprak*. He doesn't want to be rude, he doesn't know how much is safe, and nobody tracks what happens next. This PWA answers in one screen:

- 🚦 **Traffic light**: decided by a curated table of Indonesian street food (purine + salt), not by the model
- 🍽️ **Safe portion** and on-the-spot tricks ("ask for the peanut sauce on the side")
- 🙏 **Polite ways to say no** that he can read out loud or copy (one in Sundanese)
- ⚠️ **What happens if he eats it all anyway**: honest, not scary
- ➕ **Family food list**: add a dish (e.g. *nasi tutug oncom*) with its ingredients, Gemma proposes purine/salt/portion calibrated against similar rows in the table, a human reviews and saves it
- 📒 **Meal log**, 🦶 **flare log** (joint, pain 1–10, fever), and 📈 **weekly review** with suspected triggers and a recovery estimate based on *his own* history

Everything runs on our laptop: **Gemma 3 via Ollama**, a stdlib-only Python server, and SQLite. No cloud, no account, no subscription.

## Run it

```bash
# 1. Local model (open weights)
ollama pull gemma3:4b      # sees photos; or gemma3:1b for text-only on slow machines

# 2. App (Python 3.9+, no pip install needed)
python3 server.py
# → http://localhost:8787  (install it as a PWA from the browser menu)
```

To use it from a phone on the same Wi-Fi, open `http://<laptop-ip>:8787`. Installing it as a PWA on a phone needs HTTPS, e.g. through a tunnel such as `cloudflared tunnel --url http://localhost:8787`.

The server picks the best installed model automatically (`MODELS=gemma3:4b,gemma3:1b`). If no model is available, it falls back to answers from the table alone, so the app still works.

## How it works

```
photo ──► Gemma 3 4B (vision) ──► "ketoprak?" ──► Papa confirms
                                                   │
foods.json (purine, salt, tricks) ──► rule ──► 🟡 traffic light (source of truth)
                                                   │
profile + table row + active flare + today's meals ─► Gemma ─► JSON (portion, tips,
                                                                refusals, if_forced, why)
```

- **Table decides, model writes.** The traffic light comes from `data/foods.json` so it is consistent and auditable. Gemma turns it into warm, short Bahasa Indonesia that a 60-year-old can read.
- **Structured output.** Ollama's JSON-schema `format` keeps a small model on the rails.
- **Context-aware.** If a flare is active, the rules get stricter, and today's meals are passed in, so a second salty meal gets flagged.
- **Recovery estimate.** The estimate uses the median of Papa's past flare durations, falling back to a general 3–10 day range. Red flags (more than 7 days, pain of 8+, fever, worsening) always say "see a doctor".
- **Trigger analysis.** Foods eaten in the 48 hours before each flare are counted as suspects.

## Files

| Path | What |
|---|---|
| `server.py` | HTTP server, Ollama calls, rules, logs, review |
| `data/foods.json` | 271 foods & drinks (823 names/aliases, 16 categories: street food, fruit, vegetables, pizza, ramen…) with purine & salt levels — generated from `tools/build_foods.py` |
| `data/profile.json` | Papa's profile (edit for your own family member) |
| `public/` | PWA: `index.html`, `app.js`, `style.css`, `sw.js`, manifest, icons |

> ⚕️ Not medical advice. The food table is a simplified summary of common low-purine / low-salt guidance. Always follow your doctor.

## Credits

Gemma 3 (Google DeepMind, open weights) · Ollama (MIT) · Archivo Black & Space Grotesk (SIL OFL).

Built from scratch for the DEV Hacktoberfest Weekend Challenge: Build for a Friend (Oct 2–5, 2026). Any commits after the submission deadline will be listed here.

License: MIT
