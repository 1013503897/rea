"""Independently map selected LLVM strings through ELF64 PT_LOAD and file bytes.

The producer golden supplies candidate coordinates. This checks those coordinates
and encoded spans, not completeness of the native recognizer or runtime behavior.
"""
import hashlib
import json
import mmap
from pathlib import Path
import struct
import sys

if not __debug__:
    raise RuntimeError("Run this oracle without Python optimization")
golden_path, output_path = map(Path, sys.argv[1:])
golden = json.loads(golden_path.read_text())
target = Path(golden["manifest"]["target"])
with target.open("rb") as handle:
    digest = hashlib.file_digest(handle, "sha256").hexdigest()
    assert digest == golden["manifest"]["target_sha256"]
    with mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as data:
        assert data[:6] == b"\x7fELF\x02\x01"
        assert struct.unpack_from("<H", data, 18)[0] == 62
        phoff = struct.unpack_from("<Q", data, 32)[0]
        phsize, phcount = struct.unpack_from("<HH", data, 54)
        assert phsize == 56 and phoff + phsize * phcount <= len(data)
        loads = []
        for index in range(phcount):
            kind, flags, offset, vaddr, _, filesz, memsz, _ = struct.unpack_from(
                "<IIQQQQQQ", data, phoff + index * phsize)
            if kind == 1:
                assert filesz <= memsz and offset + filesz <= len(data)
                loads.append(dict(offset=offset, vaddr=vaddr, filesz=filesz, flags=flags))
        objects = []
        for selection in golden["queries"]:
            if selection["query"] not in ["undefined symbol", "Invalid bitcode signature"]:
                continue
            assert selection["total"] == len(selection["sample"])
            for row in selection["sample"]:
                assert row["encoding"] == "ascii" and row["nul_terminated"] is True
                address, length = int(row["address_hex"], 16), row["byte_length"]
                mappings = [s for s in loads if s["vaddr"] <= address
                            and address + length <= s["vaddr"] + s["filesz"]]
                assert len(mappings) == 1
                segment = mappings[0]
                offset = segment["offset"] + address - segment["vaddr"]
                raw = data[offset:offset + length]
                assert raw == row["text"].encode("ascii") + b"\0"
                assert selection["query"].encode() in raw
                objects.append(dict(query=selection["query"], address=row["address_hex"],
                    source_row=row["source_row"], encoding="ascii", nul_terminated=True,
                    byte_length=length, text=row["text"], file_offset=offset,
                    preceding_byte=data[offset - 1], pt_load=segment,
                    windows=[dict(address=hex(address + start), length=count,
                                  hex=raw[start:start + count].hex())
                             for start, count in [(0, 16), (length - 8, 8)]]))
assert len(objects) == 5
report = dict(target=str(target), target_sha256=digest, objects=objects,
    scope="Independent ELF64 PT_LOAD and exact selected file bytes; producer-relative counts, no artifact-wide discovery or runtime attribution claim.")
with output_path.open("x") as handle:
    json.dump(report, handle, indent=2)
print(json.dumps(report, indent=2))
