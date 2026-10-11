import { describe, expect, it } from 'vitest';
import { qcSegments } from '../qc';

describe('qcSegments', () => {
  it('splits every read into four shares that add up to one', () => {
    const segs = qcSegments({ sample: 'S1', reads: 1000, passed_quality: 900, barcode_found: 880, matched: 870, corrected: 20 });
    expect(segs.map((s) => s.key)).toEqual(['matched', 'unmatched', 'noprimer', 'lowq']);
    expect(segs.map((s) => s.share)).toEqual([0.87, 0.01, 0.02, 0.1]);
    expect(segs.reduce((n, s) => n + s.share, 0)).toBeCloseTo(1);
  });

  it('never divides by zero for an empty sample', () => {
    expect(qcSegments({ sample: 'S0', reads: 0, passed_quality: 0, barcode_found: 0, matched: 0, corrected: 0 }).every((s) => s.share === 0)).toBe(true);
  });
});
