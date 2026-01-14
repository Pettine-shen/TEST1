import { pickChance } from "./rng.js";

function distance(a, b) {
  const dx = (a.position?.x || 0) - (b.position?.x || 0);
  const dy = (a.position?.y || 0) - (b.position?.y || 0);
  return Math.hypot(dx, dy);
}

function chooseTargets(world, caster, targetOpt) {
  const enemies = Object.values(world.entities).filter(
    (e) => e.alive !== false && e.team !== caster.team
  );
  if (!enemies.length) return [];
  if (targetOpt.kind === "singleNearest") {
    return enemies.sort((a, b) => distance(a, caster) - distance(b, caster)).slice(0, 1);
  }
  if (targetOpt.kind === "cone") {
    return enemies
      .filter((e) => distance(e, caster) <= targetOpt.range)
      .slice(0, targetOpt.max ?? 3);
  }
  if (targetOpt.kind === "circle") {
    return enemies
      .filter((e) => distance(e, caster) <= targetOpt.radius)
      .slice(0, targetOpt.max ?? enemies.length);
  }
  return enemies.slice(0, 1);
}

function applyDamage(world, targets, caster, formula) {
  for (const t of targets) {
    const atk = caster.atk || 0;
    const raw = atk * (formula.scale || 0) + (formula.flat || 0);
    const mitigated = Math.max(0, raw - (t.defense || 0));
    t.hp = (t.hp || 0) - mitigated;
    world.log?.push?.({ type: "damage", target: t.id, value: mitigated });
    if (t.hp <= 0) {
      t.alive = false;
      t.hp = 0;
      world.pendingDeaths.push(t.id);
    }
  }
}

function applyDebuff(world, targets, debuff, now) {
  for (const t of targets) {
    t.debuffs = t.debuffs || {};
    t.debuffs[debuff.kind] = {
      power: debuff.power,
      until: now + debuff.durationMs,
    };
  }
}

function applyMark(world, targets, mark) {
  for (const t of targets) {
    t.tags = t.tags || new Set();
    t.tags.add(mark.tag);
  }
}

export function buildOp(slot, option) {
  const base = {
    slotId: slot.id,
    type: slot.type,
    label: option.label || option.id,
    budget: option.budget,
    env: option.env || "PVE",
  };

  if (slot.type === "Condition") {
    base.kind = option.kind;
    base.eval = (ctx, world) => {
      const caster = world.entities[ctx.casterId];
      switch (option.kind) {
        case "HasResource":
          return (caster[option.resource] || 0) >= option.amount;
        case "InRange":
          if (!ctx.targets || !ctx.targets.length) return true;
          return ctx.targets.every((t) => distance(world.entities[t], caster) <= option.max);
        case "TargetType":
          if (!ctx.targets || !ctx.targets.length) return false;
          return ctx.targets.every((t) => option.allow.includes(world.entities[t].kind));
        case "ProcChance":
          return pickChance(ctx.rng, option.chance);
        default:
          return true;
      }
    };
    base.failCode = option.failCode || option.kind;
    return base;
  }

  if (slot.type === "Target") {
    base.kind = "Target";
    base.select = (ctx, world) => {
      const caster = world.entities[ctx.casterId];
      return chooseTargets(world, caster, option);
    };
    return base;
  }

  if (slot.type === "Timeline") {
    base.kind = "Timeline";
    base.delay = option.delayMs || 0;
    return base;
  }

  if (slot.type === "Action") {
    base.kind = option.kind;
    base.exec = (ctx, world) => {
      const caster = world.entities[ctx.casterId];
      const targets =
        ctx.targets?.map((id) => world.entities[id]).filter((e) => e?.alive !== false) || [];
      switch (option.kind) {
        case "SpawnProjectile":
        case "Damage":
          applyDamage(world, targets, caster, option.formula);
          return;
        case "Debuff":
          applyDebuff(world, targets, option.debuff, ctx.time);
          return;
        case "Dash":
          caster.position = caster.position || { x: 0, y: 0 };
          caster.position.x += option.distance;
          return;
        case "SpawnAreaDoT":
          // apply immediate tick; scheduler handles repeats upstream if needed
          applyDamage(world, targets, caster, option.tickFormula);
          return;
        case "Mark":
          applyMark(world, targets, { tag: option.tag });
          return;
        case "MarkReward":
          world.rewards = world.rewards || [];
          for (const t of targets) {
            if (t.tags?.has(option.requiredTag) && option.reward) {
              world.rewards.push(option.reward);
            }
          }
          return;
        default:
          return;
      }
    };
    return base;
  }

  return base;
}
