"""Scale benchmark: how fast the pipeline runs as reads grow, and whether memory stays flat.

Each size runs in a fresh process, so peak memory is measured for that run alone.
Usage: python -m delx bench 1000000 5000000 --out docs/benchmark.json
"""
from __future__ import annotations

import gzip
import json
import platform
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

from delx.pipeline import PRIMER
from delx.synth import SAMPLES, _barcodes

_CHILD = """
import json, resource, sys, time
from delx import pipeline
t = time.perf_counter()
s = pipeline.run(sys.argv[1], sys.argv[2], sys.argv[3])
secs = time.perf_counter() - t
peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
peak_mb = peak / 1e6 if sys.platform == "darwin" else peak / 1024
print(json.dumps({"seconds": secs, "peak_mb": peak_mb, "reads": s["reads"], "matched": s["matched"]}))
"""


def write_screen(out: Path, total_reads: int, compounds: int = 400, seed: int = 11) -> None:
    """A fast, vectorised version of the synthetic screen, for large read counts."""
    import random
    rng = np.random.default_rng(seed)
    barcodes = _barcodes(compounds, random.Random(seed))
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "library.fasta", "w") as f:
        for i, bc in enumerate(barcodes):
            f.write(f">CMP-{i + 1:04d} bb1=BB1-01 bb2=BB2-01 bb3=BB3-01\n{bc}\n")
    good = ["".join(rng.choice(list("IIIIHHGF"), 28)) for _ in range(64)]
    bad = ["".join(rng.choice(list("#$%&'()*"), 28)) for _ in range(64)]
    umis = ["".join(rng.choice(list("ACGT"), 4)) for _ in range(256)]
    per_sample = total_reads // len(SAMPLES)
    with open(out / "samples.csv", "w") as f:
        f.write("sample,target,type,replicate,fastq\n")
        for name, target, kind, rep in SAMPLES:
            f.write(f"{name},{target},{kind},{rep},{name}.fastq.gz\n")
            picks = rng.integers(0, compounds, per_sample)
            low = rng.random(per_sample) < 0.08
            umi = rng.integers(0, 256, per_sample)
            qi = rng.integers(0, 64, per_sample)
            with gzip.open(out / f"{name}.fastq.gz", "wt", compresslevel=1) as fq:
                lines = []
                for n in range(per_sample):
                    seq = umis[umi[n]] + PRIMER + barcodes[picks[n]] + "TTGCAG"
                    qual = (bad if low[n] else good)[qi[n]]
                    lines.append(f"@{name}_{n}\n{seq}\n+\n{qual}\n")
                    if len(lines) == 50000:
                        fq.write("".join(lines))
                        lines = []
                fq.write("".join(lines))


def run(sizes: list[int], out_json: str | Path) -> list[dict]:
    results = []
    for size in sizes:
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / "data"
            t = time.perf_counter()
            write_screen(data, size)
            gen = time.perf_counter() - t
            fq_mb = sum(p.stat().st_size for p in data.glob("*.fastq.gz")) / 1e6
            proc = subprocess.run([sys.executable, "-c", _CHILD, str(data / "samples.csv"), str(data / "library.fasta"),
                                   str(Path(tmp) / "out")], capture_output=True, text=True, check=True)
            r = json.loads(proc.stdout.strip().splitlines()[-1])
            row = {"reads": r["reads"], "fastq_gz_mb": round(fq_mb, 1), "seconds": round(r["seconds"], 1),
                   "reads_per_second": int(r["reads"] / r["seconds"]), "peak_memory_mb": round(r["peak_mb"], 1),
                   "generate_seconds": round(gen, 1)}
            print(json.dumps(row))
            results.append(row)
    report = {"platform": f"{platform.system()} {platform.machine()}, Python {platform.python_version()}",
              "note": "Peak memory of the pipeline process alone. It stays flat as reads grow because FASTQ files are streamed.",
              "runs": results}
    Path(out_json).parent.mkdir(parents=True, exist_ok=True)
    Path(out_json).write_text(json.dumps(report, indent=2))
    return results
