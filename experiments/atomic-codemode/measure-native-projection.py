"""Size diagnostic SQLite SSA projections; does not implement a provider API."""

import argparse
from collections import deque
import hashlib
import json
from pathlib import Path


COLUMNS = {
    'blocks': ['id', 'start', 'operations', 'predecessors', 'successors'],
    'operations': ['id', 'address', 'block', 'opcode', 'statement', 'is_dead', 'inputs', 'output'],
    'inputs': ['input_index', 'value_id', 'phi_predecessor', 'phi_predecessor_edge'],
    'successors': ['id', 'target', 'index', 'polarity', 'condition_value', 'condition_test'],
    'values': ['id', 'space', 'offset', 'size_bytes', 'is_constant', 'is_input',
               'is_annotation', 'definition', 'type_name'],
}


def encoded(value):
    return json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode()


def bounded_source(path, budget):
    with path.open('rb') as source:
        raw = source.read(budget + 1)
    assert len(raw) <= budget, 'Use a bounded native capture'
    return raw


def verify_capture(golden, path):
    raw = bounded_source(path, 8 * 1024 * 1024)
    document = json.loads(raw)
    assert len(document['functions']) == 1
    candidate = document['functions'][0]
    ordinary = lambda fn: {key: row for key, row in fn.items()
                           if not key.startswith('atomic_')}
    assert ordinary(candidate) == ordinary(golden)
    assert candidate['atomic_calls'] == golden['atomic_calls']
    projection = candidate['atomic_projection']
    assert projection['schema_version'] == 1
    assert projection['coverage']['operation_budget'] == 4096
    operations = {row['id']: row for row in golden['atomic_facts']['operations']}
    values = {row['id']: row for row in golden['atomic_facts']['values']}
    assert all(row == operations[row['id']] for row in projection['operations'])
    assert all(row == values[row['id']] for row in projection['values'])
    roots = [row['id'] for row in golden['atomic_calls']['items']]
    assert projection['roots'] == roots
    queue, queued, expected = deque(roots), set(roots), []
    while queue and len(expected) < 4096:
        key = queue.popleft()
        if key not in operations:
            continue
        expected.append(key)
        for operand in operations[key]['inputs']:
            value = values.get(operand['value_id'])
            definition = value['definition'] if value else None
            if definition is not None and definition not in queued:
                queued.add(definition)
                queue.append(definition)
    actual = [row['id'] for row in projection['operations']]
    assert actual == expected
    referenced = {row['output'] for row in projection['operations'] if row['output'] is not None} | {
        i['value_id'] for row in projection['operations'] for i in row['inputs']
        if i['value_id'] is not None}
    assert len(projection['values']) == len(referenced)
    assert {row['id'] for row in projection['values']} == referenced
    missing = {row['definition'] for row in projection['values']
               if row['definition'] is not None} - set(actual)
    expected_frontier = {key: 'operation-budget' if key in operations
                         else 'outside-recovered-membership' for key in missing}
    actual_frontier = {row['definition']: row['reason']
                       for row in projection['coverage']['frontier']}
    assert len(actual_frontier) == len(projection['coverage']['frontier'])
    assert actual_frontier == expected_frontier
    return {'scope': 'Retained-source comparison, not independent machine/runtime equivalence',
            'source': str(path), 'source_sha256': hashlib.sha256(raw).hexdigest(),
            'ordinary_record_and_call_facet_equal': True,
            'all_operation_and_value_records_equal': True,
            'breadth_first_budget_and_frontier_match': True,
            'operations': len(actual), 'values': len(referenced), 'frontier': len(missing)}


def pack(table, rows):
    result = []
    for row in rows:
        assert set(row) == set(COLUMNS[table]), 'Do not silently omit unknown fields'
        result.append([pack(key, row[key]) if key in ('inputs', 'successors') else row[key]
                       for key in COLUMNS[table]])
    return result


def unpack(table, rows):
    return [{key: unpack(key, value) if key in ('inputs', 'successors') else value
             for key, value in zip(COLUMNS[table], row, strict=True)} for row in rows]


def projection(operations, values, roots, depth, cap):
    retained, wave = set(roots), set(roots)
    exhausted = False
    for _ in range(depth):
        following = {values[i['value_id']]['definition'] for key in wave
                     for i in operations[key]['inputs'] if i['value_id'] is not None
                     and values[i['value_id']]['definition'] in operations} - retained
        if len(retained | following) > cap:
            exhausted = True
            break
        retained |= following
        wave = following
    ids = {operations[key]['output'] for key in retained
           if operations[key]['output'] is not None} | {
               i['value_id'] for key in retained for i in operations[key]['inputs']
               if i['value_id'] is not None}
    frontier = {values[i['value_id']]['definition'] for key in retained
                for i in operations[key]['inputs'] if i['value_id'] is not None
                and values[i['value_id']]['definition'] is not None} - retained
    payload = {'operations': [operations[key] for key in sorted(retained)],
               'values': [values[key] for key in sorted(ids)]}
    return {'requested_definition_depth': depth, 'operation_budget': cap,
            'operation_budget_exhausted': exhausted, 'operations': len(retained),
            'values': len(ids), 'encoded_bytes': len(encoded(payload)),
            'unexpanded_definition_frontier': len(frontier)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('native_json', type=Path)
    parser.add_argument('report_json', type=Path)
    parser.add_argument('--verify-capture', type=Path,
                        help='Also compare a public projection capture with this full diagnostic')
    args = parser.parse_args()
    budget = 32 * 1024 * 1024
    raw = bounded_source(args.native_json, budget)
    document = json.loads(raw)
    assert len(document['functions']) == 1
    function = document['functions'][0]
    assert function['address_hex'] == '0xea6d0', 'This is the seeded SQLite VM experiment'
    graph = function['atomic_facts']
    assert graph['schema_version'] == 3
    assert len(graph['operations']) <= 32000 and len(graph['values']) <= 72000
    tables = ['blocks', 'operations', 'values']
    assert set(graph) == {'schema_version', 'coverage', *tables}
    packed = {'encoding': 'diagnostic-tuples-proposal-not-public',
              'schema_version': graph['schema_version'], 'columns': COLUMNS,
              'coverage': graph['coverage'],
              **{key: pack(key, graph[key]) for key in tables}}
    restored = {'schema_version': packed['schema_version'], 'coverage': packed['coverage'],
                **{key: unpack(key, packed[key]) for key in tables}}
    assert restored == graph
    operations = {row['id']: row for row in graph['operations']}
    values = {row['id']: row for row in graph['values']}
    assert len(operations) == len(graph['operations'])
    assert len(values) == len(graph['values'])
    calls = function['atomic_calls']['items']
    selected = [row['id'] for row in calls
                if row['origin_address'] in ('0xf115c', '0xf238b')]
    assert len(selected) == 2
    report = {
        'scope': 'Offline diagnostic sizes, not public-provider or model results. '
                 'Tuple roundtrip is lossless, but no native codec is implemented. '
                 'Projections follow retained SSA operands only; no CFG, aliases, '
                 'source equivalence or runtime proof. Bytes are not token/time savings.',
        'source': str(args.native_json), 'source_sha256': hashlib.sha256(raw).hexdigest(),
        'whole_native_document_bytes': len(raw), 'full_graph_bytes': len(encoded(graph)),
        'lossless_tuple_graph_bytes': len(encoded(packed)), 'tuple_roundtrip_equal': True,
        'estimated_whole_tuple_document_bytes': len(raw) - len(encoded(graph)) + len(encoded(packed)),
        'operations': len(operations), 'values': len(values), 'blocks': len(graph['blocks']),
        'inputs': sum(len(row['inputs']) for row in operations.values()),
        'cfg_edges': sum(len(row['successors']) for row in graph['blocks']),
        'statement_utf8_bytes': sum(len(row['statement'].encode()) for row in operations.values()),
        'value_type_utf8_bytes': sum(len(row['type_name'].encode()) for row in values.values()),
        'selected_call_projections': [projection(operations, values, selected, depth, 512)
                                      for depth in range(1, 6)],
        'all_call_projections': [projection(operations, values, [r['id'] for r in calls], depth, 4096)
                                 for depth in range(1, 5)],
    }
    if args.verify_capture:
        report['verified_projection'] = verify_capture(function, args.verify_capture)
    with args.report_json.open('x') as output:
        json.dump(report, output, indent=2)
        output.write('\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
