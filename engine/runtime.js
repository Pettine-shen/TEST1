import { sumBudgets, assertWithinCaps } from "./budget.js";
import { buildOp } from "./ops.js";
import { createRng } from "./rng.js";

export class EventBus {
  constructor() {
    this.handlers = {};
  }
  subscribe(eventType, handler) {
    if (!this.handlers[eventType]) this.handlers[eventType] = [];
    this.handlers[eventType].push(handler);
  }
  emit(eventType, ctx) {
    const list = this.handlers[eventType] || [];
    for (const h of list) h(ctx);
  }
}

function defaultScheduler(queue, fn, delayMs, nowMs) {
  queue.push({ at: nowMs + delayMs, fn });
}

export function guardsPass(runtimeState, guards, nowMs) {
  if (!guards) return true;
  runtimeState.last = runtimeState.last || 0;
  runtimeState.countWindow = runtimeState.countWindow || { second: 0, count: 0 };
  if (guards.icdMs && nowMs - runtimeState.last < guards.icdMs) return false;
  const second = Math.floor(nowMs / 1000);
  if (guards.capPerSecond) {
    if (runtimeState.countWindow.second !== second) {
      runtimeState.countWindow = { second, count: 0 };
    }
    if (runtimeState.countWindow.count >= guards.capPerSecond) return false;
    runtimeState.countWindow.count += 1;
  }
  runtimeState.last = nowMs;
  return true;
}

function executeOps(ops, startIndex, ctx, world, scheduleFn) {
  for (let i = startIndex; i < ops.length; i++) {
    const op = ops[i];
    if (op.type === "Condition") {
      const ok = op.eval(ctx, world);
      if (!ok) return;
    } else if (op.type === "Target") {
      ctx.targets = op.select(ctx, world).map((t) => t.id || t);
    } else if (op.type === "Timeline") {
      const restIndex = i + 1;
      if (restIndex < ops.length) {
        scheduleFn(
          () => executeOps(ops, restIndex, { ...ctx, time: ctx.time + op.delay }, world, scheduleFn),
          op.delay,
          ctx.time
        );
      }
      return;
    } else if (op.type === "Action") {
      op.exec(ctx, world);
    }
  }
}

export function executeAssembly(assembly, ctx, world, schedule) {
  const runtime = (world.skillRuntime[assembly.templateId] =
    world.skillRuntime[assembly.templateId] || {});
  if (!guardsPass(runtime, assembly.guards, ctx.time)) return;
  executeOps(assembly.ops, 0, ctx, world, (fn, delay) =>
    schedule ? schedule(fn, delay, ctx.time) : defaultScheduler(world.queue, fn, delay, ctx.time)
  );
}

export function compileAssembly(template, order, slotOptions) {
  if (template.slots.length !== order.length) {
    throw new Error("order length mismatch");
  }
  const ordered = [];
  for (const id of order) {
    const slot = template.slots.find((s) => s.id === id);
    if (!slot) throw new Error(`unknown slot ${id}`);
    const optionId = slotOptions[id] || slot.defaultOption;
    const opt = slot.options.find((o) => o.id === optionId);
    if (!opt) throw new Error(`invalid option ${optionId} for slot ${id}`);
    ordered.push({ slot, opt });
  }
  const ops = ordered.map(({ slot, opt }) => buildOp(slot, opt));
  const budgets = sumBudgets(ops, template.baseBudget || {});
  assertWithinCaps(budgets, template.budgetCap);
  const signature = `sig-${template.id}-${order.join("-")}`;
  return {
    templateId: template.id,
    event: template.event,
    order,
    ops,
    guards: template.guards || {},
    budgets,
    signature,
  };
}

export function buildEventBusWithAssemblies(assemblies, world) {
  const bus = new EventBus();
  for (const asm of assemblies) {
    bus.subscribe(asm.event, (ctx) => executeAssembly(asm, ctx, world));
  }
  return bus;
}
