"""Unit tests for parsing, quality, barcode matching and enrichment, plus an end to end run."""
import gzip
import json

import pandas as pd
import pytest

from delx import pipeline, synth
from delx.barcodes import BarcodeMatcher, extract_barcode, hamming
from delx.fastx import mean_phred, read_fasta, read_fastq


def test_fasta_multiline_and_headers(tmp_path):
    p = tmp_path / "lib.fasta"
    p.write_text(">CMP-1 bb1=A\nACGT\nacgt\n\n>CMP-2 bb1=B\nTTTT\n")
    assert list(read_fasta(p)) == [("CMP-1 bb1=A", "ACGTACGT"), ("CMP-2 bb1=B", "TTTT")]


def test_fastq_plain_and_gzip(tmp_path):
    rec = "@r1 extra\nacgt\n+\nIIII\n@r2\nTTTT\n+\n####\n"
    (tmp_path / "a.fastq").write_text(rec)
    with gzip.open(tmp_path / "a.fastq.gz", "wt") as f:
        f.write(rec)
    expected = [("r1", "ACGT", "IIII"), ("r2", "TTTT", "####")]
    assert list(read_fastq(tmp_path / "a.fastq")) == expected
    assert list(read_fastq(tmp_path / "a.fastq.gz")) == expected


def test_fastq_rejects_malformed(tmp_path):
    (tmp_path / "bad.fastq").write_text("@r1\nACGT\n+\nIII\n")
    with pytest.raises(ValueError):
        list(read_fastq(tmp_path / "bad.fastq"))


def test_mean_phred():
    assert mean_phred("IIII") == 40
    assert mean_phred("####") == 2
    assert mean_phred("") == 0


def test_extract_barcode():
    assert extract_barcode("NNNNAGCTAGACGTACGTACGTTT", "AGCTAG", 12) == "ACGTACGTACGT"
    assert extract_barcode("NNNNGGGGGGACGTACGTACGT", "AGCTAG", 12) is None
    assert extract_barcode("AGCTAGACGT", "AGCTAG", 12) is None


def test_matcher_exact_corrected_and_ambiguous():
    m = BarcodeMatcher(["AAAAAAAAAAAA", "CCCCCCCCCCCC"])
    assert m.match("AAAAAAAAAAAA") == ("AAAAAAAAAAAA", False)
    assert m.match("AAAAATAAAAAA") == ("AAAAAAAAAAAA", True)
    assert m.match("AAAAATTAAAAA") is None
    near = BarcodeMatcher(["AAAAAAAAAAAA", "AAAAAAAAAAAC"])
    assert near.match("AAAAAAAAAAAG") is None, "a neighbour of two barcodes is never guessed"
    assert hamming("ACGT", "ACCT") == 1


def test_enrichment_math():
    samples = pd.DataFrame({"sample": ["T1", "T2", "C1"], "target": ["X", "X", "none"],
                            "type": ["target", "target", "control"], "replicate": [1, 2, 1]})
    counts = pd.DataFrame({"sample": ["T1", "T1", "T2", "T2", "C1", "C1"],
                           "barcode": ["B1", "B2"] * 3, "reads": [900, 100, 800, 200, 100, 900]})
    lib = pd.DataFrame({"barcode": ["B1", "B2"], "compound": ["C-1", "C-2"], "bb1": ["a", "b"],
                        "bb2": ["x", "x"], "bb3": ["y", "y"]})
    hits = pipeline.enrichment(counts, samples, lib, min_target_rpm=0)
    top = hits.iloc[0]
    assert top["compound"] == "C-1" and top["rank"] == 1
    assert top["min_log2"] == pytest.approx(min(top["log2_r1"], top["log2_r2"]))
    assert top["min_log2"] > 2.5
    assert top["min_log2"] <= max(top["log2_r1"], top["log2_r2"])


def test_end_to_end_recovers_planted_binders(tmp_path):
    synth.generate(tmp_path / "data", compounds=150, reads_per_sample=4000, seed=3)
    summary = pipeline.run(tmp_path / "data" / "samples.csv", tmp_path / "data" / "library.fasta", tmp_path / "out")
    assert summary["reads"] == 6 * 4000
    assert summary["matched"] < summary["barcode_found"] <= summary["passed_quality"] < summary["reads"]
    assert summary["corrected"] > 0
    bbs = pd.read_json(tmp_path / "out" / "building_blocks.json")
    brd4_top = bbs[(bbs["target"] == "BRD4") & (bbs["position"] == "bb1")].iloc[0]["building_block"]
    kras_top = bbs[(bbs["target"] == "KRAS") & (bbs["position"] == "bb2")].iloc[0]["building_block"]
    assert brd4_top in ("BB1-03", "BB1-07") and kras_top == "BB2-11"
    reps = json.loads((tmp_path / "out" / "replicates.json").read_text())
    assert reps["BRD4"]["pearson"] > 0.5
