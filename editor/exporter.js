import { templates } from "../configs/templates.js";
import { compileAssembly } from "../engine/runtime.js";

export function exportAssembly(templateId, order, slotOptions = {}) {
  const tpl = templates.find((t) => t.id === templateId);
  if (!tpl) throw new Error(`template ${templateId} not found`);
  const asm = compileAssembly(tpl, order, slotOptions);
  return {
    templateId,
    order,
    slotOptions,
    signature: asm.signature,
    assembly: asm,
  };
}
