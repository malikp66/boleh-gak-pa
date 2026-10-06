import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { PushRow, sendPush } from "@/lib/push";
import { conditionInfo, normalizeConditions } from "@/lib/conditions";
import { familyAlerts } from "@/lib/family";

/**
 * Dipanggil Vercel Cron (lihat vercel.json): slot=pagi 07.00 WIB, slot=malam 19.00 WIB,
 * slot=keluarga 21.00 WIB (kabari keluarga kalau ada yang belum mencatat).
 * Vercel mengirim header Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const param = new URL(req.url).searchParams.get("slot");
  if (param === "keluarga") return NextResponse.json({ slot: param, sent: await familyAlerts() });
  const slot = param === "malam" ? "malam" : "pagi";
  const rows = await q<PushRow & { panggilan: string | null; kondisi: string[] | null }>(
    `select s.id, s.endpoint, s.p256dh, s.auth, p.panggilan, p.kondisi
     from push_subscriptions s left join profiles p on p.id = s.profile_id
     where s.${slot === "pagi" ? "pagi" : "malam"} = true`,
  );
  let sent = 0;
  for (const r of rows) {
    const conds = normalizeConditions(r.kondisi ?? []);
    const monitors = conds.map((c) => conditionInfo(c)?.monitor).filter(Boolean);
    const sapa = r.panggilan && r.panggilan !== "kamu" ? `, ${r.panggilan}` : "";
    const body = slot === "pagi"
      ? monitors.includes("gula_darah") ? `Selamat pagi${sapa}! Sudah cek gula darah puasa? Catat di tab Pantau ya.`
        : monitors.includes("tensi") ? `Selamat pagi${sapa}! Sudah ukur tensi pagi ini? Catat di tab Pantau ya.`
        : `Selamat pagi${sapa}! Mau makan apa hari ini? Cek dulu sebelum makan ya.`
      : `Malam${sapa}! Sudah catat makan hari ini? Biar ringkasannya makin pas.`;
    if (await sendPush(r, { title: "Boleh Gak, Ya?", body, url: slot === "pagi" && monitors.length ? "/?tab=pantau" : "/?tab=catatan", tag: `pengingat-${slot}` })) sent++;
  }
  return NextResponse.json({ slot, total: rows.length, sent });
}
