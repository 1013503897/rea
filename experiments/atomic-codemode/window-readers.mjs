// Named native read protocols; both use the owner's source/batch lifecycle.
import { parseInstructions } from "./instruction-facts.mjs";
import { parseByteFacts } from "./byte-facts.mjs";

export const windowReaders = {
  instructions: {
    key: (request) => `${request.address}:${request.count}`,
    arguments: (path, request) => [
      "disassemble",
      path,
      request.address,
      "--addr",
      "--as",
      "code",
      "--count",
      String(request.count),
      "--json",
    ],
    parse: parseInstructions,
  },
  bytes: {
    key: (request) => `${request.address}:${request.length}`,
    arguments: (path, request) => [
      "read",
      path,
      `${request.address}..0x${(BigInt(request.address) + BigInt(request.length)).toString(16)}`,
      "--as",
      "data",
      "--json",
      "--option",
      "listing",
      "off",
      "--option",
      "fast_funcdisc",
      "off",
    ],
    parse: parseByteFacts,
  },
};
