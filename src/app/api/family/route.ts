import { familyStatus } from "@/lib/family";
import { requireUser, route } from "@/lib/server";

/** Status mencatat hari ini untuk semua orang di keluarga. */
export const GET = route(async () => familyStatus((await requireUser()).id));
