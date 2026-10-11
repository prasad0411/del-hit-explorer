import { describe, expect, it } from 'vitest';
import { filterHits, pearson, toCsv } from '../hits';
import type { Hit } from '../types';

const hit = (rank: number, over: Partial<Hit> = {}): Hit => ({
  target: 'BRD4', rank, compound: `CMP-${rank}`, barcode: 'ACGTACGTACGT', bb1: 'BB1-03', bb2: 'BB2-01', bb3: 'BB3-01',
  target_rpm: 1000, control_rpm: 100, log2_r1: 3, log2_r2: 3, min_log2: 3, ...over,
});

describe('filterHits', () => {
  const hits = [hit(2, { min_log2: 0.5 }), hit(1), hit(3, { target: 'KRAS', bb2: 'BB2-11' })];

  it('keeps one target, applies the fold threshold and sorts by rank', () => {
    expect(filterHits(hits, { target: 'BRD4', q: '', minLog2: 0 }).map((h) => h.rank)).toEqual([1, 2]);
    expect(filterHits(hits, { target: 'BRD4', q: '', minLog2: 1 }).map((h) => h.rank)).toEqual([1]);
  });

  it('searches compounds, building blocks and barcodes, ignoring case', () => {
    expect(filterHits(hits, { target: 'KRAS', q: 'bb2-11', minLog2: 0 })).toHaveLength(1);
    expect(filterHits(hits, { target: 'BRD4', q: 'cmp-2', minLog2: 0 }).map((h) => h.rank)).toEqual([2]);
    expect(filterHits(hits, { target: 'BRD4', q: 'nothing', minLog2: 0 })).toEqual([]);
  });
});

describe('pearson', () => {
  it('is 1 for a perfect line, -1 for an inverse one, 0 for too few points', () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1);
    expect(pearson([[1, 3], [2, 2], [3, 1]])).toBeCloseTo(-1);
    expect(pearson([[1, 1]])).toBe(0);
  });
});

describe('toCsv', () => {
  it('writes a header and one row per hit, quoting cells that need it', () => {
    const csv = toCsv([hit(1, { compound: 'CMP, "special"' })]);
    const [header, row] = csv.trim().split('\n');
    expect(header.split(',')).toHaveLength(12);
    expect(row).toContain('"CMP, ""special"""');
    expect(csv.endsWith('\n')).toBe(true);
  });
});
