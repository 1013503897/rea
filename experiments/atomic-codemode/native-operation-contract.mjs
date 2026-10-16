// One native operand/operation schema shared by complete and projected facts.
import { z } from "zod";
import {
  hex,
  ordinal,
  valueId,
  operationId,
  edgeId,
  rowParser,
} from "./native-contract.mjs";
export const operation = z.strictObject({
  id: operationId,
  address: hex,
  block: ordinal,
  opcode: z.string(),
  statement: z.string(),
  is_dead: z.boolean(),
  inputs: z.array(
    z.strictObject({
      input_index: ordinal,
      value_id: valueId.nullable(),
      phi_predecessor: ordinal.nullable(),
      phi_predecessor_edge: edgeId.nullable(),
    }),
  ),
  output: valueId.nullable(),
});

export const parseOperation = rowParser(operation, {
  inputs: (row) => operation.shape.inputs.element.parse(row),
});
