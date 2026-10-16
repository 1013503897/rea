"""The cost ledger must not confuse MCP batching with model response rounds."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'summarize_trials', Path(__file__).with_name('summarize-trials.py'))
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)


class ClientObservations(unittest.TestCase):
    def test_transport_success_preserves_direct_timeout_and_code_mode_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'trace.jsonl'
            self.assertIsNone(ledger.trace_observations(path)['api_failures'])
            entries = [
                {'tool': 'facts_snapshot', 'result': {
                    'ok': False, 'error': {'code': 'provider_timeout'}}},
                {'tool': 'facts_snapshot', 'result': {'ok': True, 'data': {}}},
                {'tool': 'execute_javascript', 'result': {
                    'ok': True, 'evidence_ids': ['ev_a'], 'calls': [
                        {'method': 'snapshot', 'status': 'error',
                         'error': {'code': 'provider_timeout'}}]}},
                {'tool': 'execute_javascript', 'result': {
                    'ok': False, 'error': {'code': 'output_budget'},
                    'calls': [], 'evidence_ids': ['ev_a']}},
            ]
            path.write_text('\n'.join(json.dumps(e) for e in entries))
            result = ledger.trace_observations(path)
            self.assertEqual(result['direct_fact_calls'], {'facts_snapshot': 2})
            self.assertEqual(result['code_mode_calls'], {'snapshot': 1})
            self.assertEqual(len(result['api_failures']), 3)
            self.assertEqual(result['api_failures'][0]['error']['code'], 'provider_timeout')
            self.assertEqual(len(result['code_mode_failures']), 1)
            self.assertEqual(result['code_mode_evidence_count'], 1)

    def test_distinct_responses_and_dispatch_calls_deduplicate_by_identity(self):
        usage = {'input_tokens': 12, 'cached_input_tokens': 8, 'output_tokens': 2}
        events = [
            {'type': 'token_usage_record', 'payload': {'response_id': 'response', 'usage': usage}},
            {'type': 'response_item', 'payload': {
                'type': 'custom_tool_call', 'name': 'exec', 'call_id': 'dispatch',
                'input': 'Two MCP calls may occur inside this one client dispatch.'}},
            {'type': 'response_item', 'payload': {
                'type': 'function_call', 'name': 'wait', 'call_id': 'wait', 'arguments': '{}'}},
        ]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'context-receipt.json').write_text(json.dumps({'status': 'captured'}))
            path = root / 'codex-tool-context.jsonl'
            path.write_text('\n'.join(json.dumps(event) for event in events * 2))
            result = ledger.client_observations(root, usage)
            self.assertEqual(result['model_responses'], 1)
            self.assertEqual(result['tool_calls'], {'exec': 1, 'wait': 1})
            self.assertTrue(result['per_response_usage_matches_summary'])
            with self.assertRaisesRegex(ValueError, 'differs'):
                ledger.client_observations(root, {'input_tokens': 13})
            conflicting = {'type': 'token_usage_record', 'payload': {
                'response_id': 'response', 'usage': {'input_tokens': 13}}}
            with path.open('a') as output:
                output.write('\n' + json.dumps(conflicting))
            with self.assertRaisesRegex(ValueError, 'Conflicting usage'):
                ledger.client_observations(root, usage)

    def test_missing_or_partial_capture_does_not_claim_zero_calls_or_complete_usage(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.assertIsNone(ledger.client_observations(root, {})['model_responses'])
            (root / 'context-receipt.json').write_text(json.dumps({'status': 'partial'}))
            (root / 'codex-tool-context.jsonl').write_text('')
            result = ledger.client_observations(root, {'input_tokens': 100})
            self.assertIsNone(result['model_responses'])
            self.assertIsNone(result['per_response_usage_matches_summary'])


if __name__ == '__main__':
    unittest.main()
