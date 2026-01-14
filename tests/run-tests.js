import assert from "assert";
import { templates } from "../configs/templates.js";
import { compileAssembly } from "../engine/runtime.js";
import { assemblies } from "../configs/assemblies.js";

function testCompile() {
  const tpl = templates[0];
  const asm = compileAssembly(
    tpl,
    tpl.slots.map((s) => s.id),
    {}
  );
  assert(asm.ops.length === tpl.slots.length, "ops length mismatch");
  assert(asm.signature.includes(tpl.id), "signature missing tpl id");
}

function testGuard() {
  const asm = assemblies.counterPulse;
  assert(asm.guards.icdMs === 800, "guard icd missing");
}

function run() {
  testCompile();
  testGuard();
  console.log("tests passed");
}

run();
