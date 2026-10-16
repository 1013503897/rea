# AArch64 OpenSSH warning oracle

Freeze the question, oracle, source runtime, immutable engine and complete
catalogs before real models. This is a behavior/machine question, without
native-only SSA or prototype-count requirements. The traditional native
Kuna workflow is a valid comparison when its complete tools and evidence
can answer the same question. No question addresses or answers are supplied
to the isolated model workspaces.

Target: extracted Debian `openssh-client_10.0p1-7+deb13u4_arm64.deb`, never
installed or executed. ELF size 1,051,744, SHA-256
`de352e4ace7028d9816fd0ee9d22936bc1b5622c400d5b0b7df660df3426b068`.
Package/provenance and signature-verification limits are in [the storage study](storage-study.md).
All lanes use immutable embed-specs/opt1 engine SHA-256
`e43185ff11e74c18753e8755c7757ef6ede415c87a1dac9f04bb39856de87f43`.
The backend xref correction benefits every lane; old engines with missing
AArch64 facts are not used as a scored traditional baseline.

Independent GNU AArch64 disassembly and FDEs identify banner function
`0x256c0..0x25888`, selected caller `0x27848..0x297d4`. The public
[file/machine verifier](verify-aarch64-machine.py) checks selected ELF words,
ADRP/ADD math, direct/conditional branch targets, the GOT slot/relocation and
GNU unwind ranges without consuming Kuna output. Native SDK/source fidelity
is checked separately. GNU nearest-export labels are not original function names.

Required facts and interpretations:

- Banner format is `0xb0468`: `ADRP X6,0xb0000` at `0x2574c`, then
  `ADD X6,X6,0x468` at `0x25750`, then `BL 0x5ae04` at `0x25754`.
  The incoming data-reference site is the completing ADD, owned by `0x256c0`.
  X6 holds the format pointer at the call. No banner-format stack slot or
  original source argument ordinal should be invented from the x86 study.
- Strict format is `0xb1330`: `ADRP X6,0xb1000` at `0x28534`, unrelated
  `MOV X5,0` at `0x28538`, completing `ADD X6,X6,0x330` at `0x2853c`,
  and `BL 0x5ae04` at `0x2854c`. Reference owner is `0x27848`.
- Banner function has selected incoming calls `0x2841c` from `0x27848` and
  `0x29ccc` from `0x297e0`. Select the caller by the strict diagnostic and
  corroboration, not by address/name ordering or an original source-name guess.
- Selected pointer setup is `MOV X0,X27` at `0x28414`, then
  `BL 0x256c0` at `0x2841c`. In the callee `MOV X23,X0` at `0x256e8`
  preserves the incoming pointer; X0 is not rewritten before the first helper
  `BL 0x3d108` at `0x256f0`. Matching native passing/input tuples, if used,
  remain snapshot-scoped correlations and not global SSA/alias equality.
- Local decision loads **four bytes**: `LDR W0,[X25,0x88]` at `0x2851c`.
  `CBZ W0,0x28554` at `0x28524` takes the zero successor `0x28554`;
  nonzero falls through to `0x28528`, which prepares the strict diagnostic.
  The normalized static model names the tested global `dat_1104f8`.
- The address recovery is corroborated by `ADRP X25,0x10f000` at `0x27904`
  and `LDR X25,[X25,0xf20]` at `0x27908`: slot `0x10ff20`, initial/model
  bytes `7004110000000000` = `0x110470`, plus field offset `0x88` gives
  static image coordinate `0x1104f8`. Independent ELF relocation is
  `R_AARCH64_RELATIVE` with addend `0x110470`. An ABI-conforming initial
  relocation uses load bias plus addend; this is not a captured live pointer
  or a read of the tested runtime value. Across calls, interpreting X25 as
  preserved relies on the ordinary callee-save model, not a proved runtime path.
  See [Arm ELF relocation semantics](https://github.com/ARM-software/abi-aa/blob/main/aaelf64/aaelf64.rst#dynamic-relocations)
  and [AAPCS64 registers](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst#general-purpose-registers).
- After the strict logging call, `B 0x281c0` at `0x28550` enters cleanup.
  Its selected returning route sets `W0=0xffffffff` at `0x281f4` and reaches
  `RET X30` at `0x28264`; intervening calls, the stack-check branch at
  `0x28214` and pointer authentication can prevent runtime return. Report low
  32 bits `0xffffffff` (signed 32-bit -1), without inventing the original return type.
- The banner call precedes this policy test. It alone is not proof of rejection.
  Zero enters more checks at `0x28554`, not proof of acceptance/login. The
  static initial global/pointer is not a runtime value, alias or binding proof.

Score complete final answers against owner/caller, both address formations,
selected pointer/helper transfer, tested storage/width and zero/nonzero machine
successors, cleanup/low return bits, Evidence/target identities, necessary
unknowns and close. Accept native C/model recovery corroborated by machine
addressing for the static global, or selected loaded-image bytes plus instruction
arithmetic; do not require an unavailable native-only representation. Explicitly
label weaker/missing coverage rather than treating missing facts as completion.

Preflight confirms both strings/xrefs, both selected C/assembly dossiers and
the correct artifact through the real traditional MCP. It resolves the same
static `dat_1104f8`. Its 95.291-second first dossier waits for whole-program
export; later reads reuse that cache. This preflight is not a model trial.

Both atomic catalogs are complete (twenty-two direct / four Code tools), and
the baseline includes all thirteen declared Kuna native operations plus
open/close/retained views (sixteen tools), generated from the capability owner
and actual catalog. Use the same question, requested gpt-6.1-sol/high, fresh
isolated profiles/private caches, common envelope/discovery/stopping/wait
guidance and one-CPU / 4 GiB hard / 3 GiB early-stop bounds. Planned order is
traditional → Code Mode → direct, pinned before launch. Charge every attempt,
whole-task cumulative/cached/uncached input, output/reasoning, responses,
calls/retries/waits, elapsed/CPU and kernel family peak memory. Existing client
JavaScript dispatch is present in every lane. Native profiles differ: selected
atomic windows/functions versus traditional whole-program export. This is a
workflow comparison, not an isolated dispatch-only or same-native-work ablation.
Remote build/compute, OS/model caches and host contention remain unknown.
