"""Reads to hits: quality filter, barcode counting, normalisation, enrichment and summaries."""
from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from delx.barcodes import BarcodeMatcher, extract_barcode
from delx.fastx import mean_phred, read_fasta, read_fastq

PRIMER = "AGCTAG"
BARCODE_LEN = 12
MIN_QUALITY = 30
PSEUDOCOUNT = 1.0


@dataclass
class SampleQC:
    sample: str
    reads: int = 0
    passed_quality: int = 0
    barcode_found: int = 0
    matched: int = 0
    corrected: int = 0


def load_library(fasta: str | Path) -> pd.DataFrame:
    """Library FASTA headers look like: CMP-0001 bb1=BB1-03 bb2=BB2-11 bb3=BB3-02."""
    rows = []
    for header, seq in read_fasta(fasta):
        compound, *fields = header.split()
        row = {"compound": compound, "barcode": seq}
        row.update(dict(f.split("=", 1) for f in fields))
        rows.append(row)
    lib = pd.DataFrame(rows)
    if lib["barcode"].duplicated().any():
        raise ValueError("library contains duplicate barcodes")
    return lib


def count_sample(fastq: str | Path, name: str, matcher: BarcodeMatcher,
                 min_quality: float = MIN_QUALITY) -> tuple[Counter, SampleQC]:
    """Stream one sample's reads and count reads per library barcode."""
    counts: Counter = Counter()
    qc = SampleQC(name)
    for _, seq, qual in read_fastq(fastq):
        qc.reads += 1
        if mean_phred(qual) < min_quality:
            continue
        qc.passed_quality += 1
        barcode = extract_barcode(seq, PRIMER, BARCODE_LEN)
        if barcode is None:
            continue
        qc.barcode_found += 1
        hit = matcher.match(barcode)
        if hit is None:
            continue
        qc.matched += 1
        qc.corrected += hit[1]
        counts[hit[0]] += 1
    return counts, qc


def enrichment(counts: pd.DataFrame, samples: pd.DataFrame, library: pd.DataFrame,
               min_target_rpm: float = 50.0) -> pd.DataFrame:
    """Per target and barcode: reads per million per replicate, log2 fold over the mean control,
    and the minimum fold across replicates, so a hit must be enriched in every replicate."""
    c = counts.merge(samples[["sample", "target", "type", "replicate"]], on="sample", validate="many_to_one")
    c["rpm"] = c["reads"] / c.groupby("sample")["reads"].transform("sum") * 1e6
    wide = c.pivot_table(index="barcode", columns="sample", values="rpm", aggfunc="sum", fill_value=0.0)
    control_samples = samples.loc[samples["type"] == "control", "sample"].tolist()
    control = wide[control_samples].mean(axis=1)
    out = []
    for target, grp in samples[samples["type"] == "target"].groupby("target"):
        reps = grp.sort_values("replicate")["sample"].tolist()
        folds = np.log2((wide[reps] + PSEUDOCOUNT).div(control + PSEUDOCOUNT, axis=0))
        df = pd.DataFrame({
            "target": target,
            "barcode": wide.index,
            "target_rpm": wide[reps].mean(axis=1).values,
            "control_rpm": control.values,
            "log2_r1": folds[reps[0]].values,
            "log2_r2": folds[reps[-1]].values,
            "min_log2": folds.min(axis=1).values,
        })
        out.append(df[df["target_rpm"] >= min_target_rpm])
    hits = pd.concat(out, ignore_index=True).merge(library, on="barcode", how="left", validate="many_to_one")
    hits = hits.sort_values(["target", "min_log2"], ascending=[True, False]).reset_index(drop=True)
    hits["rank"] = hits.groupby("target").cumcount() + 1
    return hits


def building_block_enrichment(hits: pd.DataFrame, library: pd.DataFrame, top_n: int = 25) -> pd.DataFrame:
    """For each target and position, how over represented each building block is in the top hits."""
    rows = []
    for target, grp in hits.groupby("target"):
        top = grp.nsmallest(top_n, "rank")
        for pos in ("bb1", "bb2", "bb3"):
            hit_share = top[pos].value_counts(normalize=True)
            lib_share = library[pos].value_counts(normalize=True)
            for bb, share in hit_share.items():
                rows.append({"target": target, "position": pos, "building_block": bb,
                             "hit_share": round(float(share), 4), "library_share": round(float(lib_share[bb]), 4),
                             "fold": round(float(share / lib_share[bb]), 2)})
    return pd.DataFrame(rows).sort_values(["target", "position", "fold"], ascending=[True, True, False])


def replicate_points(counts: pd.DataFrame, samples: pd.DataFrame) -> dict:
    """log10 reads per million for replicate 1 against replicate 2, per target, plus the correlation."""
    c = counts.copy()
    c["rpm"] = c["reads"] / c.groupby("sample")["reads"].transform("sum") * 1e6
    wide = c.pivot_table(index="barcode", columns="sample", values="rpm", fill_value=0.0)
    out = {}
    for target, grp in samples[samples["type"] == "target"].groupby("target"):
        r1, r2 = grp.sort_values("replicate")["sample"].tolist()[:2]
        x, y = np.log10(wide[r1] + 1), np.log10(wide[r2] + 1)
        out[target] = {"r1": r1, "r2": r2, "pearson": round(float(np.corrcoef(x, y)[0, 1]), 3),
                       "points": [[round(float(a), 3), round(float(b), 3)] for a, b in zip(x, y)]}
    return out


def run(samples_csv: str | Path, library_fasta: str | Path, out_dir: str | Path) -> dict:
    samples_csv = Path(samples_csv)
    samples = pd.read_csv(samples_csv)
    library = load_library(library_fasta)
    matcher = BarcodeMatcher(library["barcode"].tolist())

    frames, qcs = [], []
    for row in samples.itertuples():
        counts, qc = count_sample(samples_csv.parent / row.fastq, row.sample, matcher)
        frames.append(pd.DataFrame({"sample": row.sample, "barcode": list(counts), "reads": list(counts.values())}))
        qcs.append(asdict(qc))
    counts = pd.concat(frames, ignore_index=True)

    hits = enrichment(counts, samples, library)
    bbs = building_block_enrichment(hits, library)
    reps = replicate_points(counts, samples)
    qc = pd.DataFrame(qcs)
    summary = {
        "samples": samples.to_dict(orient="records"),
        "library_size": int(len(library)),
        "reads": int(qc["reads"].sum()),
        "passed_quality": int(qc["passed_quality"].sum()),
        "barcode_found": int(qc["barcode_found"].sum()),
        "matched": int(qc["matched"].sum()),
        "corrected": int(qc["corrected"].sum()),
        "qc": qcs,
        "targets": sorted(hits["target"].unique().tolist()),
        "settings": {"min_quality": MIN_QUALITY, "primer": PRIMER, "barcode_length": BARCODE_LEN,
                     "pseudocount": PSEUDOCOUNT, "min_target_rpm": 50.0},
    }

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    cols = ["target", "rank", "compound", "barcode", "bb1", "bb2", "bb3", "target_rpm", "control_rpm",
            "log2_r1", "log2_r2", "min_log2"]
    (out / "hits.json").write_text(hits[cols].round(3).to_json(orient="records"))
    (out / "building_blocks.json").write_text(bbs.to_json(orient="records"))
    (out / "replicates.json").write_text(json.dumps(reps))
    (out / "summary.json").write_text(json.dumps(summary))
    return summary
