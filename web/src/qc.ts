import type { SampleQC } from './types';

export interface QcSegment { key: string; label: string; share: number }

/** Where every read in a sample ended up. The four shares always add up to 1. */
export function qcSegments(q: SampleQC): QcSegment[] {
  const total = q.reads || 1;
  return [
    { key: 'matched', label: 'Matched to the library', share: q.matched / total },
    { key: 'unmatched', label: 'Barcode not in the library', share: (q.barcode_found - q.matched) / total },
    { key: 'noprimer', label: 'No primer found', share: (q.passed_quality - q.barcode_found) / total },
    { key: 'lowq', label: 'Failed quality', share: (q.reads - q.passed_quality) / total },
  ];
}
