import { describe, expect, it } from "vitest";

import { ROLLDOWN_MODULE_INTEROP } from "./javascriptModuleInterop.fixture.js";
import { analyzeJavaScriptStaticSource } from "./javascriptStaticAnalysis.js";

const CAPTURED_INTEROP = ROLLDOWN_MODULE_INTEROP.replace(
  "__defProp = Object.defineProperty",
  "__defProp = define",
);
const WINDOW = `let electron = require("electron");
  electron = __toESM(electron, 1); new electron.BrowserWindow({});`;

describe("captured intrinsic invocation reads", () => {
  it.each(["call", "apply"])(
    "does not invent a bound receiver erased by %s sequence syntax",
    (method) => {
      const result = analyzeJavaScriptStaticSource(`
      const change = Object.defineProperty.bind(null,Object,"create");
      (0, change.${method})(null, ${method === "apply" ? "[{value:replacement}]" : "{value:replacement}"});
      ${ROLLDOWN_MODULE_INTEROP} ${WINDOW}
    `);
      expect(result.electron.browser_windows).toHaveLength(1);
    },
  );

  it.each([
    '[Object.defineProperty, ignored = Object.defineProperty(metadata,"x",{value:1})] = [replacement];',
    '({first: Object.defineProperty, second: ignored = Object.defineProperty(metadata,"x",{value:1})} = values);',
    '[change.call, ignored = change.call(null,metadata,"x",{value:1})] = [replacement];',
    '({first: change.call, [change.call(null,metadata,"x",{value:1})]: ignored} = values);',
    'for ([change.call, ignored = change.call(null,metadata,"x",{value:1})] of values) {}',
  ])(
    "retains destructuring writes before later defaults and keys: %s",
    (mutation) => {
      const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      const change = define.bind(null);
      const metadata = {}; let ignored;
      ${mutation}
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
      expect(result.electron.browser_windows).toEqual([]);
    },
  );

  it("evaluates a destructuring RHS before any target writes", () => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      const metadata = {};
      [Object.defineProperty] = [Object.defineProperty(metadata,"x",{value:1}), replacement];
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toHaveLength(1);
  });

  it("evaluates assignment operands before recording their writes", () => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      const metadata = {};
      Object.defineProperty = (Object.defineProperty(metadata, "x", {value:1}), replacement);
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toHaveLength(1);
  });

  it("retains whole-object mutations at a captured function's later member read", () => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      Object.assign(define, {call: replacement});
      const metadata = {}; define.call(null, metadata, "x", {value:1});
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toEqual([]);
  });

  it.each([
    '(0, Object.defineProperty.call)(null,Object,"create",{value:replacement});',
    '(0, Object.defineProperty.apply)(null,[Object,"create",{value:replacement}]);',
  ])(
    "does not invent a receiver for a detached invocation member: %s",
    (invoke) => {
      const result = analyzeJavaScriptStaticSource(`
      ${invoke}
      ${ROLLDOWN_MODULE_INTEROP} ${WINDOW}
    `);
      expect(result.electron.browser_windows).toHaveLength(1);
    },
  );

  it("retains callee-prefix effects before classifying the invocation", () => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      const metadata = {};
      (Object.defineProperty = replacement, Object.defineProperty)(metadata,"x",{value:1});
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toEqual([]);
  });

  it("retains a callee selected before an argument replaces its global property", () => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      const metadata = {};
      Object.defineProperty(metadata,"x",(Object.defineProperty = replacement,{value:1}));
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toHaveLength(1);
  });

  it.each([
    'define.call(null,metadata,"x",{value:1});',
    'define.apply(null,[metadata,"x",{value:1}]);',
    'const change = define.bind(null,metadata,"x"); change({value:1});',
    'const also = define; also.call(null,metadata,"x",{value:1});',
  ])("retains a function captured before global replacement: %s", (invoke) => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      Object.defineProperty = replacement;
      const metadata = {}; ${invoke}
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toHaveLength(1);
  });

  it.each([
    'const invoke = define.call; invoke(null,metadata,"x",{value:1});',
    'const invoke = define.call; invoke.call(define,null,metadata,"x",{value:1});',
    '(0, define.call).call(define,null,metadata,"x",{value:1});',
    'const invoke = (0, define.call); const again = invoke; again.call(define,null,metadata,"x",{value:1});',
  ])("preserves the base capture through an invocation value: %s", (invoke) => {
    const result = analyzeJavaScriptStaticSource(`
      const define = Object.defineProperty;
      Object.defineProperty = replacement;
      const metadata = {}; ${invoke}
      ${CAPTURED_INTEROP} ${WINDOW}
    `);
    expect(result.electron.browser_windows).toHaveLength(1);
  });

  it.each(["define", "Function.prototype"])(
    "retains an overwritten invocation member through an alias from %s",
    (owner) => {
      const result = analyzeJavaScriptStaticSource(`
        const define = Object.defineProperty;
        Object.defineProperty = replacement;
        ${owner}.call = replacement;
        const invoke = define.call;
        const metadata = {}; invoke.call(define,null,metadata,"x",{value:1});
        ${CAPTURED_INTEROP} ${WINDOW}
      `);
      expect(result.electron.browser_windows).toEqual([]);
    },
  );

  it.each([
    ["call", 'define.call(null,metadata,"x",{value:1});'],
    ["apply", 'define.apply(null,[metadata,"x",{value:1}]);'],
    [
      "bind",
      'const change = define.bind(null,metadata,"x"); change({value:1});',
    ],
  ])(
    "checks the later %s property read on a captured function",
    (method, invoke) => {
      for (const owner of ["define", "Function.prototype"]) {
        const result = analyzeJavaScriptStaticSource(`
        const define = Object.defineProperty;
        ${owner}.${method} = replacement;
        const metadata = {}; ${invoke}
        ${CAPTURED_INTEROP} ${WINDOW}
      `);
        expect(result.electron.browser_windows, owner).toEqual([]);
      }
    },
  );
});
