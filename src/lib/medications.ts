/**
 * Interaksi makanan × obat yang umum pada lansia. Sumber di docs/SUMBER-GIZI.md:
 * FDA (jeruk bali), NIH ODS (vitamin K & warfarin), label FDA metformin, panduan hipoglikemia sulfonilurea.
 * Aplikasi hanya MENGINGATKAN; keputusan tetap pada dokter.
 */
import type { Status } from "./foods/types";

export type MedId = "statin" | "amlodipin" | "warfarin" | "antiplatelet" | "metformin" | "sulfonilurea" | "insulin" | "allopurinol";

export const MEDICATIONS: { id: MedId; label: string; contoh: string }[] = [
  { id: "statin", label: "Obat kolesterol (statin)", contoh: "simvastatin, atorvastatin, rosuvastatin" },
  { id: "amlodipin", label: "Obat tensi golongan CCB", contoh: "amlodipin, nifedipin, felodipin" },
  { id: "warfarin", label: "Pengencer darah warfarin", contoh: "warfarin, Simarc" },
  { id: "antiplatelet", label: "Obat antiplatelet", contoh: "aspirin/aspilet, clopidogrel" },
  { id: "metformin", label: "Metformin", contoh: "metformin, Glucophage" },
  { id: "sulfonilurea", label: "Obat diabetes sulfonilurea", contoh: "glibenklamid, glimepirid, gliklazid" },
  { id: "insulin", label: "Insulin", contoh: "suntikan insulin" },
  { id: "allopurinol", label: "Obat asam urat", contoh: "allopurinol" },
];

const ALCOHOL = new Set(["bir"]);
const GRAPEFRUIT = new Set(["jeruk bali"]);
// Sayuran hijau tinggi vitamin K (bukan dilarang: jumlahnya harus konsisten untuk pengguna warfarin)
const VITAMIN_K = new Set([
  "bayam", "tumis kangkung", "brokoli", "daun singkong", "daun pepaya", "sawi", "selada", "kemangi", "asparagus",
  "daun melinjo", "lalapan", "kol", "kembang kol", "pakis", "genjer", "urap", "pecel", "gado-gado", "lotek",
]);

export interface MedReason { med: MedId; status: Status; text: string }

export function medicationReasons(food: { name: string }, meds: string[]): MedReason[] {
  const out: MedReason[] = [];
  const has = (m: MedId) => meds.includes(m);
  const n = food.name;
  if (GRAPEFRUIT.has(n)) {
    if (has("statin")) out.push({ med: "statin", status: "merah", text: "jeruk bali bisa menaikkan kadar obat statin (risiko nyeri/kerusakan otot) — hindari, tanya dokter" });
    if (has("amlodipin")) out.push({ med: "amlodipin", status: "kuning", text: "jeruk bali bisa menaikkan kadar obat tensi CCB (terutama felodipin/nifedipin) — tanya dokter" });
  }
  if (ALCOHOL.has(n)) {
    if (has("warfarin")) out.push({ med: "warfarin", status: "merah", text: "alkohol mengganggu kerja warfarin dan menambah risiko perdarahan" });
    if (has("antiplatelet")) out.push({ med: "antiplatelet", status: "merah", text: "alkohol menambah risiko perdarahan lambung bersama obat antiplatelet" });
    if (has("metformin")) out.push({ med: "metformin", status: "merah", text: "alkohol bersama metformin berisiko asidosis laktat & gula darah rendah" });
    if (has("sulfonilurea") || has("insulin")) out.push({ med: has("insulin") ? "insulin" : "sulfonilurea", status: "merah", text: "alkohol bisa menyebabkan gula darah sangat rendah bersama obat ini" });
    if (has("allopurinol")) out.push({ med: "allopurinol", status: "kuning", text: "alkohol (terutama bir) melawan kerja obat asam urat" });
  }
  if (VITAMIN_K.has(n) && has("warfarin")) {
    out.push({ med: "warfarin", status: "kuning", text: "tinggi vitamin K: boleh, tapi jumlahnya harus konsisten setiap hari (jangan tiba-tiba banyak/sedikit)" });
  }
  return out;
}
