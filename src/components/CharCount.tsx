/** Penghitung huruf yang baru muncul mendekati batas (80%), supaya kolom tetap bersih. */
export default function CharCount({ value, max }: { value: string; max: number }) {
  if (value.length < max * 0.8) return null;
  return <span className={`char-count${value.length >= max ? " full" : ""}`}>{value.length}/{max}</span>;
}
