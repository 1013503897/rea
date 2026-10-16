"""Real native CLI PLT identity through both ELF loader paths; never execute SSH."""

import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError("Run the fixture verifier without Python optimization")

engine, binary, output = map(Path, sys.argv[1:])
raw = binary.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
assert digest == 'de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068'
assert len(raw) == 1051744 and raw[:6] == b'\x7fELF\x02\x01'
assert struct.unpack_from('<Q', raw, 40)[0] != 0
derived = bytearray(raw)
derived[40:48] = bytes(8)  # e_shoff
derived[58:64] = bytes(6)  # e_shentsize/e_shnum/e_shstrndx
derived_path = output.with_suffix('.without-section-table.elf')
with derived_path.open('xb') as stream:
    stream.write(derived)
report = {'binary_sha256': digest, 'sectionless_derivation': {
    'path': str(derived_path), 'sha256': hashlib.sha256(derived).hexdigest(),
    'zeroed_header_ranges': [[40, 48], [58, 64]],
}, 'engine_sha256': None, 'runs': []}
with engine.open('rb') as stream:
    report['engine_sha256'] = hashlib.file_digest(stream, 'sha256').hexdigest()
for kind, target in [('sections', binary), ('dynamic-segment-fallback', derived_path)]:
    command = [str(engine), 'functions', str(target), '--json']
    result = subprocess.run(command, capture_output=True, check=True)
    source_path = output.with_suffix(f'.{kind}.native-json')
    with source_path.open('xb') as stream:
        stream.write(result.stdout)
    functions = json.loads(result.stdout)['functions']
    by_address = {row['address_hex']: row for row in functions}
    for entry, body, name in [('0xbad0', '0xbad4', 'free'),
                              ('0xbdd0', '0xbdd4', '_exit')]:
        assert by_address[entry]['name'] == name
        assert body not in by_address, (kind, 'split entry survives', body)
    report['runs'].append({'kind': kind, 'command': command,
                           'functions': len(functions),
                           'free_entry': '0xbad0', '_exit_entry': '0xbdd0',
                           'raw_source_path': str(source_path),
                           'raw_source_sha256': hashlib.sha256(result.stdout).hexdigest()})
report['scope'] = 'Real native CLI loader paths; sectionless input is a derived copy. No target execution, runtime symbol binding or return-feasibility proof.'
with output.open('x') as stream:
    json.dump(report, stream, indent=2)
print(json.dumps(report))
