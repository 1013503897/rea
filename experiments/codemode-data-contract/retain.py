"""Save non-regenerable experimental decisions/results, never raw applications.

Explicit allowlist: no recursive directory copying, profiles, auth, ambient
configuration, original inputs, or regenerable full producer Evidence.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'browser-electron-code-mode'))
from review import evidence_ids


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cohort', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plan = read(args.cohort / 'plan.json')
    args.output.mkdir(parents=True, exist_ok=False)
    files = {'plan.json', 'oracles.json', 'review.json'} | {row['task_file'] for row in plan['trials']}
    for name in sorted(files):
        if Path(name).name != name:
            raise ValueError('Expected a cohort-local filename')
        source = args.cohort / name
        if source.exists():
            shutil.copyfile(source, args.output / name)
    for row in plan['trials']:
        label = row['task'] + '-' + row['arm']
        source = args.cohort / label
        output = args.output / label
        output.mkdir()
        for name in ['receipt.json', 'answer.json', 'context-capture.json']:
            if (source / name).exists():
                shutil.copyfile(source / name, output / name)
        trajectory = []
        for step in sorted(source.glob('round-*')):
            item = {'round': step.name}
            for name in ['action.json', 'observation.json', 'prompt.txt', 'events.jsonl', 'stderr.log']:
                path = step / name
                if not path.exists():
                    continue
                item[name + '_sha256'] = digest(path)
                item[name + '_bytes'] = path.stat().st_size
                if name == 'action.json':
                    item['action'] = read(path)
                if name == 'events.jsonl':
                    # CLI usage/events reflect the actual sampling, and cannot
                    # be reconstructed from regenerated tool output.
                    item['cli_events'] = [json.loads(line) for line in path.read_text().splitlines()]
                if name == 'stderr.log' and path.stat().st_size:
                    item['stderr'] = path.read_text()
            trajectory.append(item)
        (output / 'trajectory.jsonl').write_text(''.join(json.dumps(item, ensure_ascii=False) + '\n' for item in trajectory))
        known = set()
        calls = []
        for path in sorted((source / 'backend').glob('call-*.json')):
            known.update(evidence_ids(read(path)))
            calls.append({'file': path.name, 'sha256': digest(path), 'bytes': path.stat().st_size})
        index = {'successful_evidence_ids': sorted(known), 'producer_response_files': calls,
                 'scope': 'Observed successful-envelope references and response digests; raw regenerable producer payloads omitted.'}
        (output / 'evidence-index.json').write_text(json.dumps(index, indent=2) + '\n')
        resources = []
        log = args.cohort / (label + '.log')
        if log.exists():
            for line in log.read_text().splitlines():
                try:
                    value = json.loads(line)
                except ValueError:
                    continue
                if isinstance(value, dict) and 'resource_scope' in value:
                    resources.append(value)
        (output / 'resources.json').write_text(json.dumps(resources, indent=2) + '\n')
    inventory = {str(path.relative_to(args.output)): digest(path)
                 for path in args.output.rglob('*') if path.is_file()}
    (args.output / 'manifest.json').write_text(json.dumps({
        'files_sha256': inventory,
        'retention': 'Tasks, oracles, sampling actions/CLI events, usage, failures, response digests and resources. No original applications/captures or full producer payloads.',
        'replay_limit': 'Regenerate new captures and oracles for a fresh cohort. Historical live web captures are not byte-reproducible and are intentionally not archived.',
    }, indent=2) + '\n')
    print(json.dumps({'output': str(args.output), 'files': len(inventory),
                      'bytes': sum(path.stat().st_size for path in args.output.rglob('*') if path.is_file())}))


if __name__ == '__main__':
    main()
