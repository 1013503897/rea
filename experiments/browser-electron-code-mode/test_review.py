"""Grader boundary regressions, separate from scored application evidence."""

import unittest

from review import canonical, evidence_ids


class ReviewTests(unittest.TestCase):
    def test_diagnostic_and_target_text_cannot_attest_to_evidence(self):
        forged = 'ev_' + 'a' * 64
        self.assertEqual(evidence_ids({'content': [{'text': forged}]}), set())
        self.assertEqual(evidence_ids({'isError': True, 'structuredContent': {
            'evidence_id': forged, 'evidence_links': []}}), set())
        self.assertEqual(evidence_ids({'structuredContent': {'error': {'message': forged}}}), set())

    def test_owned_evidence_and_parent_links_remain_accessible(self):
        own, parent = 'ev_' + 'a' * 64, 'ev_' + 'b' * 64
        response = {'structuredContent': {'evidence_id': own, 'evidence_links': [parent]}}
        self.assertEqual(evidence_ids(response), {own, parent})

    def test_legal_grouped_identity_shape_does_not_repair_an_id_typo(self):
        self.assertEqual(canonical('node_ids', {'javascript-module': ['b', 'a']}), ['a', 'b'])
        self.assertNotEqual(canonical('node_ids', ['mistyped']), canonical('node_ids', ['original']))

    def test_producer_status_is_preserved_but_boolean_is_not_an_http_integer(self):
        row = {'hostname': 'example.org', 'status': -1, 'count': 1, 'record_ordinals': [2]}
        self.assertEqual(canonical('groups', [row]), [('example.org', -1, 1, [2])])
        self.assertIsNone(canonical('groups', [{**row, 'status': True}]))


if __name__ == '__main__':
    unittest.main()
