"""Verify real Obsidian query/SDK parity, paging and warm reads; no agent claims."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--quickjs', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    args.output.mkdir(mode=0o700)
    settings = args.output / 'settings.json'
    settings.write_text(json.dumps({'runtime': str(root), 'output': str(args.output / 'backend'),
                                   'tools': ['analyze_javascript_application', 'inspect_analysis_view'],
                                   'quickjs': str(args.quickjs), 'code_api': 'typed-async'}))
    errors = (args.output / 'stderr.log').open('w')
    process = subprocess.Popen([shutil.which('node'), str(root / 'experiments/browser-electron-code-mode/backend.mjs'), str(settings)],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True)

    def rpc(request):
        process.stdin.write(json.dumps(request) + '\n')
        process.stdin.flush()
        response = json.loads(process.stdout.readline())
        if not response['ok']:
            raise RuntimeError(response)
        return response['value']

    def call(view):
        return rpc({'kind': 'call', 'tool': 'inspect_analysis_view', 'arguments': {
            'source': {'kind': 'retained-evidence', 'evidence_id': parent}, 'view': view}})

    try:
        task = json.loads((args.data / 'dependencies/obsidian-dependencies.json').read_text())
        bootstrap = rpc({'kind': 'call', **task['bootstrap']})
        parent = bootstrap['normalized_result']['parent_evidence_id']
        request = {'kind': 'javascript', 'collection': 'modules', 'projection': 'references',
                   'where': {'path': 'main.js', 'kind': 'javascript-module'}, 'limit': 64}
        durations = []
        for _ in range(3):
            tick = time.monotonic()
            typed = call(request)
            durations.append(time.monotonic() - tick)
        page = typed['normalized_result']
        assert len(page['rows']) == 23
        assert page['coverage']['exhausted']
        assert page['source_coverage']['source_selection']['unselected_files'] == 36
        assert page['source_coverage']['application']['status'] == 'partial'
        legacy = call({'kind': 'page', 'collection': 'modules', 'offset': 0, 'limit': 100})
        items = []
        for row in legacy['normalized_result']['items']:
            if row['path'] != 'main.js' or row['kind'] != 'javascript-module':
                continue
            item = call({'kind': 'item', 'collection': 'modules', 'selector': {'node_id': row['node_id']}})
            items.append(item)
        owners = {item['normalized_result']['item']['node_id']: item['normalized_result']['item'] for item in items}
        assert set(owners) == {row['node_id'] for row in page['rows']}
        for row in page['rows']:
            item = owners[row['node_id']]
            assert row['identity'] == item['identity']
            assert row['retained_source_range_count'] == len(item['source_ranges'])
            assert {(b['authority'], b['state'], b['confidence']) for b in row['basis']} == {
                (o['evidence']['authority'], o['evidence']['state'], o['evidence']['confidence']) for o in item['observations']}
        code = '''const app=rea.javascript.fromEvidence(PARENT);
const counts={}; const ids=[]; const sources=[];
for await (const result of app.modules.pages({where:{path:'main.js',kind:'javascript-module'},limit:7})) {
  if(!result.ok) throw new Error(JSON.stringify(result.error));
  sources.push(result.value.evidence_id);
  for(const row of result.value.page.rows) {
    ids.push(row.node_id); const id=row.identity;
    if(id.strategy==='artifact-local-key' && id.namespace==='unresolved-semantic-module' && id.key.startsWith('external:'))
      counts[id.key.slice(9)]=(counts[id.key.slice(9)]??0)+row.retained_source_range_count;
  }
}
print({counts,ids,sources});'''.replace('PARENT', json.dumps(parent))
        result = rpc({'kind': 'code', 'code': code})
        assert result['status'] == 'completed', result
        assert result['backend_calls'] == 4, result
        oracle = json.loads((args.data / 'dependencies/oracles.json').read_text())['obsidian-dependencies']
        assert result['printed'][0]['counts'] == oracle['external_specifiers']
        assert result['printed'][0]['ids'] == [row['node_id'] for row in page['rows']]
        early = rpc({'kind': 'code', 'code': 'for await(const r of rea.javascript.fromEvidence(' + json.dumps(parent) + ').modules.pages({limit:1})) { print(r.ok); break; }'})
        assert early['status'] == 'completed' and early['backend_calls'] == 1, early
        missing = rpc({'kind': 'code', 'code': 'const r=await rea.javascript.fromEvidence("ev_' + '0' * 64 + '").modules.references(); print(r);'})
        assert missing['status'] == 'completed' and missing['printed'][0]['ok'] is False, missing
        output = {'scope': 'Real shipped Obsidian via production MCP and experimental async SDK; deterministic boundary verification, not agent sampling.',
                  'artifact_sha256': oracle['artifact_sha256'], 'parent_evidence_id': parent,
                  'matching_module_count': len(owners), 'external_specifiers': result['printed'][0]['counts'],
                  'legacy_structured_bytes': len(json.dumps([legacy, *items], separators=(',', ':')).encode()),
                  'typed_structured_bytes': len(json.dumps(typed, separators=(',', ':')).encode()),
                  'query_roundtrip_seconds': {'first': durations[0], 'repeated': durations[1:]},
                  'sdk_pages': result['backend_calls'], 'early_exit_calls': early['backend_calls'],
                  'missing_parent_explicit_error': True, 'source_partiality_preserved': True,
                  'cache': 'Same retained snapshot; no new query cache introduced. First query is after preparation, not cold analysis.',
                  'measured_agent_tokens': None}
        (args.output / 'verification.json').write_text(json.dumps(output, indent=2) + '\n')
        print(json.dumps(output))
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
        errors.close()


if __name__ == '__main__':
    main()
