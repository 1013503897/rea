"""Compare completed equivalent tasks; token counts are offline estimates only."""
import argparse
import importlib.metadata
import json
from pathlib import Path
import tiktoken


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("roots", nargs="+")
    options = parser.parse_args()
    encoding = tiktoken.get_encoding("o200k_base")

    def tokens(value):
        return len(encoding.encode(json.dumps(value, ensure_ascii=False, separators=(",", ":")), disallowed_special=()))

    results = []
    equivalence = {}
    for root in map(Path, options.roots):
        for report_path in sorted(root.glob("*.report.json")):
            report = json.loads(report_path.read_text())
            if report["failures"] or report["verification_only"]:
                continue
            prefix = str(report_path).removesuffix(".report.json")
            catalog = json.loads(Path(prefix + ".catalog.json").read_text())
            wire = json.loads(Path(prefix + ".wire.json").read_text())
            resources = [json.loads(line) for line in Path(prefix + ".log").read_text().splitlines()
                         if line.startswith('{"resource_scope":')][-1]
            assert resources["payload_resource_observation_verified"], prefix
            counters = resources["payload_resource_observation"]
            assert counters["payload_exit_code"] == 0 and counters["payload_cleanup_verified"], prefix
            assert counters["resource_events"]["memory.events"]["oom_kill"] == 0, prefix
            key = (report["provider"], report["target_sha256"], report["pattern"])
            outcome = [{name: row[name] for name in ["strings", "references", "functions"]} for row in report["outcomes"]]
            if key in equivalence:
                assert outcome == equivalence[key], "Equivalent-task answers differ: " + prefix
            else:
                equivalence[key] = outcome
            phase_traffic = {phase: [{"request": row["request"], "response": row["response"]} for row in wire if row["phase"] == phase]
                             for phase in ["cold", "warm", "lifecycle"]}
            used = {row["request"]["name"] for row in wire}
            input_only_catalog = {**catalog, "tools": [{key: value for key, value in tool.items() if key != "outputSchema"} for tool in catalog["tools"]]}
            task_traffic = [row for row in wire if row["phase"] in ["cold", "warm", "lifecycle"]]
            rows = {phase: {"calls": len(traffic), "estimated_tokens": tokens(traffic)} for phase, traffic in phase_traffic.items()}
            results.append({
                "provider": report["provider"], "variant": report["variant"], "target_sha256": report["target_sha256"],
                "pattern": report["pattern"], "catalog_tools": len(catalog["tools"]), "catalog_estimated_tokens": tokens(catalog),
                "observed_output_schema_count": sum("outputSchema" in tool for tool in catalog["tools"]),
                "input_only_catalog_estimated_tokens": tokens(input_only_catalog),
                "phases": rows,
                "query_elapsed_ms": {row["phase"]: round(row["elapsed_ms"], 2) for row in report["outcomes"]},
                "session_elapsed_seconds_including_two_tasks": resources["elapsed_seconds"],
                "session_cpu_seconds_including_two_tasks": round(counters["cpu_stat"]["usage_usec"] / 1e6, 3),
                "peak_process_family_cgroup_mib": round(counters["memory_peak_bytes"] / 1024 ** 2, 1),
                "whole_session_estimated_tokens": tokens(catalog) + tokens([{"request": row["request"], "response": row["response"]} for row in task_traffic]),
                "whole_session_with_input_only_catalog_estimated_tokens": tokens(input_only_catalog) + tokens([{"request": row["request"], "response": row["response"]} for row in task_traffic]),
                "hypothetical_selected_declarations_estimated_tokens": tokens([tool for tool in catalog["tools"] if tool["name"] in used]),
                "answer": {"strings": len(outcome[0]["strings"]), "reference_sites": sum(len(row["items"]) for row in outcome[0]["references"]), "locations": len(outcome[0]["functions"])},
                "cleanup_verified": True, "oom_kills": 0,
            })
    summary = {
        "token_method": {"encoding": "o200k_base", "tiktoken_version": importlib.metadata.version("tiktoken"),
                         "estimated_not_billed": True, "scope": "Captured MCP tool catalog and request/response payloads, including text and structured copies; excludes JSON-RPC framing, model reasoning, host prompts and model tool selection."},
        "memory_method": "Kernel memory.peak for the complete owned process-family cgroup, including charged file cache; not summed RSS. Payload-exit counters verified while the observer remains alive.",
        "workload": "One cold and one warm selected navigation task per fresh session, plus startup, discovery/status, close and cleanup. Additional --verify runs excluded.",
        "equivalence": "All included variants agree on selected strings, reference sites and per-location function resolutions within each provider/target/query. This is not cross-provider truth or a live-agent reasoning evaluation.",
        "results": results,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
