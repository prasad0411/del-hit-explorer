export interface SampleQC {
  sample: string;
  reads: number;
  passed_quality: number;
  barcode_found: number;
  matched: number;
  corrected: number;
}

export interface Sample { sample: string; target: string; type: 'target' | 'control'; replicate: number; fastq: string }

export interface Summary {
  samples: Sample[];
  library_size: number;
  reads: number;
  passed_quality: number;
  barcode_found: number;
  matched: number;
  corrected: number;
  qc: SampleQC[];
  targets: string[];
  settings: { min_quality: number; primer: string; barcode_length: number; pseudocount: number; min_target_rpm: number };
}

export interface Hit {
  target: string;
  rank: number;
  compound: string;
  barcode: string;
  bb1: string;
  bb2: string;
  bb3: string;
  target_rpm: number;
  control_rpm: number;
  log2_r1: number;
  log2_r2: number;
  min_log2: number;
}

export interface BuildingBlock {
  target: string;
  position: 'bb1' | 'bb2' | 'bb3';
  building_block: string;
  hit_share: number;
  library_share: number;
  fold: number;
}

export type Replicates = Record<string, { r1: string; r2: string; pearson: number; points: [number, number][] }>;
