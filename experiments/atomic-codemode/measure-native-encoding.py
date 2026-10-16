"""Lossless encoding feasibility on retained native JSON; no provider implementation."""

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import time


def measure(source, output):
    with source.open('rb') as stream:
        raw = stream.read(32 * 1024 * 1024 + 1)
    if len(raw) > 32 * 1024 * 1024:
        raise ValueError('Input exceeds the diagnostic 32 MiB source bound')
    document = json.loads(raw)
    if len(document['functions']) != 1:
        raise ValueError('Select one retained native function')
    function = document['functions'][0]
    graph = function['atomic_facts']
    graph_json = json.dumps(graph, separators=(',', ':'), ensure_ascii=False).encode()
    wall, cpu = time.perf_counter(), time.process_time()
    compressed = gzip.compress(graph_json, compresslevel=1, mtime=0)
    base64_data = base64.b64encode(compressed)
    encode_cost = {'wall_ms': (time.perf_counter() - wall) * 1000,
                   'cpu_ms': (time.process_time() - cpu) * 1000}
    wall, cpu = time.perf_counter(), time.process_time()
    restored = gzip.decompress(base64.b64decode(base64_data, validate=True))
    if restored != graph_json:
        raise ValueError('Lossless byte roundtrip failed')
    decode_cost = {'wall_ms': (time.perf_counter() - wall) * 1000,
                   'cpu_ms': (time.process_time() - cpu) * 1000}
    results = {}
    for name, data in [('gzip-base64', base64_data.decode()),
                       ('gzip-hex', compressed.hex())]:
        function['atomic_facts'] = {
            'schema_version': 4, 'encoding': name,
            'raw_bytes': len(graph_json), 'data': data,
        }
        results[name] = len(json.dumps(document, separators=(',', ':'),
                                      ensure_ascii=False).encode())
    report = {
        'source': str(source), 'source_sha256': hashlib.sha256(raw).hexdigest(),
        'original_document_bytes': len(raw), 'graph_json_bytes': len(graph_json),
        'graph_statement_bytes': sum(len(op['statement'].encode()) for op in graph['operations']),
        'graph_operations': len(graph['operations']),
        'graph_values': len(graph['values']), 'graph_blocks': len(graph['blocks']),
        'gzip_level': 1, 'gzip_bytes': len(compressed),
        'candidate_document_bytes': results,
        'public_transport_budget_bytes': 8 * 1024 * 1024,
        'lossless_graph_byte_roundtrip': True,
        'python_gzip_and_base64_encoding': encode_cost,
        'python_base64_and_gzip_decoding': decode_cost,
        'scope': 'Offline retained-source format feasibility, not a native/provider/model '
                 'implementation. Timings are Python only, not Rust/Node or agent savings. '
                 'Whole-run CPU/peak family memory are separate resource-run receipts.',
    }
    with output.open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    measure(args.source, args.output)
