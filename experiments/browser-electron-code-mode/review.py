"""Exact task checks and resource observations; never infer unobserved counters."""

import argparse
import hashlib
import json
from pathlib import Path
import re


def evidence_ids(response):
    # IDs echoed in target text or failed request diagnostics are not provenance.
    value = response.get('structuredContent')
    if response.get('isError') or not isinstance(value, dict):
        return set()
    own = value.get('evidence_id')
    if not isinstance(own, str) or re.fullmatch(r'ev_[a-f0-9]{64}', own) is None:
        return set()
    links = value.get('evidence_links', [])
    return {own} | {link for link in links if isinstance(link, str)
                    and re.fullmatch(r'ev_[a-f0-9]{64}', link)}


def canonical(field, value):
    if field == 'sender_validation_observations' and isinstance(value, dict):
        return value.get('count')
    if field == 'node_ids' and isinstance(value, dict) and all(isinstance(items, list) for items in value.values()):
        value = [item for items in value.values() for item in items]
    if field == 'node_ids' and isinstance(value, list) and all(isinstance(item, str) for item in value):
        return sorted(value)
    if field == 'groups' and isinstance(value, list):
        if not all(isinstance(row, dict) and set(row) == {'hostname', 'status', 'count', 'record_ordinals'}
                   and isinstance(row['hostname'], str) and type(row['status']) is int
                   and type(row['count']) is int and isinstance(row['record_ordinals'], list)
                   and all(type(index) is int for index in row['record_ordinals']) for row in value):
            return None
        return sorted((row.get('hostname'), row.get('status'), row.get('count'),
                       sorted(row.get('record_ordinals', []))) for row in value)
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cohort', type=Path, required=True)
    args = parser.parse_args()
    plan = json.loads((args.cohort / 'plan.json').read_text())
    oracles = json.loads((args.cohort / 'oracles.json').read_text())
    results = []
    for row in plan['trials']:
        label = row['task'] + '-' + row['arm']
        directory = args.cohort / label
        if not (directory / 'receipt.json').exists():
            results.append({'trial': label, 'status': 'missing_receipt', 'success': False})
            continue
        receipt = json.loads((directory / 'receipt.json').read_text())
        answer_value = json.loads((directory / 'answer.json').read_text()) if (directory / 'answer.json').exists() else None
        answer = answer_value if isinstance(answer_value, dict) else {}
        checks = {key: canonical(key, answer.get(key)) == canonical(key, expected)
                  and type(canonical(key, answer.get(key))) is type(canonical(key, expected))
                  for key, expected in oracles[row['task']].items()}
        checks['frozen_task'] = receipt['task_sha256'] == row['task_sha256'] == hashlib.sha256(
            (args.cohort / row['task_file']).read_bytes()).hexdigest()
        known = set()
        for path in (directory / 'backend').glob('call-*.json'):
            known.update(evidence_ids(json.loads(path.read_text())))
        saved_index = directory / 'evidence-index.json'
        if not (directory / 'backend').exists() and saved_index.exists():
            known.update(json.loads(saved_index.read_text())['successful_evidence_ids'])
        ids = answer.get('evidence_ids')
        checks['evidence_ids'] = isinstance(ids, list) and bool(ids) and all(
            isinstance(value, str) and value in known for value in ids)
        limitations = answer.get('limitations')
        checks['limitations_present'] = (
            isinstance(limitations, str) and bool(limitations.strip())
            or isinstance(limitations, list) and bool(limitations)
            and all(isinstance(item, str) and bool(item.strip()) for item in limitations))
        # Narrative honesty is separately reviewed from the complete retained answer.
        resources = None
        log = args.cohort / (label + '.log')
        lines = log.read_text().splitlines() if log.exists() else []
        for line in lines:
            try:
                value = json.loads(line)
            except ValueError:
                continue
            if isinstance(value, dict) and 'resource_scope' in value:
                resources = value
        if resources is None and (directory / 'resources.json').exists():
            records = json.loads((directory / 'resources.json').read_text())
            resources = records[-1] if records else None
        payload = (resources or {}).get('payload_resource_observation')
        verified = (resources or {}).get('payload_resource_observation_verified') is True
        observed_usage = [step['usage'] for step in receipt['rounds'] if step.get('usage') is not None]
        usage = {key: sum(step.get(key, 0) for step in observed_usage) for key in
                 ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens',
                  'output_tokens', 'reasoning_output_tokens']}
        result = {'trial': label, 'arm': row['arm'], 'task': row['task'],
                  'answer_type': type(answer_value).__name__,
                  'status': receipt['status'], 'treatment_valid': receipt['treatment_valid'],
                  'checks': checks, 'facts_pass': all(checks.values()),
                  'usage': usage, 'uncached_input_tokens': usage['input_tokens'] - usage['cached_input_tokens'],
                  'usage_complete': receipt['status'] == 'answered' and len(observed_usage) == len(receipt['rounds']),
                  'rounds': len(receipt['rounds']),
                  'max_request_input_tokens': max((step.get('usage') or {}).get('input_tokens', 0)
                                                  for step in receipt['rounds']),
                  'model_observation_bytes': sum(step.get('observation_bytes', 0) for step in receipt['rounds']),
                  'discovery_rounds': sum(step.get('action_kind') == 'docs' for step in receipt['rounds']),
                  'discovery_response_bytes': sum(step.get('observation_bytes', 0) for step in receipt['rounds']
                                                  if step.get('action_kind') == 'docs'),
                  'elapsed_seconds': receipt['elapsed_seconds'],
                  'whole_scope_seconds': (resources or {}).get('elapsed_seconds'),
                  'preparation_seconds': receipt['preparation_seconds'],
                  'question_seconds': receipt['elapsed_seconds'] - receipt['preparation_seconds'],
                  'resources_verified_at_payload_exit': verified,
                  'cpu_seconds_at_payload_exit': payload['cpu_stat']['usage_usec'] / 1e6 if verified else None,
                  'peak_bytes_at_payload_exit': payload['memory_peak_bytes'] if verified else None,
                  'resource_events_at_payload_exit': payload['resource_events'] if verified else None,
                  'resource_abort': (resources or {}).get('abort'),
                  'backend_calls': (len((directory / 'backend/calls.jsonl').read_text().splitlines())
                                    if (directory / 'backend/calls.jsonl').exists()
                                    else len(json.loads(saved_index.read_text())['producer_response_files'])),
                  'code_actions': sum(step.get('action_kind') == 'code' for step in receipt['rounds'])}
        result['success'] = result['facts_pass'] and receipt['treatment_valid'] and verified and not result['resource_abort']
        results.append(result)
    report = {'scope': plan['scope'], 'oracle_scope': plan['oracle_scope'], 'trials': results,
              'accepted_shapes': 'node_ids may be a list or a mapping of kinds to lists; sender_validation_observations may be a count object; limitations may be prose or a string list. Exact facts still required.',
              'narrative_review': 'Required separately: supporting IDs alone do not establish claim-level support.'}
    (args.cohort / 'review.json').write_text(json.dumps(report, indent=2) + '\n')
    for row in results:
        print(json.dumps({key: row.get(key) for key in ['trial', 'success', 'rounds', 'usage',
              'question_seconds', 'cpu_seconds_at_payload_exit', 'peak_bytes_at_payload_exit']}))


if __name__ == '__main__':
    main()
