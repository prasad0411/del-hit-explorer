"""Synthetic DEL screen: a library FASTA and one FASTQ file per sample, with a known planted signal.

Real DEL data is proprietary, so this generates realistic data with known answers:
building block BB1-03 and BB1-07 compounds bind BRD4, and BB2-11 compounds bind KRAS.
Reads include sequencing errors, low quality reads and reads without the primer.
"""
from __future__ import annotations

import gzip
import random
from pathlib import Path

import numpy as np

from delx.barcodes import BASES, hamming
from delx.pipeline import BARCODE_LEN, PRIMER

SAMPLES = [("BRD4_R1", "BRD4", "target", 1), ("BRD4_R2", "BRD4", "target", 2),
           ("KRAS_R1", "KRAS", "target", 1), ("KRAS_R2", "KRAS", "target", 2),
           ("NTC_R1", "none", "control", 1), ("NTC_R2", "none", "control", 2)]


def _barcodes(n: int, rng: random.Random, min_distance: int = 3) -> list[str]:
    out: list[str] = []
    while len(out) < n:
        bc = "".join(rng.choice(BASES) for _ in range(BARCODE_LEN))
        if all(hamming(bc, o) >= min_distance for o in out):
            out.append(bc)
    return out


def _quality(n: int, rng: random.Random, good: bool) -> str:
    pool = "IIIIHHGF" if good else "#$%&'()*"
    return "".join(rng.choice(pool) for _ in range(n))


def generate(out_dir: str | Path, compounds: int = 400, reads_per_sample: int = 12000, seed: int = 7) -> None:
    rng = random.Random(seed)
    nprng = np.random.default_rng(seed)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    barcodes = _barcodes(compounds, rng)
    bb1 = [f"BB1-{rng.randint(1, 15):02d}" for _ in range(compounds)]
    bb2 = [f"BB2-{rng.randint(1, 20):02d}" for _ in range(compounds)]
    bb3 = [f"BB3-{rng.randint(1, 10):02d}" for _ in range(compounds)]
    with open(out / "library.fasta", "w") as f:
        for i, bc in enumerate(barcodes):
            f.write(f">CMP-{i + 1:04d} bb1={bb1[i]} bb2={bb2[i]} bb3={bb3[i]}\n{bc[:6]}\n{bc[6:]}\n")

    brd4 = {i for i in range(compounds) if bb1[i] in ("BB1-03", "BB1-07") and rng.random() < 0.8}
    kras = {i for i in range(compounds) if bb2[i] == "BB2-11" and rng.random() < 0.8}
    abundance = nprng.gamma(2.0, 1.0, compounds)

    with open(out / "samples.csv", "w") as f:
        f.write("sample,target,type,replicate,fastq\n")
        for name, target, kind, rep in SAMPLES:
            f.write(f"{name},{target},{kind},{rep},{name}.fastq.gz\n")
            weights = abundance * nprng.lognormal(0, 0.2, compounds)
            for i in range(compounds):
                if target == "BRD4" and i in brd4:
                    weights[i] *= 20
                if target == "KRAS" and i in kras:
                    weights[i] *= 15
            picks = nprng.choice(compounds, size=reads_per_sample, p=weights / weights.sum())
            with gzip.open(out / f"{name}.fastq.gz", "wt") as fq:
                for n, idx in enumerate(picks):
                    bc = barcodes[idx]
                    roll = rng.random()
                    if roll < 0.03:
                        pos = rng.randrange(BARCODE_LEN)
                        bc = bc[:pos] + rng.choice([b for b in BASES if b != bc[pos]]) + bc[pos + 1:]
                    umi = "".join(rng.choice(BASES) for _ in range(4))
                    seq = umi + (PRIMER if roll > 0.01 else "GGGGGG") + bc + "TTGCAG"
                    qual = _quality(len(seq), rng, good=rng.random() > 0.08)
                    fq.write(f"@{name}_{n + 1}\n{seq}\n+\n{qual}\n")
