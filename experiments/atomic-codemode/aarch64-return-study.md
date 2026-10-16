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

| Executed check                                                            | Family wall s | Family CPU s | Kernel family peak MiB |
| ------------------------------------------------------------------------- | ------------- | ------------ | ---------------------- |
| Refreshed REA runtime build                                               | 34.141        | 32.976667    | 3039.0                 |
| Six new groups against old decoder, expected failure                      | 123.335       | 122.063494   | 1031.2                 |
| All 13 PLT tests after correction, including compile                      | 68.475        | 68.217534    | 887.9                  |
| Corrected native CLI build                                                | 102.486       | 102.098492   | 625.3                  |
| Old-engine SDK inventory/references/two captures/full source verification | 14.314        | 14.060418    | 389.6                  |
| PLT-only engine, equivalent SDK workflow                                  | 14.312        | 14.080485    | 388.5                  |
| Real CLI, both loader paths                                               | 4.045         | 3.744119     | 101.9                  |

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

## No-return ownership checkpoint

With the PLT-only engine unchanged, disabling only `noreturn_disc` restores the
caller call at `0x2854c` and removes the false no-return annotation from the
warning call at `0x2841c`. That native CLI counterfactual takes 5.052 s wall,
4.813974 s local family CPU, 175.6 MiB kernel family peak, with verified cleanup
and observed OOM 0. It isolates the discovered pass; it is not the final fix or
the configuration supplied to model evaluators.

The discovered pass's duplicate promotion scanned a whole function span for
any terminal call and no RET. An alternative tail transfer to a returning
import therefore failed to protect the caller's continuation. The correction
removes that interpretation and shares the propagation pass's conservative
reachable-path walk. Known terminal transfers stop a path; returning tails,
missing successors, unresolved indirect jumps and escaping branches cannot
prove the whole function no-return. A dead, unreachable RET no longer prevents
legitimate promotion. Existing call-site threshold and strict-successor options
remain, but an absent local successor contributes no new vote: it is compatible
with a returning tail call. The inspected
[Ghidra analyzer](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/java/ghidra/app/plugin/core/analysis/FindNoReturnFunctionsAnalyzer.java)
also skips calls without fall-through when looking for new indicators; this is
source comparison, not a real-Ghidra runtime verification.

The shared entry first checks for any terminal-transfer candidate before
allocating a body map or visiting its CFG. That necessary-condition check also
applies to the existing propagation consumer. Terminal sets still grow during
the bounded fixpoint, so false results are not cached across changing sets.
There is no added long-lived graph cache or duplicate adapter interpretation.

Five new semantic test groups cover the fatal/returning-tail alternative,
four different unknown exits, genuine terminal paths with a dead RET, a
transitive wrapper fixpoint, and missing versus positively identified
successors. Against the old rule, four groups fail and the wrapper group passes
(the two pre-existing smoke tests also pass). After the correction, all 39
no-return-related tests pass, including those groups. Expected-failure run:
68.371 s wall / 68.147478 s CPU / 889.2 MiB peak. Passing run including compile:
73.808 s / 72.914925 s / 892.6 MiB. Both have verified cleanup and observed OOM 0.
An earlier syntax-error attempt is not counted as a semantic regression run.

The final overlay SHA-256 is
`597b5236c42b214b88da39afe0f2b2b1cd7c5ff82e512e91d6a3249bfef565f1`;
the immutable engine SHA-256 is
`0969be0c9c3ace9357acce1f802f12e8595bc57445da32937933de543ca77672`.
Forward-index and reverse-worktree application checks pass. The public
[SDK verifier](verify-aarch64-returns.mjs) now finds the strict call at
`0x2854c`, removes the false warning-call annotation, retains the genuine fatal
call annotation, verifies canonical import ownership and byte identity, hashes
all retained sources, and checks complete C/source fidelity and warm reuse.
Warm captures retain identical handles/facts: warning 0.770 ms / 0.000797 CPU s;
caller 0.702 ms / 0.000761 CPU s. Cold captures take 2033.6 / 5857.3 ms and
2.023671 / 5.835244 CPU s respectively. These are lease cache observations, not
OS-cold or model-task measurements.

| Executed check after no-return correction                             | Family wall s | Family CPU s | Kernel family peak MiB |
| --------------------------------------------------------------------- | ------------- | ------------ | ---------------------- |
| Native CLI build                                                      | 212.756       | 166.409933   | 629.8                  |
| New SDK return/source verifier                                        | 13.606        | 13.381336    | 421.9                  |
| Equivalent earlier SDK inventory/references/two captures/full sources | 15.632        | 15.370816    | 415.7                  |
| Existing AArch64 xrefs/GOT reads/source regression                    | 13.309        | 13.018756    | 206.9                  |
| Complete old x86 function/prototype fidelity through MCP              | 9.080         | 8.790274     | 308.5                  |
| All 87 experimental JS tests                                          | 5.355         | 5.055786     | 83.8                   |
| Both actual catalogs and converted schemas                            | 1.936         | 1.712823     | 136.3                  |
| Both real native ELF loader paths                                     | 4.047         | 3.799690     | 101.1                  |

All these successful scopes verify cleanup and observed OOM 0 under the same
resource bounds. Wall/CPU divergence occurred during compilation; attribution
between host contention and changed compilation is unmeasured. The equivalent
SDK task is slower than the PLT-only 14.312 s / 14.080485 CPU s / 388.5 MiB
sample, while retaining the previously missing path. This single sequential
pair does not establish a general performance delta. Changed-file JS lint,
format and Python compilation checks pass. Broad repository type checking
retains the previously disclosed resource-limited gap.
