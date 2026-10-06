// Kunci perangkat = kode pemulihan. 120 bit acak, ditulis dengan alfabet Crockford Base32
// (tanpa I, L, O, U supaya tidak tertukar saat diketik ulang), dikelompokkan 4-4: K7QF-2M9X-...
import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateKey(): string {
  const bytes = randomBytes(15);
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out; // 24 karakter
}

/** Rapikan input pengguna: huruf besar, buang pemisah, samakan huruf yang mirip angka. */
export function normalizeKey(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
}

export const isValidKey = (k: string) => /^[0-9A-HJKMNP-TV-Z]{24}$/.test(k);

export const formatKey = (k: string) => k.match(/.{1,4}/g)!.join("-");

export const hashKey = (k: string) => createHash("sha256").update(`boleh-gak-ya:${k}`).digest("hex");
