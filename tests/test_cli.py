"""The command line runs end to end, and the benchmark keeps memory flat as reads grow."""
import json

from delx import bench
from delx.__main__ import main


def test_cli_synth_then_run(tmp_path, capsys):
    assert main(["synth", str(tmp_path / "data")]) == 0
    assert main(["run", str(tmp_path / "data" / "samples.csv"), str(tmp_path / "data" / "library.fasta"),
                 str(tmp_path / "out")]) == 0
    summary = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert summary["reads"] == 72000 and summary["matched"] > 60000
    assert {"hits.json", "summary.json", "building_blocks.json", "replicates.json"} <= {p.name for p in (tmp_path / "out").iterdir()}


def test_cli_rejects_unknown_command():
    assert main(["nope"]) == 2


def test_benchmark_streams_with_flat_memory(tmp_path):
    rows = bench.run([30000, 120000], tmp_path / "bench.json")
    small, large = rows
    assert small["reads"] == 30000 and large["reads"] == 120000
    assert large["peak_memory_mb"] < small["peak_memory_mb"] * 1.5, "memory must not grow with the number of reads"
    assert json.loads((tmp_path / "bench.json").read_text())["runs"] == rows
