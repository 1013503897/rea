"""Freeze a follow-up real Electron dependency-inventory question."""

import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    args = parser.parse_args()
    data = args.data.resolve()
    output = data / 'dependencies'
    output.mkdir(mode=0o700)
    artifact = data / 'artifacts/obsidian-1.14.4.asar'
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert digest == '146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f'
    modules = []
    for path in (data / 'obsidian-oracle').glob('call-*.json'):
        item = json.loads(path.read_text()).get('structuredContent', {}).get('normalized_result', {}).get('item', {})
        if item.get('kind') == 'javascript-module' and item.get('path') == 'main.js':
            modules.append(item)
    assert len(modules) == 23
    specifiers = {}
    for item in modules:
        identity = item['identity']
        if identity['namespace'] == 'unresolved-semantic-module' and identity['key'].startswith('external:'):
            specifier = identity['key'].removeprefix('external:')
            assert specifier not in specifiers
            specifiers[specifier] = len(item['source_ranges'])
    task = {'id': 'obsidian-dependencies',
            'tools': ['analyze_javascript_application', 'inspect_analysis_view'],
            'bootstrap': {'tool': 'analyze_javascript_application', 'arguments': {
                'input_path': str(artifact), 'source_paths': ['package.json', 'main.js'], 'detail': 'summary'}},
            'question': (
                'For a packaging/sandboxing review of the actual shipped Obsidian main.js, inventory '
                'every retained javascript-module identity at that exact path and inspect its item facts. '
                'Return external_specifiers as an object mapping each literal external module specifier '
                'to its number of retained source_ranges, selecting only identity.namespace '
                'unresolved-semantic-module with identity.key starting external:. Strip only that prefix. '
                'Do not count unresolved-reference identities a second time. Return module_identity_count '
                '(all javascript-module identities for main.js), external_module_count, inventory_exhausted, '
                'runtime_load_proven (boolean), artifact_sha256 (the original ASAR digest), evidence_ids '
                '(sufficient actual supporting REA Evidence IDs), and concise limitations. Do not execute '
                'target code, fetch URLs, infer installed versions or claim runtime loading from static '
                'references. The initial selected-source summary and retained parent are supplied. '
                'Use the smallest sufficient observations and finish once all requested facts are supported.')}
    path = output / 'obsidian-dependencies.json'
    path.write_text(json.dumps(task, indent=2) + '\n')
    oracle = {'artifact_sha256': digest, 'external_specifiers': specifiers,
              'module_identity_count': len(modules), 'external_module_count': len(specifiers),
              'inventory_exhausted': True, 'runtime_load_proven': False}
    (output / 'oracles.json').write_text(json.dumps({task['id']: oracle}, indent=2) + '\n')
    plan = {'scope': 'Exploratory follow-up, one dependent-read task and one pair; no statistical claim',
            'oracle_scope': 'Separate retained producer Evidence consistency, not independent semantic validation',
            'protocol': 'Direct batches permitted; code explicitly instructed to project/combine before print',
            'trials': [{'task': task['id'], 'arm': arm, 'task_file': path.name,
                        'task_sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                       for arm in ['code', 'direct']]}
    (output / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    print(output)


if __name__ == '__main__':
    main()
