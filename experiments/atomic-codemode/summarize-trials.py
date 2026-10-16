"""Summarize actual model usage and owned process-family counters, without grading answers."""

import argparse
import collections
import json
from pathlib import Path


def client_observations(directory, declared_usage):
    path = directory / 'codex-tool-context.jsonl'
    receipt_path = directory / 'context-receipt.json'
    if not path.exists() or not receipt_path.exists():
        return {'availability': 'unavailable', 'model_responses': None,
                'tool_calls': None, 'per_response_usage_matches_summary': None}
    receipt = json.loads(receipt_path.read_text())
    responses, calls = {}, {}
    for line in path.read_text().splitlines():
        event = json.loads(line)
        payload = event['payload']
        if event['type'] == 'token_usage_record':
            key, value = payload['response_id'], payload['usage']
            if key in responses and responses[key] != value:
                raise ValueError('Conflicting usage for the same model response')
            responses[key] = value
        elif event['type'] == 'response_item' and payload['type'] in (
                'custom_tool_call', 'function_call'):
            key = payload['call_id']
            if key in calls and calls[key] != payload:
                raise ValueError('Conflicting records for the same client call')
            calls[key] = payload
    totals = collections.Counter()
    for usage in responses.values():
        totals.update(usage)
    complete = receipt['status'] == 'captured'
    matches = (all(totals[key] == value for key, value in declared_usage.items())
               if complete and responses else None)
    if matches is False:
        raise ValueError('Per-response usage differs from the runner summary')
    return {
        'availability': receipt['status'],
        'model_responses': len(responses) if responses else None,
        'tool_calls': dict(collections.Counter(value['name'] for value in calls.values())),
        'per_response_usage_matches_summary': matches,
        'scope': 'Observed unique model responses and client dispatch/wait calls. '
                 'Configured Code Mode feature flags do not establish the actual '
                 'client tool surface. MCP requests are not model response rounds.',
    }


def trace_observations(path):
    """Transport completion is separate from a failed analysis/API response."""
    if not path.exists():
        return {'availability': 'unavailable', 'code_mode_calls': None,
                'code_mode_failures': None, 'direct_fact_calls': None,
                'api_failures': None, 'code_mode_evidence_count': None}
    methods, direct = collections.Counter(), collections.Counter()
    inner_failures, failures, source_ids = [], [], set()
    for line in path.read_text().splitlines():
        entry = json.loads(line)
        result, tool = entry['result'], entry['tool']
        if tool == 'execute_javascript':
            for call in result.get('calls', []):
                methods[call['method']] += 1
                if call['status'] != 'ok':
                    inner_failures.append(call)
                    failures.append({'tool': tool, 'scope': 'inner-api', **call})
            source_ids.update(result.get('evidence_ids', []))
        elif tool.startswith('facts_'):
            direct[tool] += 1
        if result.get('ok') is False:
            failures.append({'tool': tool, 'scope': 'mcp-result',
                             'error': result.get('error')})
    return {'availability': 'captured', 'code_mode_calls': dict(methods),
            'code_mode_failures': inner_failures, 'direct_fact_calls': dict(direct),
            'api_failures': failures, 'code_mode_evidence_count': len(source_ids)}


def summarize(directory):
    summary = json.loads((directory / 'summary.json').read_text())
    resource_records = [json.loads(line) for line in directory.with_suffix('.log').read_text().splitlines()
                        if line.startswith('{"resource_scope":')]
    if len(resource_records) != 1:
        raise ValueError(f'{directory}: expected one process-family resource receipt')
    resources = resource_records[0]
    observation = resources['payload_resource_observation']
    if observation['phase'] != 'payload-exited-observer-alive':
        raise ValueError(f'{directory}: payload-exit counters were not observed')
    usage = collections.Counter()
    for turn in summary['usage']:
        usage.update(turn)
    client = client_observations(directory, usage)
    calls = summary['completed_mcp_calls']  # This runner key also retains failed attempts.
    statuses = collections.Counter(call['status'] for call in calls)
    trace = trace_observations(directory.with_suffix('.trace.jsonl'))
    usage['uncached_input_tokens'] = usage['input_tokens'] - usage['cached_input_tokens']
    cleanup = json.loads((directory / 'cleanup.json').read_text())
    return {
        'trial': directory.name,
        'runtime_revision': summary['runtime_revision'],
        'runtime_inputs_unchanged': summary.get('runtime_inputs_unchanged'),
        'experimental_engine': summary.get('experimental_engine'),
        'experimental_engine_unchanged': summary.get('experimental_engine_unchanged'),
        'requested_model': summary['requested_model'],
        'reasoning': summary['reasoning'],
        'usage': dict(usage),
        'client_observations': client,
        'outer_attempts': len(calls),
        'outer_attempt_scope': 'MCP requests, not model responses or client executor calls',
        'outer_statuses': dict(statuses),
        'outer_failures': [{k: call[k] for k in ('tool', 'status', 'error')}
                           for call in calls if call['status'] != 'completed'],
        'trace_availability': trace['availability'],
        'inner_code_mode_calls': trace['code_mode_calls'],
        'inner_api_failures': trace['code_mode_failures'],
        'direct_fact_calls': trace['direct_fact_calls'],
        'api_failures': trace['api_failures'],
        'code_mode_evidence_count': trace['code_mode_evidence_count'],
        'model_wall_seconds': summary['wall_seconds'],
        'family_wall_seconds': resources['elapsed_seconds'],
        'family_cpu_seconds': observation['cpu_stat']['usage_usec'] / 1_000_000,
        'family_memory_peak_bytes': observation['memory_peak_bytes'],
        'memory_events': observation['resource_events']['memory.events'],
        'resource_abort': resources['abort'],
        'payload_cleanup_verified': observation['payload_cleanup_verified'],
        'profile_cleanup': cleanup,
        'target_sha256': summary['selected_artifact_sha256_before'],
        'target_unchanged': summary['selected_artifact_bytes_unchanged'],
        'correctness': 'requires separate answer/source-oracle review',
        'scope': 'Actual cumulative usage includes discovery/retries; cached input is included in input, reasoning in output. Memory is kernel cgroup peak including charged file cache. Server-side compute and resolved model build are unmeasured.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directories', type=Path, nargs='+')
    options = parser.parse_args()
    print(json.dumps([summarize(path) for path in options.directories], indent=2))


if __name__ == '__main__':
    main()
