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
    console.log(`Executing op ${i}:`, op.type, op.kind || op.slotId);
    // Store current op index in context for actions that need to know their position
    const ctxWithOpIndex = { ...ctx, currentOpIndex: i };
    if (op.type === "Condition") {
      const ok = op.eval(ctx, world);
      console.log(`Condition ${op.kind} result:`, ok);
      if (!ok) {
        console.log("Condition failed, stopping execution");
        return;
      }
    } else if (op.type === "Target") {
      const selected = op.select(ctx, world);
      ctx.targets = selected.map((t) => t.id || t);
      console.log("Target selected:", ctx.targets);
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
      console.log("Executing Action:", op.kind);
      op.exec(ctxWithOpIndex, world); // Pass context with op index
      console.log("After Action exec, projectiles:", world.projectiles?.length || 0);
    }
  }
}

export function executeAssembly(assembly, ctx, world, schedule) {
  console.log("executeAssembly called:", assembly.templateId, "ops count:", assembly.ops?.length);
  const runtime = (world.skillRuntime[assembly.templateId] =
    world.skillRuntime[assembly.templateId] || {});
  if (!guardsPass(runtime, assembly.guards, ctx.time)) {
    console.log("Guards failed");
    return;
  }
  const ctxWithAssembly = { ...ctx, assembly };
  console.log("Executing ops, count:", assembly.ops.length);
  executeOps(assembly.ops, 0, ctxWithAssembly, world, (fn, delay) =>
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
  
  // Extract presentation parameters
  const presentation = {
    windupMs: template.presentation?.windupMs || 200,
    recoveryMs: template.presentation?.recoveryMs || 300,
    projectileSpeed: template.presentation?.projectileSpeed || 12,
    indicatorShape: template.presentation?.indicatorShape || "line",
    indicatorSize: template.presentation?.indicatorSize || {},
  };
  
  // Override with option-specific presentation params if available
  for (const { opt } of ordered) {
    if (opt.presentation) {
      if (opt.presentation.windupMs !== undefined) presentation.windupMs = opt.presentation.windupMs;
      if (opt.presentation.recoveryMs !== undefined) presentation.recoveryMs = opt.presentation.recoveryMs;
      if (opt.presentation.projectileSpeed !== undefined) presentation.projectileSpeed = opt.presentation.projectileSpeed;
      if (opt.presentation.indicatorShape !== undefined) presentation.indicatorShape = opt.presentation.indicatorShape;
      if (opt.presentation.indicatorSize !== undefined) {
        presentation.indicatorSize = { ...presentation.indicatorSize, ...opt.presentation.indicatorSize };
      }
    }
  }
  
  // Extract indicator info from Target ops
  const targetOp = ops.find((op) => op.type === "Target");
  if (targetOp) {
    if (targetOp.kind === "singleNearest" || targetOp.kind === "line") {
      presentation.indicatorShape = "line";
      presentation.indicatorSize.range = targetOp.range || 12;
    } else if (targetOp.kind === "cone") {
      presentation.indicatorShape = "cone";
      presentation.indicatorSize.range = targetOp.range || 10;
      presentation.indicatorSize.angle = targetOp.angle || 60;
    } else if (targetOp.kind === "circle") {
      presentation.indicatorShape = "circle";
      presentation.indicatorSize.radius = targetOp.radius || 3;
    } else if (targetOp.kind === "allInRange" || targetOp.kind === "lowestHealth" || targetOp.kind === "highestHealth" || targetOp.kind === "allies" || targetOp.kind === "markedTargets") {
      presentation.indicatorShape = "circle";
      presentation.indicatorSize.radius = targetOp.range || 12;
    } else if (targetOp.kind === "self") {
      presentation.indicatorShape = "circle";
      presentation.indicatorSize.radius = 1;
    }
  }
  
  // Extract dash info from Action ops
  const dashOp = ops.find((op) => op.type === "Action" && op.kind === "Dash");
  if (dashOp) {
    presentation.indicatorShape = "dash";
    presentation.indicatorSize.distance = dashOp.distance || 5;
  }
  
  return {
    templateId: template.id,
    event: template.event,
    order,
    ops,
    guards: template.guards || {},
    budgets,
    signature,
    presentation,
  };
}

export function buildEventBusWithAssemblies(assemblies, world) {
  const bus = new EventBus();
  for (const asm of assemblies) {
    bus.subscribe(asm.event, (ctx) => executeAssembly(asm, ctx, world));
  }
  return bus;
}
