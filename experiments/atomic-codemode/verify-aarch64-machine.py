"""Independent fixture oracle: file-backed ELF words, branch math and GNU FDEs."""

import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys


if sys.flags.optimize:
    raise RuntimeError("Run the fixture oracle without Python optimization")

binary, output = map(Path, sys.argv[1:])
assert binary.stat().st_size == 1051744, 'Select the documented Debian fixture'
raw = binary.read_bytes()
digest = hashlib.sha256(raw).hexdigest()
assert digest == 'de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068'
assert raw[:6] == b'\x7fELF\x02\x01'
assert struct.unpack_from('<H', raw, 18)[0] == 183  # EM_AARCH64
phoff = struct.unpack_from('<Q', raw, 32)[0]
phsize, phcount = struct.unpack_from('<HH', raw, 54)
assert phsize >= 56 and phoff + phsize * phcount <= len(raw)
segments = [struct.unpack_from('<IIQQQQQQ', raw, phoff + i * phsize)
            for i in range(phcount)]


def loaded(address, size):
    matches = [p for p in segments if p[0] == 1
               and p[3] <= address and address + size <= p[3] + p[5]]
    assert len(matches) == 1
    p = matches[0]
    offset = p[2] + address - p[3]
    assert offset + size <= len(raw)
    return raw[offset:offset + size]


def word(at):
    return int.from_bytes(loaded(at, 4), 'little')


def signed(value, bits):
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


def page(at, register, expected):
    w = word(at)
    assert w & 0x9f000000 == 0x90000000 and w & 31 == register
    immediate = ((w >> 5) & 0x7ffff) << 2 | ((w >> 29) & 3)
    result = ((at & ~0xfff) + (signed(immediate, 21) << 12)) & ((1 << 64) - 1)
    assert result == expected
    return result


def add(at, register, base, expected):
    w = word(at)
    assert w & 0xff800000 == 0x91000000  # 64-bit ADD immediate
    assert w & 31 == register and (w >> 5) & 31 == register
    result = base + (((w >> 10) & 0xfff) << (12 if w & (1 << 22) else 0))
    assert result == expected


add(0x25750, 6, page(0x2574c, 6, 0xb0000), 0xb0468)
add(0x2853c, 6, page(0x28534, 6, 0xb1000), 0xb1330)
for at, target, opcode in [(0x2841c, 0x256c0, 0x94000000),
                           (0x256f0, 0x3d108, 0x94000000),
                           (0x25754, 0x5ae04, 0x94000000),
                           (0x25858, 0xbad0, 0x14000000),
                           (0x2854c, 0x5ae04, 0x94000000),
                           (0x28550, 0x281c0, 0x14000000)]:
    w = word(at)
    assert w & 0xfc000000 == opcode
    assert at + (signed(w & 0x3ffffff, 26) << 2) == target

assert word(0x28414) == 0xaa1b03e0  # MOV X0,X27
assert word(0x256e8) == 0xaa0003f7  # MOV X23,X0
# The warning's normal epilogue restores LR/SP before a tail transfer to free.
# BTI is the called entry; the following ADRP is not another function entry.
assert word(0xbad0) == 0xd503245f  # BTI c
assert page(0xbad4, 16, 0x10f000) == 0x10f000
assert word(0xbad8) == 0xf941ca11  # LDR X17,[X16,#0x390]
add(0xbadc, 16, 0x10f000, 0x10f390)
assert word(0xbae0) == 0xd61f0220  # BR X17
assert word(0x2583c) == 0xa9417bfd  # LDP X29,X30,[SP,#16]
assert word(0x25850) == 0x910143ff  # ADD SP,SP,#0x50
assert word(0x25854) == 0xd50323bf  # AUTIASP
assert page(0x27904, 25, 0x10f000) == 0x10f000
w = word(0x27908)
assert w & 0xffc00000 == 0xf9400000 and w & 31 == 25 and (w >> 5) & 31 == 25
assert 0x10f000 + (((w >> 10) & 0xfff) << 3) == 0x10ff20
assert loaded(0x10ff20, 8).hex() == '7004110000000000'
w = word(0x2851c)
assert w & 0xffc00000 == 0xb9400000 and w & 31 == 0 and (w >> 5) & 31 == 25
assert ((w >> 10) & 0xfff) << 2 == 0x88
w = word(0x28524)
assert w & 0xff00001f == 0x34000000  # CBZ W0, ...
assert 0x28524 + (signed((w >> 5) & 0x7ffff, 19) << 2) == 0x28554
assert word(0x281f4) == 0x12800000  # MOVN W0,#0: low 32 bits = ffffffff
assert word(0x28264) == 0xd65f03c0  # RET X30; runtime reachability stays unknown
assert loaded(0xb0468, 56).startswith(b'@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!')
assert loaded(0xb1330, 68).startswith(b'Host key for %.200s has changed')

frames = subprocess.check_output(['readelf', '-W', '--debug-dump=frames', str(binary)], text=True)
ranges = {(int(a, 16), int(b, 16)) for a, b in re.findall(r'pc=([0-9a-f]+)\.\.([0-9a-f]+)', frames)}
assert {(0x256c0, 0x25888), (0x27848, 0x297d4)} <= ranges
relocations = subprocess.check_output(['readelf', '-Wr', str(binary)], text=True)
assert re.search(r'000000000010ff20\s+0000000000000403\s+R_AARCH64_RELATIVE\s+110470', relocations)
assert re.search(r'000000000010f390\s+[0-9a-f]+\s+R_AARCH64_JUMP_SLOT\s+[0-9a-f]+\s+free@GLIBC_2\.17\s+\+\s+0', relocations)
report = {'binary_sha256': digest, 'elf_machine': 183,
          'selected_machine_word_and_target_checks': 'passed',
          'selected_function_fde_ranges': [['0x256c0', '0x25888'], ['0x27848', '0x297d4']],
          'got_slot': '0x10ff20', 'relative_addend': '0x110470',
          'warning_tail_transfer': {'from': '0x25858', 'entry': '0xbad0',
                                    'adrp_body': '0xbad4', 'slot': '0x10f390',
                                    'relocation_symbol': 'free@GLIBC_2.17'},
          'scope': 'Independent file/GNU checks, not Kuna output, execution, live relocation or path-feasibility proof.'}
with output.open('x') as stream:
    json.dump(report, stream, indent=2)
print(json.dumps(report))
