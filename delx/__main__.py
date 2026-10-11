"""Command line:
  python -m delx synth <dir>
  python -m delx run <samples.csv> <library.fasta> <out_dir>
  python -m delx bench <reads> [<reads> ...] [--out docs/benchmark.json]
"""
import json
import sys

from delx import bench, pipeline, synth


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "synth":
        synth.generate(argv[1])
        print(f"wrote synthetic library and FASTQ files to {argv[1]}")
        return 0
    if len(argv) >= 4 and argv[0] == "run":
        s = pipeline.run(argv[1], argv[2], argv[3])
        print(json.dumps({k: s[k] for k in ("reads", "passed_quality", "barcode_found", "matched", "corrected")}))
        return 0
    if len(argv) >= 2 and argv[0] == "bench":
        out = argv[argv.index("--out") + 1] if "--out" in argv else "docs/benchmark.json"
        sizes = [int(a) for a in argv[1:] if a.isdigit()]
        bench.run(sizes, out)
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
