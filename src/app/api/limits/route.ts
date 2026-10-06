import { NUDGE_GAP_HOURS } from "@/lib/family";
import { budgetReached, requireUser, route, usageToday } from "@/lib/server";

/** Batas pemakaian harian untuk ditampilkan di aplikasi (jatah AI, jeda bel). Reset tiap 00.00 WIB. */
export const GET = route(async () => {
  const user = await requireUser();
  const [usage, budget] = await Promise.all([usageToday(user.id), budgetReached()]);
  return { usage, budgetReached: budget, nudgeGapHours: NUDGE_GAP_HOURS };
});
