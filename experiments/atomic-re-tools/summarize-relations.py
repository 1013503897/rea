"""Representation estimates and a complete ledger of this round's captured runs.

Run with the tokenizer environment from the first round. This does not measure
model billing, model reasoning, or equivalent completed agent tasks.
"""
import importlib.metadata
import json
from pathlib import Path
import sys

import tiktoken


def load(path):
    return json.loads(path.read_text())


def resource(path):
    records = [json.loads(line) for line in path.read_text().splitlines()
               if line.startswith('{"resource_scope":')]
    assert len(records) == 1, path
    record = records[0]
    observation = record['payload_resource_observation']
    assert record['payload_resource_observation_verified'] is True
    assert observation['payload_cleanup_verified'] is True
    return {
        'log': str(path), 'elapsed_s': record['elapsed_seconds'],
        'cpu_s': observation['cpu_stat']['usage_usec'] / 1_000_000,
        'family_peak_mib_including_file_cache': observation['memory_peak_bytes'] / 2**20,
        'exit_code': observation['payload_exit_code'],
        'oom_kills': observation['resource_events']['memory.events']['oom_kill'],
    }


def main():
    root, output = map(Path, sys.argv[1:])
    encoder = tiktoken.get_encoding('o200k_base')

    def tokens(value):
        return len(encoder.encode(value, disallowed_special=()))

    def encoded(value):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

    rows = []
    for name, prefix, query_file in [
        ('zlib', 'relations-kuna-zlib-raw-v2', 'relations-zlib-query-v2.json'),
        ('sqlite', 'relations-kuna-sqlite-raw', 'relations-sqlite-query-v2.json'),
    ]:
        capture = load(root / (prefix + '.report.json'))
        query = load(root / query_file)
        raw = Path(capture['calls'][0]['file']).read_text()
        code = raw.split('\n0\nBasic Block', 1)[0].strip()
        answers = query['runs'][0]['answers']
        rows.append({
            'target': name, 'artifact_sha256': capture['target_sha256'],
            'full_code_tokens': tokens(code), 'full_code_bytes': len(code.encode()),
            'full_native_dump_tokens': tokens(raw),
            'selected_answer_tokens_with_source': [tokens(encoded({'source': query['source'], 'answer': a})) for a in answers],
            'batch_answer_tokens_with_source': tokens(encoded({'source': query['source'], 'answers': answers})),
            'parse_index_ms': query['parse_index_ms'],
            'projection_runs': [{k: v for k, v in r.items() if k != 'answers'} for r in query['runs']],
            'snapshot_coverage': query['coverage'],
        })
    ghidra = root / 'relations-ghidra-zlib-retained'
    wire = load(ghidra.with_suffix('.wire.json'))
    report = load(ghidra.with_suffix('.report.json'))
    resources = [resource(p) for p in sorted(root.glob('relations-*.log'))]
    summary = {
        'encoding': 'o200k_base', 'tiktoken': importlib.metadata.version('tiktoken'),
        'representation_estimates': rows,
        'ghidra_retained_workflow': {
            'wire_tokens_including_errors_and_exports': tokens(encoded(wire)),
            'input_only_catalog_tokens': tokens(encoded(load(ghidra.with_suffix('.catalog.json')))),
            'calls': report['calls'], 'analyst_task_completed': False,
            'reason': 'Late literal not covered by the producer-truncated high-p-code prefix.',
        },
        'run_ledger': resources,
        'scope': [
            'Raw captures are fresh native analyses; OS caches were not flushed.',
            'Reused-index runs reuse parsed facts, not a warm native analysis.',
            'Token counts cover the stated representations. The native probe has no new MCP catalog.',
            'No controlled agent A/B task, model reasoning tokens or model latency measured.',
            'Discovery, old xrefs, manual oracle construction, objdump and tokenizer CPU are outside the native/projection runs.',
            'The ledger retains failed and superseded probes rather than excluding their costs.',
        ],
    }
    with output.open('x') as destination:
        destination.write(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({'output': str(output), 'targets': len(rows), 'runs': len(resources)}))


if __name__ == '__main__':
    main()
