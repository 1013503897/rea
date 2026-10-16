# AArch64 import entries and return coverage

This continues the [three-way warning investigation](aarch64-xref-study.md).
All three model interfaces encountered the same dropped post-warning path.
Improving the underlying producer must precede a new interface comparison.

## PLT entry checkpoint

The actual Debian arm64 SSH fixture remains SHA-256
`de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068`,
1,051,744 bytes, extracted and never executed. The independent
[machine verifier](verify-aarch64-machine.py) checks the warning epilogue's
restored LR/SP, tail branch `0x25858 → 0xbad0`, BTI at that entry, ADRP at
`0xbad4`, loaded GOT slot `0x10f390`, and its `free@GLIBC_2.17` JUMP_SLOT
relocation. GNU objdump's neighbouring synthetic PLT label is not authoritative
symbol identity. Actual runtime binding, pointer authentication and path
feasibility remain unknown.

The old loader recognizes an ADRP/LDR pair and names the ADRP address. The
resulting inventory splits `sub_bad0` (4 bytes) from `free` at `0xbad4` (20).
The corrected owner recognizes the complete standard veneer, optional immediate
BTI c prefix and optional AUTIA1716. It uses the ADRP's own PC and exact
relocation slot, without assuming a PLT stride. Complete load/add/branch
agreement is required before consuming a relocation. Truncated/corrupt sequences,
ordinary preceding instructions, missing slots, misalignment and overflowing
instruction ranges cannot manufacture an entry.

The AArch64 decoder and its tests move into `loader/elf_plt/aarch64.rs`;
section and PT_DYNAMIC paths call that single owner. The parent still owns GOT
name correlation and deduplication. These supported sequences follow Arm's
[System V ABI examples](https://github.com/ARM-software/abi-aa/blob/main/sysvabi64/sysvabi64.rst#sample-plt-sequences).
Other veneer forms stay unrecognized. This experiment does not establish full
Ghidra loader/analyzer parity.

REA refreshed main through `d5be402fb3dbfc56ac9854c27b5538df20cc2437`
(merge `d3443521d`); native upstream stays
`fe01d6294eb0d1053ce343c8943646df88e143fc`. The PLT-only overlay hash is
`ec660ee463d46e95bc76a9c80e0889ee65443748f1196ad61c4464352dfc8c19`.
Copied immutable embed-specs/opt1 engine SHA-256:
`646c49341f9f55147ce9363d8f3e33b69860a830dbd1b88beea339db88ff2fe9`.
The previous engine is `e43185ff11e74c18753e8755c7757ef6ede415c87a1dac9f04bb39856de87f43`.

Six new test groups first ran against the old decoder: five failed, one passed.
All 13 PLT decoder tests then passed, including seven AArch64 groups and the
other architectures' retained cases. The real public SDK inventory now places
`free` at `0xbad0` and `_exit` at `0xbdd0`; their former ADRP-body entries disappear.
The warning's recovered tail call names `free`. The real native CLI
[loader verifier](verify-aarch64-plt.py) checks both the original ELF section
path and PT_DYNAMIC fallback using a separately hashed derived copy with only
ELF section-header coordinates zeroed. Both produce the corrected entries.
Neither input is executed. Both patch application directions pass.

| Executed check | Family wall s | Family CPU s | Kernel family peak MiB |
| --- | --- | --- | --- |
| Refreshed REA runtime build | 34.141 | 32.976667 | 3039.0 |
| Six new groups against old decoder, expected failure | 123.335 | 122.063494 | 1031.2 |
| All 13 PLT tests after correction, including compile | 68.475 | 68.217534 | 887.9 |
| Corrected native CLI build | 102.486 | 102.098492 | 625.3 |
| Old-engine SDK inventory/references/two captures/full source verification | 14.314 | 14.060418 | 389.6 |
| PLT-only engine, equivalent SDK workflow | 14.312 | 14.080485 | 388.5 |
| Real CLI, both loader paths | 4.045 | 3.744119 | 101.9 |

All listed scopes verify payload cleanup, observed OOM 0, one CPU and the existing
4 GiB hard/3 GiB early-stop memory guard. Peaks include charged file cache and
are not RSS; verified payload-exit counters are not final whole-scope counters.
SDK sessions use fresh retained-evidence stores; OS cache state is uncontrolled.
The single equivalent SDK pair does not establish a performance improvement.
No new model/token measurement or broad repository typecheck is claimed here.

The PLT-only correction **does not** restore the caller's strict diagnostic:
its recovered call facet still omits `0x2854c`, and C still marks the warning
call at `0x2841c` no-return. This controlled result separates the import-entry
defect from the no-return defect. The discovered-no-return pass has a weaker
terminal-call promotion than the existing propagation walk: it observes a
terminal call somewhere and absence of RET, without rejecting an escaping tail
transfer to possibly returning code. Causality and the structural correction
require their own checks; the entry fix alone is not claimed to solve it.
