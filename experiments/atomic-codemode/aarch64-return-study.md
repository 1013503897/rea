# AArch64 import entries and return coverage

Two independent producer defects are corrected: BTI import-entry identity and
false no-return promotion that erased a post-warning path. A fresh three-way
model run passes the selected task oracle with all interfaces. Direct atomic
reads use less cumulative and uncached input and finish sooner than Code Mode
in this sample, despite more MCP requests. Correct primitive facts are useful;
the extra Code Mode layer does not automatically improve a completed task.

This continues the [three-way warning investigation](aarch64-xref-study.md),
where all three interfaces encountered the same dropped post-warning path.

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
The original and sectionless inventories contain 1713 and 518 entries; this
check compares selected imports, not whole-inventory completeness. PAC coverage
uses synthetic byte fixtures; the real SSH checks exercise the BTI form.

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

## Fresh real-model comparison after both corrections

All three trials freeze REA runtime
`bf9d3a6e47de1e16a7eefb58bf385dfbe093fdb9`, the final engine above, the same
target and the unchanged [question](aarch64-warning-question.txt). Trial prefixes
are `arm-return-{direct,codemode,traditional}-v1` under the ignored local cache.
Execution order is Direct, Code Mode, traditional. Each uses a fresh isolated
Codex profile; traditional gets a new project-cache directory and the atomic
modes get new evidence stores. Each requests `gpt-6.1-sol` with high
reasoning through Codex 0.161.0, and receives its actual advertised tools:
22 Direct, 4 Code Mode, or all 16 Kuna-supported traditional tools. Discovery
and SDK-converted schema verification precede these runs. No runtime or engine
mutation occurs during the three trials.

| Whole-task observation                       | Traditional | Code Mode | Direct atomic |
| -------------------------------------------- | ----------: | --------: | ------------: |
| Cumulative input tokens                      |     662,683 |   371,571 |       351,157 |
| Cached input, included above                 |     570,368 |   323,968 |       310,912 |
| Uncached input                               |      92,315 |    47,603 |        40,245 |
| Output tokens                                |       5,304 |     6,069 |         5,402 |
| Reasoning tokens, included in output         |       1,181 |     1,586 |         1,379 |
| Model responses                              |          20 |        14 |            12 |
| Client executor calls / waits                |      15 / 4 |    13 / 0 |        11 / 0 |
| MCP attempts                                 |          20 |        13 |            25 |
| Rejected MCP attempts                        |           2 |         0 |             0 |
| Reference-document requests, included in MCP |           — |         3 |             1 |
| Shared fact API calls                        |           — |        23 |            22 |
| Model wall seconds                           |     263.085 |   166.756 |       139.033 |
| Family wall seconds                          |     263.580 |   167.258 |       139.587 |
| Local family CPU seconds                     |  166.299552 | 41.040445 |     34.362879 |
| Kernel family peak MiB                       |      1279.4 |     617.0 |         625.2 |

The unique per-response usage sums match each runner total. Cache writes are
zero. All three runs preserve runtime/engine/target fingerprints, close the
target, remove their isolated profiles, verify payload cleanup and observe OOM 0. Whole-scope final counters remain unavailable; family CPU/memory use verified
payload-exit observations. Memory includes charged file cache, not just RSS.
Remote compute, resolved service model build, OS cache state and host contention
are unmeasured. Fresh local profiles do not imply cold OS or remote model caches.

Code Mode executes its 23 fact calls inside eight `execute_javascript` requests;
Direct issues 22 `facts_*` requests. Each mode retains the same two complete
native function documents, verified equal, including restored strict call
`0x2854c`, the selected pointer bindings, and the warning's named `free` tail.
Code Mode requests three snapshots but captures only two distinct sources; a
repeat uses the existing lease cache. Different queries/field selections and
model response counts are part of the measured workflows, not equal instruction
traces. Both modes, and traditional, also have the same client-side JavaScript
executor available. This compares MCP/API surfaces, not JavaScript versus its
absence.

The traditional run first passes xref instruction addresses `0x25750` and
`0x2853c` to an exact-entry analysis operation; both are correctly rejected. It
recovers with `list_procedures`. Traditional `xrefs` normalizes these results to
address strings; the atomic response also supplies native owning-function
facts. Those navigation differences and retries are counted. Its two successful
function dossiers share the same ready project-export key
`dbfd828b95d9c1a2981707728a9e31b4c38688162e851a904c3808fd911c79eb`.
Higher CPU is not evidence of a broken project cache. Traditional project export
and per-function atomic export remain different native analysis profiles; the
comparison does not isolate transport or schema cost from analysis scope.

All complete answers were read and passed agent review against the frozen
question, independent file/GNU oracle, selected additional GNU checks and their
actual delivered Evidence. Each identifies both functions, proves the selected
pointer transfer and first helper target, verifies format formation/passing,
the four-byte test and actual zero/nonzero successors, conditional cleanup
return, and the necessary runtime/logging/alias limitations. This is selected
task correctness, not human readiness or general analysis completeness.

Every cited source is verified: 11 traditional, 14 Code Mode and 14 Direct IDs.
Traditional projected views correctly have their own provider and null engine
profile; their explicit parent-Evidence links trace to the pinned engine. An
initial audit incorrectly required a native engine profile on each projection;
the corrected audit follows that provenance chain and passes. Atomic retained
source byte counts/digests, target/engine contexts, selected native call/value
bindings, restored strict call and complete selected-function equality pass.
Answer SHA-256 values are:

- Traditional: `655877f07ce8819e7f086c584b49fb6d63dd2a7319c792deb09a721092eb7c5b`
- Code Mode: `35d96912940a3a51704093d08ab228aea3e40fbdc80085d8137385f0d9199f61`
- Direct: `24b1f3954397c3c30686a199189d0a37b61bc6ce74dfc49cfc061e79fe5c7fa9`

The local `return-model-costs.json`, `return-answer-checks.json` and
`return-answer-review.json` retain the detailed receipts/review; raw model and
native captures remain ignored. The earlier Code Mode advantage does not repeat:
this sample uses 5.8% more cumulative input, 18.3% more uncached input and 19.9%
more model wall time than Direct. Its memory peak is slightly lower. One
sequential sample with different model choices cannot establish a stable winner
or attribute the change solely to the fixes. It supplies a concrete counterexample
to treating fewer RPCs as proof of fewer tokens or faster completed analysis.
Broader complex-software effectiveness remains unproved.
