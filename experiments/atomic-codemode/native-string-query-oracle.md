# Frozen LLVM native query task

Target: `/usr/lib/x86_64-linux-gnu/libLLVM-16.so.1`, SHA-256 `f62d254b7f2bf42df8c8b07d46ee3bb4c2cafeca436b2e6bc6ccbe4581f58f40`.
Engine: `be6d1882b436c04cb37c73ae30683cd2cce91804930197ece30e2a16a9a31ec9`. Opt-in `REA_ATOMIC_NATIVE_STRING_QUERY=1`.

Independent ELF64 PT_LOAD/file checks in `verify-string-query-machine.py` validate the five selected ASCII spans, preceding NUL, complete text, terminator and exact windows. The complete old native producer golden establishes 602,544 candidates, four objects for `undefined symbol` and one for `Invalid bitcode signature`; it does not prove artifact-wide recognition. All five selected objects contain their query once.

| Address   | Bytes incl. NUL | Inclusive end | First 16 bytes                   | Final 8 bytes    |
| --------- | --------------: | ------------- | -------------------------------- | ---------------- |
| 0x40c983e |              48 | 0x40c986d     | 756e61626c6520746f206576616c7561 | 796d626f6c202700 |
| 0x4183e47 |             117 | 0x4183ebb     | 20456d697474696e6720746865736520 | 727563746f727300 |
| 0x41ece4a |              38 | 0x41ece6f     | 696e76616c6964207265666572656e63 | 2073796d626f6c00 |
| 0x420ad6b |              45 | 0x420ad97     | 756e737570706f727465642072656c6f | 796d626f6c202700 |
| 0x40983c8 |              26 | 0x40983e1     | 496e76616c696420626974636f646520 | 676e617475726500 |

Exact selected texts (in the same order):

- "unable to evaluate offset to undefined symbol '".
- " Emitting these undefined symbol references causes us to link the libgcc code that runs our constructors/destructors".
- "invalid reference to undefined symbol".
- "unsupported relocation of undefined symbol '".
- "Invalid bitcode signature".

Both queries share artifact and engine identity, but distinct selected reports, not a raw whole-inventory source. Source IDs and hashes contain a private pathname and vary by lease; report actual complete-capture metadata and verify small Evidence windows from both query sources. Source_row is a native canonical ordinal under the declared scan settings. Different page/detail captures can also have distinct source IDs.

An answer must preserve unknown artifact discovery, not-computed string reference attribution, static loaded-image versus live memory, and absence of target execution. Neither substring presence nor provider candidate counts prove source-object boundaries or runtime use. Retain original model answers, failures and costs; do not repair answers or select a winning retry.

Allow equivalent compositions: exact subwindows can come from a focused covering byte read with truthful capture versus derived lengths. Do not require ten native byte commands or penalize valid reuse. All claimed byte evidence must cover the expected addresses and values in the actual raw captures.

Direct and Code Mode use the same 19 methods and committed runtime, with the same client JavaScript dispatch, question, requested model/reasoning, static authority and resource guard. Code Mode must actually invoke the isolated MCP execution tool. Measure full actual cumulative tokens including cached/uncached input, output/reasoning, catalog/help/retries, calls, wall, local CPU and kernel family peak. Remote computation/cache/model build remain unmeasured. This local static inventory task is not a proof of general complex-software RE superiority or Ghidra/IDA parity.
