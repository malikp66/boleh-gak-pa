import { recoveryCode, route } from "@/lib/server";

export const GET = route(async () => ({ code: await recoveryCode() }));
