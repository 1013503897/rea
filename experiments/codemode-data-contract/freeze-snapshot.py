"""Freeze one real producer snapshot for an exact-input direct/code comparison.

The large regenerable bundle stays outside Git. Both arms import the identical
bundle through the public MCP contract, rather than reanalyzing under slightly
different dynamically available parent result budgets.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.data = args.data.resolve()
    args.output = args.output.resolve()
    root = Path(__file__).resolve().parents[2]
    args.output.mkdir(mode=0o700)
    original = args.data / 'dependencies/obsidian-dependencies.json'
    task = json.loads(original.read_text())
    bundle = args.output / 'snapshot.json'
    settings = args.output / 'settings.json'
    settings.write_text(json.dumps({'runtime': str(root), 'output': str(args.output / 'preparation'),
                                   'tools': ['analyze_javascript_application', 'export_evidence_bundle']}))
    tick = time.monotonic()
    with (args.output / 'preparation-stderr.log').open('w') as errors:
        process = subprocess.Popen([shutil.which('node'), str(root / 'experiments/browser-electron-code-mode/backend.mjs'), str(settings)],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True)

        def call(tool, arguments):
            process.stdin.write(json.dumps({'kind': 'call', 'tool': tool, 'arguments': arguments}) + '\n')
            process.stdin.flush()
            response = json.loads(process.stdout.readline())
            if not response['ok'] or 'error' in response['value']:
                raise RuntimeError(response)
            return response['value']

        try:
            bootstrap = call(task['bootstrap']['tool'], task['bootstrap']['arguments'])
            call('export_evidence_bundle', {'path': str(bundle)})
        finally:
            if process.poll() is None:
                try:
                    process.stdin.write('{"kind":"close"}\n')
                    process.stdin.flush()
                    process.wait(timeout=15)
                except (BrokenPipeError, subprocess.TimeoutExpired):
                    process.terminate()
                    process.wait(timeout=15)
            process.stdin.close()
            process.stdout.close()
    cohort = args.output / 'cohort'
    cohort.mkdir()
    summary = bootstrap['normalized_result']
    task['question'] = task['question'].replace('and inspect its item facts.', 'and its retained reference facts.')
    task['question'] += (' Both arms receive the exact same imported immutable snapshot. '
                         'Use the following authenticated summary and its parent_evidence_id; '
                         'do not import any other bundle. Summary receipt: ' + json.dumps(summary, separators=(',', ':')))
    task['bootstrap'] = {'tool': 'import_evidence_bundle', 'arguments': {'path': str(bundle)}}
    task['tools'] = ['import_evidence_bundle', 'inspect_analysis_view']
    task['view_namespace'] = 'javascript'
    filename = original.name
    path = cohort / filename
    path.write_text(json.dumps(task, indent=2) + '\n')
    shutil.copyfile(args.data / 'dependencies/oracles.json', cohort / 'oracles.json')
    preparation = {'bundle_sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
                   'bundle_bytes': bundle.stat().st_size, 'summary': summary,
                   'preparation_seconds': time.monotonic() - tick,
                   'retention': 'Regenerable full bundle is temporary, intentionally not archived; summary, hashes and model results are retained.'}
    plan = {'scope': 'One additional exact-snapshot pair, prompted by observed dynamic parent-budget differences; adaptive and reported separately.',
            'oracle_scope': json.loads((args.data / 'dependencies/plan.json').read_text())['oracle_scope'],
            'interface': 'typed-result', 'model': 'gpt-5.6-terra', 'reasoning': 'high',
            'changes': 'Exact shared snapshot and consistent Result for code calls/SDK; exploratory combined iteration, not a causal attribution to either change alone.',
            'snapshot': preparation,
            'runtime_revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
            'trials': [{'task': task['id'], 'arm': arm, 'task_file': filename,
                        'task_sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                       for arm in ['direct', 'code']]}
    (cohort / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    print(json.dumps(preparation))


if __name__ == '__main__':
    main()
