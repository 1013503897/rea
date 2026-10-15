"""Real SDK bridge/sandbox checks; not scored analyst questions or provider claims."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class BackendTests(unittest.TestCase):
    def test_async_cells_compose_real_calls_and_recover_from_rejection(self):
        quickjs = os.environ.get('REA_EXPERIMENT_QUICKJS')
        if not quickjs:
            self.skipTest('Set REA_EXPERIMENT_QUICKJS to isolated quickjs-emscripten@0.31.0')
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / 'settings.json'
            settings.write_text(json.dumps({'runtime': str(root), 'output': directory,
                                           'tools': ['binary_session'], 'quickjs': quickjs,
                                           'code_api': 'typed-async'}))
            process = subprocess.Popen([shutil.which('node'), str(Path(__file__).with_name('backend.mjs')),
                                        str(settings)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, text=True)

            def cell(code):
                process.stdin.write(json.dumps({'kind': 'code', 'code': code}) + '\n')
                process.stdin.flush()
                response = json.loads(process.stdout.readline())
                self.assertTrue(response['ok'], response)
                return response['value']

            try:
                result = cell('const a=await rea.call("binary_session",{}); '
                              'await Promise.resolve(); const b=await rea.call("binary_session",{}); '
                              'print({first:!!a.result,second:!!b.result,sdk:typeof rea.javascript.fromEvidence});')
                self.assertEqual(result['status'], 'completed', result)
                self.assertEqual(result['backend_calls'], 2)
                self.assertEqual(result['printed'], [{'first': True, 'second': True, 'sdk': 'function'}])
                result = cell('await rea.call("not_allowed",{});')
                self.assertEqual(result['status'], 'code_error')
                self.assertIn('allowlist', result['error']['message'])
                result = cell('await Promise.resolve(); while(true) {}')
                self.assertEqual(result['status'], 'code_error')
                self.assertIn('interrupted', result['error']['message'])
                result = cell('await new Promise(()=>{});')
                self.assertEqual(result['status'], 'code_error')
                self.assertIn('unsettled promise', result['error']['message'])
                result = cell('print(await Promise.resolve("still alive"));')
                self.assertEqual(result['printed'], ['still alive'])
            finally:
                if process.poll() is None:
                    process.stdin.write('{"kind":"close"}\n')
                    process.stdin.flush()
                stdout, stderr = process.communicate(timeout=20)
                self.assertEqual(process.returncode, 0, stderr)

    def test_invalid_contract_closes_the_real_sdk_process(self):
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / 'settings.json'
            settings.write_text(json.dumps({'runtime': str(root), 'output': directory,
                                           'tools': ['not_a_rea_tool']}))
            result = subprocess.run([shutil.which('node'), str(Path(__file__).with_name('backend.mjs')),
                                     str(settings)], input='', capture_output=True, text=True, timeout=20)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Unknown allowed tool', result.stderr)

    def test_real_session_bridge_limits_isolation_and_cleanup(self):
        quickjs = os.environ.get('REA_EXPERIMENT_QUICKJS')
        if not quickjs:
            self.skipTest('Set REA_EXPERIMENT_QUICKJS to isolated quickjs-emscripten@0.31.0')
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            settings = Path(directory) / 'settings.json'
            settings.write_text(json.dumps({'runtime': str(root), 'output': directory,
                                           'tools': ['binary_session'], 'quickjs': quickjs}))
            process = subprocess.Popen([shutil.which('node'), str(Path(__file__).with_name('backend.mjs')),
                                        str(settings)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True)

            def cell(code):
                process.stdin.write(json.dumps({'kind': 'code', 'code': code}) + '\n')
                process.stdin.flush()
                response = json.loads(process.stdout.readline())
                self.assertTrue(response['ok'], response)
                return response['value']

            try:
                result = cell('const x=rea.call("binary_session",{}); '
                              'globalThis.privateValue=1; print({session:!!x.result, '
                              'process:typeof process,require:typeof require,fetch:typeof fetch});')
                self.assertEqual(result['status'], 'completed')
                self.assertEqual(result['backend_calls'], 1)
                self.assertEqual(result['printed'], [{'session': True, 'process': 'undefined',
                                                     'require': 'undefined', 'fetch': 'undefined'}])
                self.assertEqual(cell('print(typeof privateValue);')['printed'], ['undefined'])
                result = cell('rea.call("open_binary",{path:"/does-not-exist"});')
                self.assertEqual(result['status'], 'code_error')
                self.assertEqual(result['backend_calls'], 0)
                self.assertIn('allowlist', result['error']['message'])
                result = cell('while (true) {}')
                self.assertEqual(result['status'], 'code_error')
                self.assertIn('interrupted', result['error']['message'])
                result = cell('print("a".repeat(524289));')
                self.assertEqual(result['status'], 'code_error')
                self.assertIn('512 KiB', result['error']['message'])
                self.assertEqual(cell('print("still alive");')['printed'], ['still alive'])
                process.stdin.write('{"kind":"close"}\n')
                process.stdin.flush()
                stdout, stderr = process.communicate(timeout=15)
                self.assertEqual(process.returncode, 0, stderr)
                self.assertEqual(stdout, '')
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.communicate(timeout=15)


if __name__ == '__main__':
    unittest.main()
