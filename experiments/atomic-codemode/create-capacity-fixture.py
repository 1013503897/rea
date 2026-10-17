"""Create bounded static ELF payloads with installed binutils; never execute them."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='New output directory; must not exist')
    args = parser.parse_args()
    root = args.directory.resolve()
    root.mkdir(mode=0o700)
    cases = [
        ('plain', 'REA_CAPACITY_PLAIN:', 2 * 1024 * 1024 + 4096, b'A'),
        ('escaped', 'REA_CAPACITY_ESCAPED:', 1024 * 1024 + 4096, b'\\'),
    ]
    assembly = [
        '.text', '.global _start', '.type _start,@function', '_start:',
        'ret', '.size _start,.-_start', '.section .rodata',
    ]
    for name, prefix, size, fill in cases:
        (root / (name + '.bin')).write_bytes(
            prefix.encode() + fill * (size - len(prefix)) + b'\0')
        assembly.extend([
            '.global capacity_' + name, '.type capacity_' + name + ',@object',
            'capacity_' + name + ':', '.incbin "' + name + '.bin"',
            '.size capacity_' + name + ',.-capacity_' + name,
        ])
    (root / 'fixture.s').write_text('\n'.join(assembly) + '\n')
    subprocess.run(['as', '--64', '-o', 'fixture.o', 'fixture.s'], cwd=root, check=True)
    subprocess.run(['ld', '-o', 'fixture.elf', 'fixture.o'], cwd=root, check=True)
    binary = root / 'fixture.elf'
    binary.chmod(0o444)
    symbols = {}
    for line in subprocess.check_output(['nm', '--format=posix', str(binary)], text=True).splitlines():
        name, _, address, *_ = line.split()
        if name.startswith('capacity_'):
            symbols[name] = int(address, 16)
    manifest = {
        'binary': str(binary), 'sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
        'output_directory_argument': str(args.directory),
        'cases': [
            {'name': name, 'query': prefix, 'address': hex(symbols['capacity_' + name]),
             'text_bytes': size, 'encoded_span_bytes': size + 1,
             'nul_terminated': True, 'fill_byte': fill[0]}
            for name, prefix, size, fill in cases
        ],
        'scope': 'Synthetic static ELF; never executed. Capacity/escaping behavior, '
                 'not real-application analysis quality.',
    }
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest))


if __name__ == '__main__':
    main()
