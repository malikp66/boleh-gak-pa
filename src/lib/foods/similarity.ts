/**
 * Port kecil dari difflib.SequenceMatcher.ratio() (Ratcliff/Obershelp) milik Python,
 * supaya pencocokan salah ketik di v2 berperilaku sama dengan v1.
 */
function longestMatch(a: string, b: string, alo: number, ahi: number, blo: number, bhi: number) {
  let besti = alo, bestj = blo, bestsize = 0;
  let j2len = new Map<number, number>();
  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>();
    for (let j = blo; j < bhi; j++) {
      if (a[i] !== b[j]) continue;
      const k = (j2len.get(j - 1) ?? 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) {
        besti = i - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return { i: besti, j: bestj, size: bestsize };
}

function matchingChars(a: string, b: string): number {
  let total = 0;
  const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const m = longestMatch(a, b, alo, ahi, blo, bhi);
    if (m.size) {
      total += m.size;
      if (alo < m.i && blo < m.j) queue.push([alo, m.i, blo, m.j]);
      if (m.i + m.size < ahi && m.j + m.size < bhi) queue.push([m.i + m.size, ahi, m.j + m.size, bhi]);
    }
  }
  return total;
}

export function ratio(a: string, b: string): number {
  const len = a.length + b.length;
  return len ? (2 * matchingChars(a, b)) / len : 1;
}

/** Setara difflib.get_close_matches(word, candidates, n=1, cutoff). */
export function closestMatch(word: string, candidates: Iterable<string>, cutoff = 0.84): string | null {
  let best: string | null = null;
  let bestScore = cutoff;
  for (const c of candidates) {
    const s = ratio(word, c);
    if (s > bestScore || (s === bestScore && best === null)) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}
