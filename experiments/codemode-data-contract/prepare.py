"""Freeze a typed-interface follow-up using two existing genuine app questions."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(mode=0o700)
    root = Path(__file__).resolve().parents[2]
    definitions = [('dependencies', 'obsidian-dependencies'), ('cohort', 'excalidraw-network')]
    trials = []
    oracles = {}
    for index, (directory, task_id) in enumerate(definitions):
        original = args.data / directory / (task_id + '.json')
        task = json.loads(original.read_text())
        if task_id == 'obsidian-dependencies':
            # Same semantic question; do not prescribe the old individual-item
            # call sequence that the new projection deliberately replaces.
            task['question'] = task['question'].replace(
                'inventory every retained javascript-module identity at that exact path and inspect its item facts.',
                'inventory every retained javascript-module identity at that exact path and its retained reference facts.')
        path = args.output / original.name
        path.write_text(json.dumps(task, indent=2) + '\n')
        oracles[task_id] = json.loads((args.data / directory / 'oracles.json').read_text())[task_id]
        for arm in (['code', 'direct'] if index == 0 else ['direct', 'code']):
            trials.append({'task': task_id, 'arm': arm, 'task_file': path.name,
                           'task_sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    sources = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
               for directory in ['experiments/browser-electron-code-mode', 'experiments/codemode-data-contract', 'src/domain/analysisView']
               for path in (root / directory).iterdir()
               if path.suffix in ['.py', '.mjs', '.ts']}
    plan = {'scope': 'Four-trial exploratory follow-up, two real app questions, one counterbalanced pair per task; no statistical claim.',
            'issue': 'https://github.com/morluto/rea/issues/4063',
            'interface': 'typed', 'compositional_followup': True, 'max_rounds': 16,
            'backend_parity': 'Both arms share the same production runtime, snapshots, canonical queries, narrow discovery and complete tools. Direct batches are allowed. Code adds async SDK composition and output selection.',
            'model': 'gpt-5.6-terra', 'reasoning': 'high',
            'codex_cli': subprocess.check_output(['/usr/bin/codex', '--version'], text=True).strip(),
            'historical_baseline': 'Original pilot/dependency results are historical context, not a randomized third arm; production revision and question wording differ.',
            'oracle_scope': 'HAR grouping independently decoded from original HAR; Obsidian producer consistency plus explicit static/runtime distinction, not independent semantic extractor validation.',
            'revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
            'sources_sha256': sources, 'trials': trials}
    (args.output / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    (args.output / 'oracles.json').write_text(json.dumps(oracles, indent=2) + '\n')
    print(args.output)


if __name__ == '__main__':
    main()
