"""Run comparable real-provider tasks serially using REA's existing scope owner."""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["kuna", "ghidra"], required=True)
    parser.add_argument("--binary", required=True)
    parser.add_argument("--pattern", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--variants", nargs="+", choices=["baseline", "fine", "batch", "workflow"],
                        default=["baseline", "fine", "batch", "workflow"])
    options = parser.parse_args()
    root = Path(options.output).resolve()
    root.mkdir(parents=True, exist_ok=True)
    completed = []
    for variant in options.variants:
        prefix = root / (options.provider + "-" + variant)
        command = [sys.executable, "experiments/analysis-efficiency/resource-run.py", "--observe-payload-exit", "--",
                   "node", "experiments/atomic-re-tools/benchmark.mjs", options.provider, variant,
                   options.binary, options.pattern, str(prefix)]
        with Path(str(prefix) + ".log").open("w") as output:
            result = subprocess.run(command, stdout=output, stderr=subprocess.STDOUT, check=False)
        if result.returncode:
            raise SystemExit(f"{variant} failed ({result.returncode}); retained {prefix}.log")
        report = json.loads(Path(str(prefix) + ".report.json").read_text())
        if report["failures"] or report["verification_only"]:
            raise SystemExit("Not a successful comparable performance sample: " + str(prefix))
        completed.append(str(prefix))
        (root / (options.provider + "-completed.json")).write_text(json.dumps(completed, indent=2) + "\n")
        print(json.dumps({"completed": variant, "provider": options.provider,
                          "query_ms": [round(row["elapsed_ms"], 2) for row in report["outcomes"]]}), flush=True)


if __name__ == "__main__":
    main()
