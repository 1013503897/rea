"""Independent ELF/GNU oracle for the pinned SQLite pooled-string task."""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Run the oracle without Python optimization')
binary, output = map(Path, sys.argv[1:])
raw = binary.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
assert digest == '2e6eef9a727f081f0d453b4e5e6cbd8b9ef8b6f86cbf7681cbad444d3b0b55c8'
assert raw[:6] == b'\x7fELF\x02\x01' and struct.unpack_from('<H', raw, 18)[0] == 62
phoff = struct.unpack_from('<Q', raw, 32)[0]
phsize, phcount = struct.unpack_from('<HH', raw, 54)
assert phsize >= 56 and phoff + phsize * phcount <= len(raw)
segments = [struct.unpack_from('<IIQQQQQQ', raw, phoff + i * phsize) for i in range(phcount)]


def loaded(address, length):
    matches = [p for p in segments if p[0] == 1 and p[3] <= address
               and address + length <= p[3] + p[5]]
    assert len(matches) == 1
    segment = matches[0]
    start = segment[2] + address - segment[3]
    assert start + length <= len(raw)
    return raw[start:start + length]


spans = [(0x11b376, 0x11b383, b'no such table\0'),
         (0x11b33f, 0x11b34c, b'sqlite_schema\0')]
for start, end, text in spans:
    assert loaded(start, end - start + 1) == text
expected = {(0x4215c, 0x11b376), (0x2d709, 0x11b37e),
            (0x4565e, 0x11b37e), (0x4573d, 0x11b37e),
            (0x48b2e, 0x11b37e), (0xbad38, 0x11b37e),
            (0xbd1f0, 0x11b37e), (0x422c5, 0x11b33f),
            (0x41f0b, 0x11b346), (0x41f65, 0x11b346), (0x41fb2, 0x11b346)}
observed = set()
# Decode from the ELF's normal instruction sections, not arbitrary mid-instruction
# window starts. Nearest/synthetic symbol labels do not establish target identity.
with subprocess.Popen(['objdump', '-d', '-w', '--no-show-raw-insn', str(binary)],
                      stdout=subprocess.PIPE, text=True) as child:
    for line in child.stdout:
        match = re.match(r'\s*([0-9a-f]+):\s+lea\w*\s+.*#\s*([0-9a-f]+)\b', line)
        if match:
            source, target = (int(value, 16) for value in match.groups())
            if any(start <= target <= end for start, end, _ in spans):
                observed.add((source, target))
    assert child.wait() == 0
assert observed == expected
owners = {
    0x4215c: (0x420d0, 'sqlite3LocateTable'),
    0x2d709: (0x2d600, 'sqlite3AlterRenameTable'),
    0x4565e: (0x45590, 'sqlite3StartTable'),
    0x4573d: (0x45590, 'sqlite3StartTable'),
    0x48b2e: (0x47ff0, 'sqlite3EndTable'),
    0xbad38: (0xb90e0, 'sqlite3Pragma'),
    0xbd1f0: (0xbd1b0, 'sqlite3InitOne'),
    0x422c5: (0x42280, 'sqlite3PreferredTableName'),
    0x41f0b: (0x41db0, 'sqlite3FindTable'),
    0x41f65: (0x41db0, 'sqlite3FindTable'),
    0x41fb2: (0x41db0, 'sqlite3FindTable'),
}
symbols = set()
for line in subprocess.check_output(['readelf', '-Ws', str(binary)], text=True).splitlines():
    fields = line.split()
    if len(fields) == 8 and fields[3] == 'FUNC' and fields[6] != 'UND':
        symbols.add((int(fields[1], 16), int(fields[2]), fields[7]))
for at, (entry, name) in owners.items():
    assert any(start == entry and symbol == name and start <= at < start + size
               for start, size, symbol in symbols)


def lea(at):
    data = loaded(at, 7)
    assert data[0] & 0xf8 == 0x48 and data[1] == 0x8d and data[2] & 0xc7 == 0x05
    register = ((data[2] >> 3) & 7) | ((data[0] & 4) << 1)
    names = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
             'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15']
    return at + 7 + struct.unpack_from('<i', data, 3)[0], names[register]


for source, target in expected:
    assert lea(source)[0] == target
assert lea(0x2d709) == (0x11b37e, 'rdx')
assert lea(0x4215c) == (0x11b376, 'rdx')
assert lea(0x42163) == (0x11b369, 'rax')
assert lea(0x4217c) == (0x11b38c, 'rsi')
assert loaded(0x11b369, 13) == b'no such view\0'
assert loaded(0x42158, 4).hex() == '4183e501'  # AND R13D,1: sets flags
assert loaded(0x4216a, 4).hex() == '480f45d0'  # CMOVNE RDX,RAX
relocations = subprocess.check_output(['readelf', '-Wr', str(binary)], text=True)
calls = []
for at, target, name in [(0x2d716, 0x29060, 'sqlite3CheckObjectName'),
                         (0x42185, 0x2a1e0, 'sqlite3ErrorMsg')]:
    call = loaded(at, 5)
    assert call[0] == 0xe8 and at + 5 + struct.unpack_from('<i', call, 1)[0] == target
    stub = target
    if loaded(stub, 4) == b'\xf3\x0f\x1e\xfa':
        stub += 4
    if loaded(stub, 1) == b'\xf2':
        stub += 1
    jump = loaded(stub, 6)
    assert jump[:2] == b'\xff\x25'
    slot = stub + 6 + struct.unpack_from('<i', jump, 2)[0]
    assert re.search(rf'^0*{slot:x}\s+[0-9a-f]+\s+R_X86_64_JUMP_SLOT\s+[0-9a-f]+\s+{name}\s+\+\s+0$',
                     relocations, re.MULTILINE)
    calls.append({'origin': hex(at), 'plt_entry': hex(target), 'slot': hex(slot), 'relocation_symbol': name})
report = {'binary_sha256': digest, 'elf_machine': 62,
          'spans': [{'start': hex(s), 'end_inclusive': hex(e), 'bytes_with_nul': e - s + 1} for s, e, _ in spans],
          'gnu_lea_and_file_target_pairs': [[hex(a), hex(b)] for a, b in sorted(expected)],
          'elf_function_symbol_membership': [
              {'from': hex(at), 'entry': hex(entry), 'name': name}
              for at, (entry, name) in sorted(owners.items())],
          'selected_passing_register': 'rdx', 'selected_plt_calls': calls,
          'conditional_message_selection': {'mask_at': '0x42158', 'mask': 1, 'cmovne_at': '0x4216a',
                                             'zero_keeps': '0x11b376', 'nonzero_selects': '0x11b369'},
          'scope': 'Independent fixed-fixture file/GNU checks; not Kuna output, global reference completeness, target execution or live PLT binding.'}
with output.open('x') as stream:
    json.dump(report, stream, indent=2)
print(json.dumps(report))
