"""Verify retained sources and answer facts; full-answer semantic review is separate."""
import argparse
import hashlib
import json
from pathlib import Path
import re

if not __debug__:
    raise RuntimeError("Run the reviewer without Python optimization")
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("machine", type=Path)
parser.add_argument("engine_sha256")
parser.add_argument("trials", type=Path, nargs="+")
args = parser.parse_args()
machine = json.loads(args.machine.read_text())
reports = []
for trial in args.trials:
    summary = json.loads((trial / "summary.json").read_text())
    answer = (trial / "answer.txt").read_text()
    calls = [json.loads(line) for line in trial.with_suffix(".trace.jsonl").read_text().splitlines()]
    cited = set(re.findall(r"ev_[0-9a-f]{64}", answer))
    assert summary["exit_code"] == 0 and not summary["timeout"]
    for key in ["runtime_inputs_unchanged", "experimental_engine_unchanged",
                "selected_artifact_bytes_unchanged"]:
        assert summary[key], key
    assert summary["selected_artifact_sha256_after"] == machine["target_sha256"]
    assert calls[-1]["tool"] == "close_binary" and calls[-1]["result"]["ok"]
    assert cited and cited <= set(re.findall(r"ev_[0-9a-f]{64}", json.dumps(calls)))
    sources, queries, reads = {}, {}, []
    for path in trial.with_name(trial.name + "-evidence").glob("ev_*.json"):
        meta, raw = json.loads(path.read_text()), path.with_suffix(".txt").read_bytes()
        source = meta["source"]
        assert source["evidence_id"] == path.stem
        assert source["capture_complete"] and source["bytes"] == len(raw)
        assert source["sha256"] == hashlib.sha256(raw).hexdigest()
        assert meta["context"]["artifact_sha256"] == machine["target_sha256"]
        assert meta["context"]["engine_sha256"] == args.engine_sha256
        doc = json.loads(raw)
        sources[path.stem] = meta
        if source["arguments"][0] == "strings":
            assert doc["schema_version"] == 1 and doc["examined_rows"] == 602544
            assert doc["status"] == "complete"
            query = bytes.fromhex(doc["query_utf16le_hex"]).decode("utf-16-le", errors="surrogatepass")
            queries.setdefault(query, []).append((path.stem, doc))
        elif source["arguments"][0] == "read":
            assert doc["kind"] == "data"
            assert doc["bytes"] == len(bytes.fromhex(doc["hex"]))
            reads.append((path.stem, doc))
    assert cited <= sources.keys()
    for query in ["undefined symbol", "Invalid bitcode signature"]:
        expected = [row for row in machine["objects"] if row["query"] == query]
        captures = queries[query]
        assert any(eid in cited for eid, _ in captures)
        assert all(doc["total"] == len(expected) for _, doc in captures)
        for row in expected:
            matches = [item for _, doc in captures for item in doc["items"]
                       if item["address_hex"] == row["address"]]
            assert matches
            for item in matches:
                for key in ["byte_length", "encoding", "nul_terminated", "source_row"]:
                    assert item[key] == row[key], key
                if "text" in item:
                    assert item["text"] == row["text"]
    compact = re.sub(r"\s+", "", answer).lower()
    for row in machine["objects"]:
        assert row["address"] in answer.lower()
        assert hex(int(row["address"], 16) + row["byte_length"] - 1) in answer.lower()
        assert row["text"].strip() in re.sub(r"\s+", " ", answer)
        for window in row["windows"]:
            assert window["hex"] in compact
            start = int(window["address"], 16)
            covering = [(eid, doc) for eid, doc in reads if eid in cited
                        and int(doc["start_hex"], 16) <= start
                        and start + window["length"] <= int(doc["start_hex"], 16) + doc["bytes"]]
            assert covering, window
            assert any(bytes.fromhex(doc["hex"])[start-int(doc["start_hex"], 16):
                       start-int(doc["start_hex"], 16)+window["length"]].hex() == window["hex"]
                       for _, doc in covering)
    assert machine["target_sha256"] in answer and args.engine_sha256 in answer
    code_calls = sum(call["tool"] == "execute_javascript" for call in calls)
    if summary["experimental_engine"]["sha256"] != args.engine_sha256:
        raise AssertionError("wrong engine pin")
    reports.append(dict(trial=trial.name, answer_sha256=hashlib.sha256(answer.encode()).hexdigest(),
        raw_sources_verified=len(sources), cited_sources_verified=len(cited),
        actual_code_mode_invocations=code_calls, expected_objects=5,
        selected_bytes="pass, including valid covering-read compositions",
        semantic_grade="requires full original answer review: counts, evidence-window execution, source scope, unknowns, byte counts and limitations"))
print(json.dumps(reports, indent=2))
