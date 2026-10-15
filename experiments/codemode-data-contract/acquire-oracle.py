"""Regenerate Obsidian producer-consistency inputs; never execute target code."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    args = parser.parse_args()
    data = args.data.resolve()
    artifact = data / 'artifacts/obsidian-1.14.4.asar'
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == '146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f'
    root = Path(__file__).resolve().parents[2]
    output = data / 'obsidian-oracle'
    output.mkdir(mode=0o700)
    settings = output / 'settings.json'
    settings.write_text(json.dumps({'runtime': str(root), 'output': str(output / 'backend'),
                                   'tools': ['analyze_javascript_application', 'inspect_analysis_view']}))
    with (output / 'stderr.log').open('w') as errors:
        process = subprocess.Popen([shutil.which('node'), str(root / 'experiments/browser-electron-code-mode/backend.mjs'), str(settings)],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True)
        ordinal = 0

        def call(tool, arguments):
            nonlocal ordinal
            process.stdin.write(json.dumps({'kind': 'call', 'tool': tool, 'arguments': arguments}) + '\n')
            process.stdin.flush()
            response = json.loads(process.stdout.readline())
            if not response['ok'] or 'error' in response['value']:
                raise RuntimeError(response)
            ordinal += 1
            shutil.copyfile(output / 'backend' / f'call-{ordinal:03d}.json', output / f'call-{ordinal}.json')
            return response['value']

        try:
            summary = call('analyze_javascript_application', {'input_path': str(artifact), 'source_paths': ['package.json', 'main.js'], 'detail': 'summary'})
            source = {'kind': 'retained-evidence', 'evidence_id': summary['normalized_result']['parent_evidence_id']}
            page = call('inspect_analysis_view', {'source': source, 'view': {'kind': 'page', 'collection': 'modules', 'offset': 0, 'limit': 100}})['normalized_result']
            assert page['coverage']['exhausted']
            for row in page['items']:
                if row['path'] == 'main.js':
                    call('inspect_analysis_view', {'source': source, 'view': {'kind': 'item', 'collection': 'modules', 'selector': {'node_id': row['node_id']}}})
            print(json.dumps({'output': str(output), 'producer_calls': ordinal, 'scope': 'Selected-source producer consistency, not an independent semantic oracle'}))
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


if __name__ == '__main__':
    main()
