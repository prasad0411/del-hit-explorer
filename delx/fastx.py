"""Streaming FASTA and FASTQ readers. Files are read one record at a time, so memory stays flat."""
from __future__ import annotations

import gzip
from collections.abc import Iterator
from pathlib import Path


def open_text(path: str | Path):
    """Open plain or gzipped text the same way."""
    path = Path(path)
    return gzip.open(path, "rt") if path.suffix == ".gz" else open(path)


def read_fasta(path: str | Path) -> Iterator[tuple[str, str]]:
    """Yield (header, sequence). Sequences may span several lines."""
    header, parts = None, []
    with open_text(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith(">"):
                if header is not None:
                    yield header, "".join(parts)
                header, parts = line[1:], []
            else:
                parts.append(line.upper())
    if header is not None:
        yield header, "".join(parts)


def read_fastq(path: str | Path) -> Iterator[tuple[str, str, str]]:
    """Yield (read id, sequence, quality). Each record is exactly four lines."""
    with open_text(path) as f:
        while True:
            header = f.readline().rstrip()
            if not header:
                return
            seq = f.readline().rstrip().upper()
            plus = f.readline().rstrip()
            qual = f.readline().rstrip()
            if not header.startswith("@") or not plus.startswith("+") or len(seq) != len(qual):
                raise ValueError(f"malformed FASTQ record near {header!r}")
            yield header[1:].split()[0], seq, qual


def mean_phred(qual: str, offset: int = 33) -> float:
    """Average Phred quality. Q30 means a 1 in 1,000 chance a base is wrong."""
    if not qual:
        return 0.0
    return sum(ord(c) - offset for c in qual) / len(qual)
