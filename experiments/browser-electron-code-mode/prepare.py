"""Freeze real-artifact tasks and exact oracles before sampling any scored model."""

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    args = parser.parse_args()
    data = args.data.resolve()
    output = data / 'cohort'
    output.mkdir(mode=0o700)
    artifact = data / 'artifacts/obsidian-1.14.4.asar'
    capture = data / 'excalidraw-proxy/excalidraw.har'
    artifact_sha = hashlib.sha256(artifact.read_bytes()).hexdigest()
    capture_sha = hashlib.sha256(capture.read_bytes()).hexdigest()
    assert artifact_sha == '146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f'
    manifest = json.loads((capture.parent / 'manifest.json').read_text())
    assert capture_sha == manifest['har_sha256']
    summary = json.loads((data / 'obsidian-oracle/call-1.json').read_text())['structuredContent']['normalized_result']['summary']
    inventory = json.loads((data / 'obsidian-oracle/call-2.json').read_text())['structuredContent']['normalized_result']
    assert inventory['coverage']['exhausted']
    rows = [item for item in inventory['items'] if item['path'] == 'main.js']
    groups = defaultdict(list)
    entries = json.loads(capture.read_text())['log']['entries']
    for ordinal, entry in enumerate(entries):
        groups[(urlsplit(entry['request']['url']).hostname, entry['response']['status'])].append(ordinal)
    common = (' Include artifact_sha256, evidence_ids (actual REA Evidence IDs used), and limitations '
              '(concise strings). Do not execute target code or fetch URLs. '
              'Use the supplied summary and retained Evidence; no new artifact selection. ')
    js = {'tool': 'analyze_javascript_application', 'arguments': {
        'input_path': str(artifact), 'source_paths': ['package.json', 'main.js'], 'detail': 'summary'}}
    web = {'tool': 'inspect_web_network_capture', 'arguments': {
        'capture_path': str(capture), 'format': 'har', 'detail': 'summary'}}
    definitions = [
        ('obsidian-lookup', js,
         'From the supplied selected-source Obsidian analysis, report exact requested_paths, '
         'unselected_files, parsed_javascript_files, browser_windows, ipc_operations and main_handlers. '
         'These are static extractor observations, not executed application behavior.' + common,
         {'artifact_sha256': artifact_sha, 'requested_paths': ['package.json', 'main.js'],
          'unselected_files': summary['source_selection']['unselected_files'],
          'parsed_javascript_files': summary['statistics']['parsed_javascript_files'],
          'browser_windows': summary['electron']['browser_windows'],
          'ipc_operations': summary['electron']['ipc']['operations'],
          'main_handlers': summary['electron']['ipc']['main_handlers']}),
        ('obsidian-identities', js,
         'Before choosing a semantic entrypoint, inventory every retained module identity whose exact '
         'path is main.js. Return counts_by_kind, node_ids (all matching IDs), and inventory_exhausted '
         '(boolean). Preserve the distinction between a javascript-asset and javascript-module identities '
         'sharing that path. Module page identities are sufficient; item bodies are unnecessary. '
         'Examine complete inventory coverage rather than assuming one identity per source file.' + common,
         {'artifact_sha256': artifact_sha, 'counts_by_kind': dict(Counter(row['kind'] for row in rows)),
          'node_ids': sorted(row['node_id'] for row in rows), 'inventory_exhausted': True}),
        ('excalidraw-network', web,
         'For every request in this frozen actual Excalidraw startup HAR, group by URL hostname and '
         'HTTP response status. Return groups as [{hostname,status,count,record_ordinals}], '
         'observed_records, and coverage_exhausted. Preserve every original zero-based record ordinal. '
         'Use retained capture preview pages where sufficient; response bodies are unnecessary. '
         'This is one observed startup window, not a complete application API inventory.' + common,
         {'artifact_sha256': capture_sha, 'observed_records': len(entries), 'coverage_exhausted': True,
          'groups': [{'hostname': host, 'status': status, 'count': len(ordinals), 'record_ordinals': ordinals}
                     for (host, status), ordinals in sorted(groups.items())]}),
        ('obsidian-unknown', js,
         'Does this selected-source static analysis establish that every Obsidian IPC handler enforces '
         'sender authorization at runtime? Return authorization_established (boolean), '
         'application_behavior_fully_covered (boolean), sender_validation_observations, '
         'unselected_files, and reason. Distinguish an observed check from enforced authorization; '
         'do not infer absence or a vulnerability from incomplete static coverage.' + common,
         {'artifact_sha256': artifact_sha, 'authorization_established': False,
          'application_behavior_fully_covered': False, 'sender_validation_observations': 1,
          'unselected_files': 36}),
    ]
    plan = []
    oracles = {}
    for index, (name, bootstrap, question, oracle) in enumerate(definitions):
        task = {'id': name, 'question': question, 'bootstrap': bootstrap,
                'tools': [bootstrap['tool'], 'inspect_analysis_view']}
        path = output / (name + '.json')
        path.write_text(json.dumps(task, indent=2) + '\n')
        oracles[name] = oracle
        for arm in (['direct', 'code'] if index % 2 == 0 else ['code', 'direct']):
            plan.append({'task': name, 'arm': arm, 'task_file': path.name,
                         'task_sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    (output / 'oracles.json').write_text(json.dumps(oracles, indent=2) + '\n')
    (output / 'plan.json').write_text(json.dumps({
        'trials': plan, 'repetitions': 1, 'scope': 'Eight-trial exploratory pilot, four questions, two artifacts',
        'oracle_scope': 'HAR grouping independently decoded from original HAR. Obsidian counts/identities '
                        'are consistency checks against separately retained production Evidence, not an '
                        'independent proof of semantic extractor correctness.',
        'artifact_sha256': artifact_sha, 'capture_sha256': capture_sha,
    }, indent=2) + '\n')
    print(output)


if __name__ == '__main__':
    main()
