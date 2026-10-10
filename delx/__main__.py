"""Command line: python -m delx synth <dir> | python -m delx run <samples.csv> <library.fasta> <out_dir>"""
import json
import sys

from delx import pipeline, synth


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "synth":
        synth.generate(argv[1])
        print(f"wrote synthetic library and FASTQ files to {argv[1]}")
        return 0
    if len(argv) >= 4 and argv[0] == "run":
        s = pipeline.run(argv[1], argv[2], argv[3])
        print(json.dumps({k: s[k] for k in ("reads", "passed_quality", "barcode_found", "matched", "corrected")}))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
