"""Barcode extraction and error tolerant matching against the library."""
from __future__ import annotations

BASES = "ACGT"


def extract_barcode(seq: str, primer: str, length: int) -> str | None:
    """The barcode is the `length` bases right after the primer, or None if it is missing."""
    start = seq.find(primer)
    if start < 0:
        return None
    start += len(primer)
    barcode = seq[start:start + length]
    return barcode if len(barcode) == length else None


def hamming(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


class BarcodeMatcher:
    """Maps a read's barcode to a library barcode, correcting one sequencing error.

    Every library barcode is indexed together with all its one substitution neighbours, so a
    lookup is a single dictionary access. Neighbours shared by two library barcodes are ambiguous
    and dropped, so a correction is only made when it is certain.
    """

    def __init__(self, library: list[str]):
        self.exact = set(library)
        neighbours: dict[str, str | None] = {}
        for bc in library:
            for i, original in enumerate(bc):
                for base in BASES:
                    if base == original:
                        continue
                    variant = bc[:i] + base + bc[i + 1:]
                    if variant in self.exact:
                        continue
                    neighbours[variant] = bc if variant not in neighbours else None
        self.neighbours = {k: v for k, v in neighbours.items() if v is not None}

    def match(self, barcode: str) -> tuple[str, bool] | None:
        """(library barcode, was corrected), or None when it matches nothing safely."""
        if barcode in self.exact:
            return barcode, False
        corrected = self.neighbours.get(barcode)
        return (corrected, True) if corrected else None
