"""Independent compiled-symbol oracle for the interior-only reference experiment."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

binary, point_report, extent_report = map(Path, sys.argv[1:])
point, extent = [json.loads(path.read_text()) for path in [point_report, extent_report]]
symbols = {}
for line in subprocess.check_output(["nm", "--defined-only", "--format=posix", str(binary)], text=True).splitlines():
    fields = line.split()
    if fields[0] in ["marker", "give_suffix"]:
        symbols[fields[0]] = "0x" + format(int(fields[2], 16), "x")
assert set(symbols) == {"marker", "give_suffix"}
for report in [point, extent]:
    assert not report["failures"]
    assert report["facts"]["artifact_sha256"] == hashlib.sha256(binary.read_bytes()).hexdigest()
    for call in report["calls"]:
        assert hashlib.sha256(Path(call["file"]).read_bytes()).hexdigest() == call["sha256"]
    assert report["facts"]["results"][0]["string"]["address"] == symbols["marker"]
assert point["facts"]["results"][0]["xrefs_count"] == 0
assert point["facts"]["results"][0]["functions"] == []
assert extent["facts"]["results"][0]["xrefs_count"] == 1
assert [fn["address"] for fn in extent["facts"]["results"][0]["functions"]] == [symbols["give_suffix"]]
print(json.dumps({"verified": True, "point_references": 0, "extent_references": 1, "symbols": symbols}))
