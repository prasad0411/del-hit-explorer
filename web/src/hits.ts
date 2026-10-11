import type { Hit } from './types';

export interface HitQuery { target: string; q: string; minLog2: number }

/** Hits for one target that match the search and pass the fold change threshold, best first. */
export function filterHits(hits: Hit[], { target, q, minLog2 }: HitQuery): Hit[] {
  const term = q.trim().toLowerCase();
  return hits
    .filter((h) => h.target === target && h.min_log2 >= minLog2)
    .filter((h) => !term || [h.compound, h.bb1, h.bb2, h.bb3, h.barcode].some((v) => v.toLowerCase().includes(term)))
    .sort((a, b) => a.rank - b.rank);
}

/** Pearson correlation, used to check that replicates agree. */
export function pearson(points: [number, number][]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

const CSV_COLUMNS: (keyof Hit)[] = [
  'target', 'rank', 'compound', 'barcode', 'bb1', 'bb2', 'bb3',
  'target_rpm', 'control_rpm', 'log2_r1', 'log2_r2', 'min_log2',
];

/** The filtered hits as CSV, ready for Excel or a chemist's own analysis. */
export function toCsv(hits: Hit[]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = hits.map((h) => CSV_COLUMNS.map((c) => cell(h[c])).join(','));
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** Saves text as a file in the browser. */
export function downloadText(filename: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
