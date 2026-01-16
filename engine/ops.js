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
  
  if (targetOpt.kind === "allInRange") {
    const range = targetOpt.range || 12;
    const maxCount = targetOpt.maxCount;
    const selected = enemies.filter((e) => distance(e, caster) <= range);
    return maxCount ? selected.slice(0, maxCount) : selected;
  }
  
  if (targetOpt.kind === "lowestHealth") {
    const range = targetOpt.range || 12;
    const count = targetOpt.count || 1;
    return enemies
      .filter((e) => distance(e, caster) <= range)
      .sort((a, b) => (a.hp || 0) - (b.hp || 0))
      .slice(0, count);
  }
  
  if (targetOpt.kind === "highestHealth") {
    const range = targetOpt.range || 12;
    const count = targetOpt.count || 1;
    return enemies
      .filter((e) => distance(e, caster) <= range)
      .sort((a, b) => (b.hp || 0) - (a.hp || 0))
      .slice(0, count);
  }
  
  if (targetOpt.kind === "self") {
    return [caster];
  }
  
  if (targetOpt.kind === "allies") {
    const range = targetOpt.range || 12;
    const maxCount = targetOpt.maxCount;
    const allies = Object.values(world.entities).filter(
      (e) => e.alive !== false && e.team === caster.team && e.id !== caster.id
    );
    const selected = allies.filter((e) => distance(e, caster) <= range);
    return maxCount ? selected.slice(0, maxCount) : selected;
  }
  
  if (targetOpt.kind === "markedTargets") {
    const markTag = targetOpt.markTag;
    const range = targetOpt.range || 12;
    return enemies.filter((e) => {
      if (distance(e, caster) > range) return false;
      return e.tags && e.tags.has && e.tags.has(markTag);
    });
  }
  
  return enemies.slice(0, 1);
}

export function applyDamage(world, targets, caster, formula) {
  const currentTime = world.time || Date.now();
  for (const t of targets) {
    // Check for invulnerable
    if (t.invulnerableUntil && currentTime < t.invulnerableUntil) {
      // Completely invulnerable, no damage
      continue;
    }
    
    // Check for banished (cannot take damage)
    if (t.banishedUntil && currentTime < t.banishedUntil) {
      continue;
    }
    
    // Check for sleep (wake on damage)
    if (t.sleepUntil && currentTime < t.sleepUntil && t.wakeOnDamage) {
      // Wake up from sleep
      t.sleepUntil = 0;
    }
    
    // Apply attack buffs to caster
    let atk = caster.atk || 0;
    if (caster.buffs?.atkBoost && currentTime < caster.buffs.atkBoost.until) {
      atk *= (1 + caster.buffs.atkBoost.power);
    }
    
    const raw = atk * (formula.scale || 0) + (formula.flat || 0);
    
    // Check for immunity
    if (t.immunityUntil && currentTime < t.immunityUntil) {
      const immunityType = t.immunityType || "all";
      if (immunityType === "all" || immunityType === "physical" || immunityType === "magic") {
        // Immune to this damage type
        continue;
      }
    }
    
    // Apply defense buffs to target
    let defense = t.defense || 0;
    if (t.buffs?.defBoost && currentTime < t.buffs.defBoost.until) {
      defense += t.buffs.defBoost.power;
    }
    
    let mitigated = Math.max(0, raw - defense);
    
    // Check for reflect damage
    if (t.buffs?.reflect && currentTime < t.buffs.reflect.until && caster.id !== t.id) {
      const reflectAmount = Math.min(mitigated * t.buffs.reflect.percent, t.buffs.reflect.maxReflect - t.buffs.reflect.totalReflected);
      if (reflectAmount > 0) {
        t.buffs.reflect.totalReflected += reflectAmount;
        // Reflect damage back to caster
        if (caster.position && caster.alive !== false) {
          const casterDefense = caster.defense || 0;
          const reflectedDmg = Math.max(0, reflectAmount - casterDefense);
          caster.hp = (caster.hp || 0) - reflectedDmg;
          
          // Visual feedback
          if (caster.position) {
            world.hitEffects = world.hitEffects || [];
            world.hitEffects.push({
              position: { x: caster.position.x, y: caster.position.y },
              damage: reflectedDmg,
              createdAt: currentTime,
              duration: 800,
              type: "reflect",
            });
          }
          
          if (caster.hp <= 0) {
            caster.alive = false;
            caster.hp = 0;
            world.pendingDeaths.push(caster.id);
          }
        }
      }
    }
    
    // Apply shield (shield absorbs damage before HP)
    if (t.debuffs?.shield && currentTime < t.debuffs.shield.until) {
      const shieldAmount = t.debuffs.shield.power || 0;
      if (shieldAmount > 0) {
        const absorbed = Math.min(mitigated, shieldAmount);
        mitigated -= absorbed;
        t.debuffs.shield.power = Math.max(0, shieldAmount - absorbed);
        
        // Visual feedback for shield absorption
        if (absorbed > 0 && t.position) {
          world.hitEffects = world.hitEffects || [];
          world.hitEffects.push({
            position: { x: t.position.x, y: t.position.y },
            damage: -absorbed, // Negative for shield visual
            createdAt: currentTime,
            duration: 800,
            type: "shield",
          });
        }
        
        // Remove shield if depleted
        if (t.debuffs.shield.power <= 0) {
          delete t.debuffs.shield;
        }
      }
    }
    
    const prevHp = t.hp || 0;
    t.hp = prevHp - mitigated;
    world.log?.push?.({ type: "damage", target: t.id, value: mitigated });
    
    // Add hit effect for visual feedback
    if (mitigated > 0 && t.position) {
      world.hitEffects = world.hitEffects || [];
      world.hitEffects.push({
        position: { x: t.position.x, y: t.position.y },
        damage: mitigated,
        createdAt: currentTime,
        duration: 800,
      });
      // Trigger hit flash
      if (t.kind === "monster") {
        t.hitFlashUntil = currentTime + 100;
      }
    }
    
    if (t.hp <= 0) {
      t.alive = false;
      t.hp = 0;
      world.pendingDeaths.push(t.id);
    }
  }
}

export function applyDebuff(world, targets, debuff, now, caster) {
  for (const t of targets) {
    t.debuffs = t.debuffs || {};
    t.debuffs[debuff.kind] = {
      power: debuff.power,
      until: now + debuff.durationMs,
    };
    
    // Apply immediate effects
    if (debuff.kind === "knockback" && t.position && debuff.power > 0 && caster && caster.position) {
      // Knockback: initial displacement (immediate)
      const dx = t.position.x - caster.position.x;
      const dy = t.position.y - caster.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const knockbackDist = debuff.power;
      t.position.x += (dx / dist) * knockbackDist;
      t.position.y += (dy / dist) * knockbackDist;
      
      // Visual feedback
      world.hitEffects = world.hitEffects || [];
      world.hitEffects.push({
        position: { x: t.position.x, y: t.position.y },
        damage: 0,
        createdAt: now,
        duration: 300,
        type: "knockback",
      });
      
      console.log(`Knockback applied: distance=${knockbackDist}, duration=${debuff.durationMs}ms`);
    } else if (debuff.kind === "fear" && t.position) {
      // Fear: set random movement direction
      const fearAngle = Math.random() * Math.PI * 2;
      t.fearDirection = { x: Math.cos(fearAngle), y: Math.sin(fearAngle) };
      t.fearSpeed = debuff.moveSpeed || t.moveSpeed || 2;
    } else if (debuff.kind === "charm" && t.position && caster && caster.position) {
      // Charm: move towards caster
      const dx = caster.position.x - t.position.x;
      const dy = caster.position.y - t.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      t.charmDirection = { x: dx / dist, y: dy / dist };
      t.charmSpeed = debuff.moveSpeed || t.moveSpeed || 2;
    } else if (debuff.kind === "pull" && t.position && caster && caster.position) {
      // Pull: move target towards caster
      const dx = caster.position.x - t.position.x;
      const dy = caster.position.y - t.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pullDist = Math.min(debuff.power, dist);
      t.position.x += (dx / dist) * pullDist;
      t.position.y += (dy / dist) * pullDist;
      
      // Visual feedback
      world.hitEffects = world.hitEffects || [];
      world.hitEffects.push({
        position: { x: t.position.x, y: t.position.y },
        damage: 0,
        createdAt: now,
        duration: 300,
        type: "pull",
      });
    } else if (debuff.kind === "polymorph") {
      // Polymorph: transform target into harmless form
      t.polymorphForm = debuff.form || "sheep";
      t.polymorphUntil = now + debuff.durationMs;
    } else if (debuff.kind === "taunt") {
      // Taunt: force target to attack caster
      t.tauntTarget = caster.id;
      t.tauntUntil = now + debuff.durationMs;
    } else if (debuff.kind === "blind") {
      // Blind: reduce attack accuracy
      t.blindUntil = now + debuff.durationMs;
      t.blindMissChance = debuff.missChance || 0.5;
    } else if (debuff.kind === "suppress") {
      // Suppress: completely disable target
      t.suppressUntil = now + debuff.durationMs;
    } else if (debuff.kind === "bleed") {
      // Bleed: store caster ID for tick damage attribution
      t.debuffs.bleed.casterId = caster.id;
    } else if (debuff.kind === "sleep") {
      // Sleep: target enters sleep state
      t.sleepUntil = now + debuff.durationMs;
      t.wakeOnDamage = debuff.wakeOnDamage !== false; // Default true
      t.healRate = debuff.healRate || 0; // HP per second while sleeping
    } else if (debuff.kind === "ground") {
      // Ground: target is knocked down
      t.groundUntil = now + debuff.durationMs;
    } else if (debuff.kind === "banished") {
      // Banished: target enters another dimension
      t.banishedUntil = now + debuff.durationMs;
    } else if (debuff.kind === "immunity") {
      // Immunity: immune to specific damage types
      t.immunityUntil = now + debuff.durationMs;
      t.immunityType = debuff.immunityType || "all";
    } else if (debuff.kind === "invulnerable") {
      // Invulnerable: completely invulnerable
      t.invulnerableUntil = now + debuff.durationMs;
    } else if (debuff.kind === "cleanse") {
      // Cleanse: remove all negative effects
      const removeTypes = debuff.removeTypes || ["slow", "stun", "root", "disarm", "fear", "charm", "blind", "suppress", "sleep", "ground", "banished"];
      for (const type of removeTypes) {
        if (t.debuffs?.[type]) {
          delete t.debuffs[type];
        }
      }
      // Also remove immunity if specified
      if (debuff.immunityDuration) {
        t.immunityUntil = now + debuff.immunityDuration;
        t.immunityType = "cc"; // Immune to crowd control
      }
    } else if (debuff.kind === "stealth") {
      // Stealth: enter stealth state
      t.stealthUntil = now + debuff.durationMs;
      t.revealOnAttack = debuff.revealOnAttack !== false;
      t.revealOnDamage = debuff.revealOnDamage !== false;
      t.revealRange = debuff.revealRange || 3;
    } else if (debuff.kind === "haste") {
      // Haste: apply as buff (speed boost)
      t.buffs = t.buffs || {};
      t.buffs.haste = {
        speedBoost: debuff.speedBoost || 0.5,
        attackSpeedBoost: debuff.attackSpeedBoost || 0.3,
        until: now + debuff.durationMs,
      };
    }
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
          // InRange can be checked before Target selection (returns true if no targets yet)
          // or after Target selection (checks distance to selected targets)
          if (!ctx.targets || !ctx.targets.length) {
            // No targets selected yet, check if any enemy is in range
            const enemies = Object.values(world.entities).filter(
              (e) => e.alive !== false && e.team !== caster.team
            );
            if (enemies.length === 0) {
              // No enemies at all - allow cast anyway (player can shoot in any direction)
              return true;
            }
            // Check if at least one enemy is in range
            return enemies.some((e) => distance(e, caster) <= option.max);
          }
          // Targets already selected, check distance to them
          return ctx.targets.every((t) => {
            const target = world.entities[t];
            return target && distance(target, caster) <= option.max;
          });
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
    // Store target parameters for use by other ops
    if (option.kind === "circle") {
      base.radius = option.radius;
    } else if (option.kind === "cone") {
      base.range = option.range;
      base.angle = option.angle;
    } else if (option.kind === "allInRange") {
      base.range = option.range;
      base.maxCount = option.maxCount;
    } else if (option.kind === "lowestHealth" || option.kind === "highestHealth") {
      base.range = option.range;
      base.count = option.count;
    } else if (option.kind === "allies") {
      base.range = option.range;
      base.maxCount = option.maxCount;
    } else if (option.kind === "markedTargets") {
      base.markTag = option.markTag;
      base.range = option.range;
    }
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
      if (!caster) {
        console.error("Caster not found:", ctx.casterId);
        return;
      }
      const targets =
        ctx.targets?.map((id) => world.entities[id]).filter((e) => e?.alive !== false) || [];
      console.log("Action exec - caster:", ctx.casterId, "targets:", targets.length, "aimDir:", ctx.aimDir);
      switch (option.kind) {
        case "SpawnProjectile":
          // Generate projectile entity instead of immediate damage
          world.projectiles = world.projectiles || [];
          const projId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const projSpeed = (option.presentation?.projectileSpeed || ctx.assembly?.presentation?.projectileSpeed || 12) / 3; // Reduced to 1/3 for visibility
          
          // Calculate projectile direction: if there's a target, aim at target; otherwise use aimDir
          let projDir = ctx.aimDir ? { x: ctx.aimDir.x, y: ctx.aimDir.y } : { x: 1, y: 0 };
          if (targets.length > 0 && targets[0].position && caster.position) {
            // Aim at first target
            const dx = targets[0].position.x - caster.position.x;
            const dy = targets[0].position.y - caster.position.y;
            const dist = Math.hypot(dx, dy) || 1;
            projDir = { x: dx / dist, y: dy / dist };
            console.log("Projectile targeting:", targets[0].id, "direction:", projDir);
          }
          
          const proj = {
            id: projId,
            position: { x: caster.position.x, y: caster.position.y }, // Deep copy position
            velocity: projDir,
            speed: projSpeed,
            radius: 0.3, // world units (increased from 0.15 for visibility)
            // Projectile modifiers
            homing: option.homing || null,
            ricochet: option.ricochet || null,
            spiral: option.spiral ? { ...option.spiral, angle: 0 } : null,
            orbit: option.orbit ? { ...option.orbit, angle: 0, createdAt: ctx.time } : null,
            return: option.return ? { ...option.return, started: false } : null,
            hover: option.hover ? { ...option.hover, active: false, lastTickAt: 0 } : null, // Hover effect
            damage: caster.chargeEffect || option.formula, // Use charge effect if available
            casterId: ctx.casterId,
            createdAt: ctx.time,
            initialPosition: { x: caster.position.x, y: caster.position.y }, // Store initial position for distance calculation
            targets: targets.map((t) => t.id), // Remember intended targets for collision
            assembly: ctx.assembly,
          };
          world.projectiles.push(proj);
          console.log("Projectile spawned:", proj, "position:", proj.position, "velocity:", proj.velocity, "speed:", proj.speed);
          return;
        case "SpawnMultipleProjectiles":
          // Spawn multiple projectiles in a spread pattern
          world.projectiles = world.projectiles || [];
          const count = option.count || 3;
          const spreadAngle = (option.spreadAngle || 45) * (Math.PI / 180); // Convert to radians
          const spreadType = option.spreadType || "fan";
          const baseSpeed = (option.presentation?.projectileSpeed || ctx.assembly?.presentation?.projectileSpeed || 12) / 3;
          const baseDir = ctx.aimDir || { x: 1, y: 0 };
          
          for (let i = 0; i < count; i++) {
            const projId2 = `proj_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
            let angle = 0;
            
            if (spreadType === "fan") {
              // Fan spread: centered on aim direction
              const angleStep = spreadAngle / (count - 1 || 1);
              angle = -spreadAngle / 2 + i * angleStep;
            } else {
              // Circle spread: 360 degrees
              angle = (i / count) * Math.PI * 2;
            }
            
            // Rotate base direction by angle
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rotatedX = baseDir.x * cos - baseDir.y * sin;
            const rotatedY = baseDir.x * sin + baseDir.y * cos;
            
            const proj2 = {
              id: projId2,
              position: { x: caster.position.x, y: caster.position.y },
              velocity: { x: rotatedX, y: rotatedY },
              speed: baseSpeed,
              radius: option.radius || 0.3,
              damage: caster.chargeEffect || option.formula, // Use charge effect if available
              casterId: ctx.casterId,
              createdAt: ctx.time,
              targets: targets.map((t) => t.id),
              assembly: ctx.assembly,
            };
            world.projectiles.push(proj2);
          }
          console.log(`Spawned ${count} projectiles with ${spreadType} spread`);
          return;
        case "SpawnBurstProjectiles":
          // Spawn projectiles in rapid succession
          world.projectiles = world.projectiles || [];
          const burstCount = option.count || 3;
          const burstDelay = option.burstDelay || 100;
          const burstSpeed = (option.presentation?.projectileSpeed || ctx.assembly?.presentation?.projectileSpeed || 12) / 3;
          const baseDir2 = ctx.aimDir || { x: 1, y: 0 };
          
          // Spawn first projectile immediately
          const firstProjId = `proj_${Date.now()}_burst0_${Math.random().toString(36).substr(2, 9)}`;
          const firstProj = {
            id: firstProjId,
            position: { x: caster.position.x, y: caster.position.y },
            velocity: { x: baseDir2.x, y: baseDir2.y },
            speed: burstSpeed,
            radius: option.radius || 0.3,
            damage: caster.chargeEffect || option.formula, // Use charge effect if available
            casterId: ctx.casterId,
            createdAt: ctx.time,
            targets: targets.map((t) => t.id),
            assembly: ctx.assembly,
          };
          world.projectiles.push(firstProj);
          
          // Schedule remaining projectiles using the world queue system
          // Note: The queue uses 'at' field for timing
          world.queue = world.queue || [];
          for (let i = 1; i < burstCount; i++) {
            world.queue.push({
              fn: () => {
                const projId3 = `proj_${Date.now()}_burst${i}_${Math.random().toString(36).substr(2, 9)}`;
                const caster2 = world.entities[ctx.casterId];
                if (!caster2) return;
                
                const proj3 = {
                  id: projId3,
                  position: { x: caster2.position.x, y: caster2.position.y },
                  velocity: { x: baseDir2.x, y: baseDir2.y },
                  speed: burstSpeed,
                  radius: option.radius || 0.3,
                  damage: caster2.chargeEffect || option.formula, // Use charge effect if available
                  casterId: ctx.casterId,
                  createdAt: ctx.time + i * burstDelay,
                  targets: targets.map((t) => t.id),
                  assembly: ctx.assembly,
                };
                world.projectiles = world.projectiles || [];
                world.projectiles.push(proj3);
              },
              at: ctx.time + i * burstDelay,
            });
          }
          console.log(`Spawned burst of ${burstCount} projectiles with ${burstDelay}ms delay`);
          return;
        case "SpawnProjectileWithExplosion":
          // Spawn a projectile that explodes after delay
          world.projectiles = world.projectiles || [];
          const explProjId = `proj_${Date.now()}_expl_${Math.random().toString(36).substr(2, 9)}`;
          const explSpeed = (option.presentation?.projectileSpeed || ctx.assembly?.presentation?.projectileSpeed || 12) / 3;
          const explDelay = option.explosionDelay || 1000;
          const explRadius = option.explosionRadius || 2.5;
          
          const explProj = {
            id: explProjId,
            position: { x: caster.position.x, y: caster.position.y },
            velocity: ctx.aimDir ? { x: ctx.aimDir.x, y: ctx.aimDir.y } : { x: 1, y: 0 },
            speed: explSpeed,
            radius: option.radius || 0.3,
            damage: caster.chargeEffect || option.formula, // Use charge effect if available
            casterId: ctx.casterId,
            createdAt: ctx.time,
            targets: targets.map((t) => t.id),
            assembly: ctx.assembly,
            // Explosion properties
            explosionAt: ctx.time + explDelay,
            explosionFormula: option.explosionFormula, // Explosion damage doesn't use charge (it's separate)
            explosionRadius: explRadius,
          };
          world.projectiles.push(explProj);
          console.log("Explosive projectile spawned, will explode at:", explProj.explosionAt);
          return;
        case "Damage":
          // Damage action: direct damage, no projectiles
          // For melee attacks without explicit Target slot, select targets in range
          let damageTargets = targets;
          
          // Check if this is a melee template (no projectiles should be spawned)
          const isMeleeTemplate = ctx.assembly?.templateId === "tpl_melee_burst_v1";
          
          if (damageTargets.length === 0) {
            // Auto-select enemies in melee range (4m) if no targets selected
            const meleeRange = 4;
            const enemies = Object.values(world.entities).filter(
              (e) => e.alive !== false && e.kind === "monster" && e.team !== caster.team
            );
            damageTargets = enemies.filter((e) => {
              if (!e.position || !caster.position) return false;
              const dist = Math.hypot(
                e.position.x - caster.position.x,
                e.position.y - caster.position.y
              );
              return dist <= meleeRange;
            });
            
            // For cone attacks, limit to 3 targets in front
            if (ctx.assembly?.presentation?.indicatorShape === "cone" || option.id?.includes("cone")) {
              // Sort by distance and angle to caster's aim direction
              const aimDir = ctx.aimDir || { x: 1, y: 0 };
              damageTargets = damageTargets
                .map((e) => {
                  const dx = e.position.x - caster.position.x;
                  const dy = e.position.y - caster.position.y;
                  const dist = Math.hypot(dx, dy) || 1;
                  const dir = { x: dx / dist, y: dy / dist };
                  const dot = dir.x * aimDir.x + dir.y * aimDir.y;
                  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                  return { target: e, angle, distance: dist };
                })
                .filter(({ angle }) => angle <= Math.PI / 3) // 60 degree cone
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 3)
                .map(({ target }) => target);
            } else {
              // For line attacks, pick nearest target
              damageTargets = damageTargets
                .sort((a, b) => {
                  const distA = Math.hypot(
                    a.position.x - caster.position.x,
                    a.position.y - caster.position.y
                  );
                  const distB = Math.hypot(
                    b.position.x - caster.position.x,
                    b.position.y - caster.position.y
                  );
                  return distA - distB;
                })
                .slice(0, 1);
            }
          }
          
          if (damageTargets.length > 0) {
            // Apply damage directly (melee attack, no projectiles)
            // Use charge effect if available, otherwise use option.formula
            const damageFormula = caster.chargeEffect || option.formula;
            applyDamage(world, damageTargets, caster, damageFormula);
            console.log(isMeleeTemplate ? "Melee" : "Damage", "applied to", damageTargets.length, "targets", caster.chargeEffect ? "(charged)" : "");
          } else {
            console.log("No targets in range for", isMeleeTemplate ? "melee" : "", "attack");
          }
          return;
        case "PercentDamage":
          // Percentage damage based on target max HP
          const currentTime2 = world.time || ctx.time;
          for (const t of targets) {
            const maxHp = t.maxHp || t.hp || 1;
            const percentDmg = maxHp * (option.percent || 0.05);
            const flatDmg = option.flat || 0;
            const totalDmg = percentDmg + flatDmg;
            const mitigated = Math.max(0, totalDmg - (t.defense || 0));
            const prevHp = t.hp || 0;
            t.hp = prevHp - mitigated;
            world.log?.push?.({ type: "damage", target: t.id, value: mitigated });
            
            // Add hit effect
            if (mitigated > 0 && t.position) {
              world.hitEffects = world.hitEffects || [];
              world.hitEffects.push({
                position: { x: t.position.x, y: t.position.y },
                damage: mitigated,
                createdAt: currentTime2,
                duration: 800,
              });
              if (t.kind === "monster") {
                t.hitFlashUntil = currentTime2 + 100;
              }
            }
            
            if (t.hp <= 0) {
              t.alive = false;
              t.hp = 0;
              world.pendingDeaths.push(t.id);
            }
          }
          return;
        case "TrueDamage":
          // True damage ignores defense
          const currentTime3 = world.time || ctx.time;
          for (const t of targets) {
            const atk = caster.atk || 0;
            const raw = atk * (option.formula.scale || 0) + (option.formula.flat || 0);
            const mitigated = Math.max(0, raw); // No defense reduction
            const prevHp = t.hp || 0;
            t.hp = prevHp - mitigated;
            world.log?.push?.({ type: "damage", target: t.id, value: mitigated });
            
            // Add hit effect
            if (mitigated > 0 && t.position) {
              world.hitEffects = world.hitEffects || [];
              world.hitEffects.push({
                position: { x: t.position.x, y: t.position.y },
                damage: mitigated,
                createdAt: currentTime3,
                duration: 800,
                type: "trueDamage", // Special visual for true damage
              });
              if (t.kind === "monster") {
                t.hitFlashUntil = currentTime3 + 100;
              }
            }
            
            if (t.hp <= 0) {
              t.alive = false;
              t.hp = 0;
              world.pendingDeaths.push(t.id);
            }
          }
          return;
        case "ChainDamage": {
          // Chain damage jumps between targets
          if (targets.length === 0) return;
          const chainCount = option.chainCount || 3;
          const chainRange = option.chainRange || 4;
          const damageDecay = option.damageDecay || 0.8;
          const chainTargets = [];
          const hitTargets = new Set();
          
          // Start with first target
          let currentTarget = targets[0];
          let currentDamage = option.formula;
          let remainingChains = chainCount;
          
          while (currentTarget && remainingChains > 0 && !hitTargets.has(currentTarget.id)) {
            hitTargets.add(currentTarget.id);
            chainTargets.push({ target: currentTarget, formula: currentDamage });
            
            // Find next target in range
            remainingChains--;
            if (remainingChains > 0) {
              const nextTargets = Object.values(world.entities).filter((e) => {
                if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
                if (hitTargets.has(e.id)) return false; // Don't chain to same target
                const dist = distance(e, currentTarget);
                return dist <= chainRange;
              });
              
              if (nextTargets.length > 0) {
                // Pick nearest
                nextTargets.sort((a, b) => distance(a, currentTarget) - distance(b, currentTarget));
                currentTarget = nextTargets[0];
                // Apply damage decay
                currentDamage = {
                  scale: currentDamage.scale * damageDecay,
                  flat: currentDamage.flat * damageDecay,
                };
              } else {
                break; // No more targets in range
              }
            }
          }
          
          // Apply damage to all chained targets
          for (const { target, formula } of chainTargets) {
            applyDamage(world, [target], caster, formula);
          }
          
          // Visual: draw chain lines
          if (chainTargets.length > 1) {
            world.chainEffects = world.chainEffects || [];
            world.chainEffects.push({
              targets: chainTargets.map(({ target }) => target.id),
              createdAt: ctx.time,
              duration: 500,
            });
          }
          return;
        }
        case "BounceDamage": {
          // Bounce damage: can hit same target multiple times
          if (targets.length === 0) return;
          const bounceCount = option.bounceCount || 3;
          const bounceRange = option.bounceRange || 4;
          const bounceDecay = option.damageDecay || 0.8;
          const canBounceSelf = option.canBounceSelf || false;
          const bounceTargets = [];
          
          // Start with first target
          let currentTarget = targets[0];
          let currentDamage = option.formula;
          let remainingBounces = bounceCount;
          
          while (currentTarget && remainingBounces > 0) {
            bounceTargets.push({ target: currentTarget, formula: currentDamage });
            
            // Find next target in range
            remainingBounces--;
            if (remainingBounces > 0) {
              const nextTargets = Object.values(world.entities).filter((e) => {
                if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
                if (!canBounceSelf && e.id === currentTarget.id) return false; // Don't bounce to self unless allowed
                const dist = distance(e, currentTarget);
                return dist <= bounceRange;
              });
              
              if (nextTargets.length > 0) {
                // Pick random target for bounce
                const rng = ctx.rng || (() => Math.random());
                currentTarget = nextTargets[Math.floor(rng() * nextTargets.length)];
                // Apply damage decay
                currentDamage = {
                  scale: currentDamage.scale * bounceDecay,
                  flat: currentDamage.flat * bounceDecay,
                };
              } else {
                break; // No more targets in range
              }
            }
          }
          
          // Apply damage to all bounced targets
          for (const { target, formula } of bounceTargets) {
            applyDamage(world, [target], caster, formula);
          }
          
          // Visual: draw bounce lines
          if (bounceTargets.length > 1) {
            world.chainEffects = world.chainEffects || [];
            world.chainEffects.push({
              targets: bounceTargets.map(({ target }) => target.id),
              createdAt: ctx.time,
              duration: 500,
              type: "bounce",
            });
          }
          return;
        }
        case "PierceDamage": {
          // Pierce damage: hits all targets in a line
          if (targets.length === 0) return;
          const pierceCount = option.pierceCount || 3;
          const pierceDecay = option.damageDecay || 0.9;
          const pierceWidth = option.pierceWidth || 0.5;
          
          // Get direction from caster to first target
          const firstTarget = targets[0];
          if (!firstTarget.position || !caster.position) return;
          
          const dx = firstTarget.position.x - caster.position.x;
          const dy = firstTarget.position.y - caster.position.y;
          const dist = Math.hypot(dx, dy) || 1;
          const dirX = dx / dist;
          const dirY = dy / dist;
          
          // Find all enemies in the line
          const lineTargets = [];
          let currentDamage = option.formula;
          let hits = 0;
          
          // Check all enemies and find those in the line
          const allEnemies = Object.values(world.entities).filter((e) => {
            if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
            if (!e.position) return false;
            
            // Check if enemy is in the line (within width)
            const toEnemyX = e.position.x - caster.position.x;
            const toEnemyY = e.position.y - caster.position.y;
            const toEnemyDist = Math.hypot(toEnemyX, toEnemyY);
            
            // Project onto line direction
            const projDist = toEnemyX * dirX + toEnemyY * dirY;
            if (projDist < 0 || projDist > dist) return false; // Not in line segment
            
            // Check perpendicular distance
            const perpDist = Math.abs(toEnemyX * dirY - toEnemyY * dirX);
            return perpDist <= pierceWidth;
          });
          
          // Sort by distance from caster
          allEnemies.sort((a, b) => {
            const distA = distance(a, caster);
            const distB = distance(b, caster);
            return distA - distB;
          });
          
          // Apply damage to first N enemies
          for (let i = 0; i < Math.min(pierceCount, allEnemies.length); i++) {
            const target = allEnemies[i];
            lineTargets.push({ target, formula: currentDamage });
            // Apply damage decay for next target
            currentDamage = {
              scale: currentDamage.scale * pierceDecay,
              flat: currentDamage.flat * pierceDecay,
            };
          }
          
          // Apply damage
          for (const { target, formula } of lineTargets) {
            applyDamage(world, [target], caster, formula);
          }
          
          // Visual: draw pierce line
          if (lineTargets.length > 0) {
            world.chainEffects = world.chainEffects || [];
            world.chainEffects.push({
              targets: lineTargets.map(({ target }) => target.id),
              createdAt: ctx.time,
              duration: 400,
              type: "pierce",
            });
          }
          return;
        }
        case "ReflectDamage":
          // Reflect damage: apply buff that reflects incoming damage
          const reflectPercent = option.reflectPercent || 0.2;
          const reflectDuration = option.durationMs || 3000;
          const maxReflect = option.maxReflect || 1000;
          
          for (const t of targets) {
            t.buffs = t.buffs || {};
            t.buffs.reflect = {
              percent: reflectPercent,
              until: ctx.time + reflectDuration,
              maxReflect: maxReflect,
              totalReflected: 0,
            };
          }
          return;
        case "SplitDamage":
          // Split damage: on hit, spawn projectiles that split
          if (targets.length === 0) return;
          const splitCount = option.splitCount || 3;
          const splitAngle = option.splitAngle || 60;
          const splitDecay = option.damageDecay || 0.7;
          
          // Apply initial damage
          // Use charge effect if available, otherwise use option.formula
          const damageFormula = caster.chargeEffect || option.formula;
          applyDamage(world, targets, caster, damageFormula);
          
          // For each hit target, spawn split projectiles
          for (const hitTarget of targets) {
            if (!hitTarget.position || !caster.position) continue;
            
            // Calculate split directions
            const baseAngle = Math.atan2(
              hitTarget.position.y - caster.position.y,
              hitTarget.position.x - caster.position.x
            );
            const angleStep = splitAngle / (splitCount - 1);
            const startAngle = baseAngle - splitAngle / 2;
            
            // Spawn split projectiles
            for (let i = 0; i < splitCount; i++) {
              const angle = startAngle + angleStep * i;
              const splitDir = { x: Math.cos(angle), y: Math.sin(angle) };
              const splitFormula = {
                scale: option.formula.scale * splitDecay,
                flat: option.formula.flat * splitDecay,
              };
              
              // Create a projectile that will hit the next target
              const splitProj = {
                id: `split_${Date.now()}_${i}`,
                casterId: caster.id,
                position: { x: hitTarget.position.x, y: hitTarget.position.y },
                velocity: splitDir,
                speed: option.projectileSpeed || 10,
                radius: option.radius || 0.3,
                damage: splitFormula,
                createdAt: ctx.time,
                split: true, // Mark as split projectile
              };
              
              world.projectiles = world.projectiles || [];
              world.projectiles.push(splitProj);
            }
          }
          return;
        case "ExecuteDamage":
          // Execute damage: higher damage when target HP is low
          if (targets.length === 0) return;
          const executeThreshold = option.executeThreshold || 0.3;
          const executeMultiplier = option.executeMultiplier || 2.0;
          
          for (const t of targets) {
            const maxHp = t.maxHp || t.hp || 1;
            const currentHp = t.hp || 0;
            const hpPercent = currentHp / maxHp;
            
            let damageFormula = option.baseFormula || option.formula;
            
            // Apply execute multiplier if HP is below threshold
            if (hpPercent <= executeThreshold) {
              damageFormula = {
                scale: damageFormula.scale * executeMultiplier,
                flat: damageFormula.flat * executeMultiplier,
              };
            }
            
            applyDamage(world, [t], caster, damageFormula);
            
            // Visual feedback for execute
            if (hpPercent <= executeThreshold && t.position) {
              world.hitEffects = world.hitEffects || [];
              world.hitEffects.push({
                position: { x: t.position.x, y: t.position.y },
                damage: 0,
                createdAt: ctx.time,
                duration: 400,
                type: "execute",
              });
            }
          }
          return;
        case "BleedDamage":
          // Bleed damage: apply DoT debuff
          const bleedTickFormula = option.tickFormula || option.formula;
          const bleedDuration = option.durationMs || 3000;
          const bleedTickInterval = option.tickIntervalMs || 500;
          const maxStacks = option.maxStacks || 3;
          
          for (const t of targets) {
            t.debuffs = t.debuffs || {};
            
            // Stack bleed
            if (!t.debuffs.bleed) {
              t.debuffs.bleed = {
                stacks: 0,
                until: ctx.time + bleedDuration,
                tickIntervalMs: bleedTickInterval,
                lastTickAt: ctx.time,
                tickFormula: bleedTickFormula,
                casterId: caster.id, // Store caster for tick damage attribution
              };
            }
            
            // Increase stacks (capped)
            t.debuffs.bleed.stacks = Math.min((t.debuffs.bleed.stacks || 0) + 1, maxStacks);
            t.debuffs.bleed.until = ctx.time + bleedDuration; // Refresh duration
            t.debuffs.bleed.casterId = caster.id; // Update caster ID
          }
          return;
        case "CritDamage":
          // Crit damage: chance to deal extra damage
          if (targets.length === 0) return;
          const critChance = option.critChance || 0.25;
          const critMultiplier = option.critMultiplier || 2.0;
          const rng = ctx.rng || (() => Math.random());
          
          for (const t of targets) {
            const roll = rng();
            let damageFormula = option.formula;
            
            if (roll < critChance) {
              // Critical hit!
              damageFormula = {
                scale: damageFormula.scale * critMultiplier,
                flat: damageFormula.flat * critMultiplier,
              };
              
              // Visual feedback for crit
              if (t.position) {
                world.hitEffects = world.hitEffects || [];
                world.hitEffects.push({
                  position: { x: t.position.x, y: t.position.y },
                  damage: 0,
                  createdAt: ctx.time,
                  duration: 300,
                  type: "crit",
                });
              }
            }
            
            applyDamage(world, [t], caster, damageFormula);
          }
          return;
        case "Charge":
          // Charge: calculate effect based on actual charge time
          const chargeTime = ctx.chargeTime || 0; // Get charge time from context (set by player input)
          const maxChargeTime = option.maxChargeTime || 2000;
          const minEffect = option.minEffect || { scale: 0.5, flat: 20 };
          const maxEffect = option.maxEffect || { scale: 1.5, flat: 60 };
          
          // Calculate charge ratio (0 to 1)
          const chargeRatio = Math.min(1, Math.max(0, chargeTime / maxChargeTime));
          
          // Interpolate between min and max effect based on charge ratio
          const chargeEffect = {
            scale: minEffect.scale + (maxEffect.scale - minEffect.scale) * chargeRatio,
            flat: minEffect.flat + (maxEffect.flat - minEffect.flat) * chargeRatio,
          };
          
          // Store charge effect on caster for subsequent actions to use
          caster.chargeEffect = chargeEffect;
          caster.chargeRatio = chargeRatio;
          
          console.log(`Charge: time=${chargeTime}ms, ratio=${chargeRatio.toFixed(2)}, effect=scale:${chargeEffect.scale.toFixed(2)}, flat:${chargeEffect.flat.toFixed(2)}`);
          return;
        case "Stack":
          // Stack: add charge to skill
          caster.stacks = caster.stacks || {};
          const stackId = option.stackId || "default";
          if (!caster.stacks[stackId]) {
            caster.stacks[stackId] = {
              current: 0,
              max: option.maxStacks || 3,
              cooldown: option.stackCooldown || 5000,
              lastStackTime: 0,
            };
          }
          const stack = caster.stacks[stackId];
          if (ctx.time - stack.lastStackTime >= stack.cooldown) {
            stack.current = Math.min(stack.current + 1, stack.max);
            stack.lastStackTime = ctx.time;
          }
          return;
        case "Summon":
          // Summon: create a summon entity
          world.entities = world.entities || {};
          const summonId = `summon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const summonPos = targets.length > 0 && targets[0].position
            ? { x: targets[0].position.x, y: targets[0].position.y }
            : caster.position
            ? { x: caster.position.x + (ctx.aimDir?.x || 1) * 3, y: caster.position.y + (ctx.aimDir?.y || 0) * 3 }
            : { x: 0, y: 0 };
          
          const summon = {
            id: summonId,
            kind: "summon",
            team: caster.team,
            position: summonPos,
            hp: option.hp || 100,
            maxHp: option.hp || 100,
            atk: option.atk || 20,
            defense: option.defense || 5,
            moveSpeed: option.moveSpeed || 2,
            range: option.attackRange || 3,
            attackSpeed: option.attackSpeed || 1000,
            durationMs: option.durationMs || 10000,
            createdAt: ctx.time,
            alive: true,
            ai: option.ai || "attack",
            protoName: option.summonType || "minion",
          };
          
          world.entities[summonId] = summon;
          return;
        case "Debuff":
          applyDebuff(world, targets, option.debuff, ctx.time, caster);
          return;
        case "SelfDebuff":
          // 负面效果：应用到施法者自身
          const selfDebuff = option.debuff || option;
          if (selfDebuff.kind === "selfSlow") {
            // 自身减速
            caster.buffs = caster.buffs || {};
            caster.buffs.slow = {
              power: selfDebuff.power || 0.3,
              until: ctx.time + (selfDebuff.durationMs || 2000),
            };
          } else if (selfDebuff.kind === "selfVuln") {
            // 自身易伤
            caster.buffs = caster.buffs || {};
            caster.buffs.vulnerable = {
              power: selfDebuff.power || 0.2,
              until: ctx.time + (selfDebuff.durationMs || 5000),
            };
          } else if (selfDebuff.kind === "selfRoot") {
            // 自身定身
            caster.rootedUntil = ctx.time + (selfDebuff.durationMs || 1000);
          }
          console.log(`Applied self debuff: ${selfDebuff.kind} to caster`);
          return;
        case "Heal":
          // Heal targets
          const currentTime4 = world.time || ctx.time;
          for (const t of targets) {
            if (t.alive === false) continue;
            const casterAtk = caster.atk || 0;
            let healAmount = 0;
            
            if (option.isPercent) {
              // Percentage of target max HP
              const maxHp = t.maxHp || t.hp || 1;
              healAmount = maxHp * (option.formula.scale || 0) + (option.formula.flat || 0);
            } else {
              // Based on caster attributes
              healAmount = casterAtk * (option.formula.scale || 0) + (option.formula.flat || 0);
            }
            
            const maxHp = t.maxHp || t.hp || 1;
            const prevHp = t.hp || 0;
            t.hp = Math.min(maxHp, prevHp + healAmount);
            world.log?.push?.({ type: "heal", target: t.id, value: healAmount });
            
            // Add heal effect
            if (healAmount > 0 && t.position) {
              world.hitEffects = world.hitEffects || [];
              world.hitEffects.push({
                position: { x: t.position.x, y: t.position.y },
                damage: -healAmount, // Negative for heal visual
                createdAt: currentTime4,
                duration: 800,
                type: "heal",
              });
            }
          }
          return;
        case "Buff":
          // Apply buff to targets
          for (const t of targets) {
            t.buffs = t.buffs || {};
            t.buffs[option.buff.kind] = {
              power: option.buff.power,
              until: ctx.time + option.buff.durationMs,
            };
          }
          return;
        case "Dash":
          // Create dash state instead of instant teleport
          caster.position = caster.position || { x: 0, y: 0 };
          const dashDir = ctx.aimDir || { x: 1, y: 0 };
          const dashDistance = option.distance || 5;
          const dashSpeed = option.speed || 15; // world units per second (default fast dash)
          
          // Store dash state on caster
          caster.dashState = {
            active: true,
            startPos: { x: caster.position.x, y: caster.position.y },
            direction: { x: dashDir.x, y: dashDir.y },
            distance: dashDistance,
            remainingDistance: dashDistance,
            speed: dashSpeed,
            startTime: ctx.time,
            // Store trail points for visual effect
            trail: [{ x: caster.position.x, y: caster.position.y, time: ctx.time }],
          };
          console.log("Dash started:", caster.dashState);
          return;
        case "Blink":
          // Instant teleport to target location
          caster.position = caster.position || { x: 0, y: 0 };
          const blinkDir = ctx.aimDir || { x: 1, y: 0 };
          const blinkDistance = option.distance || 5;
          const canPassWall = option.canPassWall || false;
          
          // Calculate blink position
          const blinkX = caster.position.x + blinkDir.x * blinkDistance;
          const blinkY = caster.position.y + blinkDir.y * blinkDistance;
          
          // Store old position for visual effect
          const oldPos = { x: caster.position.x, y: caster.position.y };
          
          // Teleport instantly
          caster.position.x = blinkX;
          caster.position.y = blinkY;
          
          // Visual feedback
          world.hitEffects = world.hitEffects || [];
          world.hitEffects.push({
            position: oldPos,
            damage: 0,
            createdAt: ctx.time,
            duration: 200,
            type: "blink",
          });
          world.hitEffects.push({
            position: { x: blinkX, y: blinkY },
            damage: 0,
            createdAt: ctx.time,
            duration: 200,
            type: "blink",
          });
          return;
        case "Jump":
          // Parabolic jump to target location
          caster.position = caster.position || { x: 0, y: 0 };
          const jumpDir = ctx.aimDir || { x: 1, y: 0 };
          const jumpDistance = option.distance || 5;
          const jumpHeight = option.height || 2;
          const jumpDuration = option.duration || 500;
          const landDamage = option.landDamage || null;
          
          // Calculate jump target
          const jumpTargetX = caster.position.x + jumpDir.x * jumpDistance;
          const jumpTargetY = caster.position.y + jumpDir.y * jumpDistance;
          
          // Store jump state
          caster.jumpState = {
            active: true,
            startPos: { x: caster.position.x, y: caster.position.y },
            targetPos: { x: jumpTargetX, y: jumpTargetY },
            height: jumpHeight,
            duration: jumpDuration,
            startTime: ctx.time,
            landDamage: landDamage,
          };
          return;
        case "Pull":
          // Pull target towards caster (handled in applyDebuff)
          // This action triggers the debuff application
          const pullDebuff = {
            kind: "pull",
            power: option.distance || 3,
            durationMs: option.duration || 500, // Duration for continuous pull effect
            moveSpeed: option.speed || 10,
          };
          applyDebuff(world, targets, pullDebuff, ctx.time, caster);
          console.log(`Pull applied: distance=${pullDebuff.power}, duration=${pullDebuff.durationMs}ms, speed=${pullDebuff.moveSpeed}`);
          return;
        case "SpawnAreaDoT":
          // Create a persistent area effect that deals damage over time
          world.areaEffects = world.areaEffects || [];
          const areaId = `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Determine area position: use mouse position (aim direction) for ground-targeted skills
          let areaPos = { x: caster.position.x, y: caster.position.y };
          if (ctx.aimDir) {
            // Place area effect in front of caster (ground-targeted)
            const range = 4; // Default range for ground-targeted
            areaPos = {
              x: caster.position.x + ctx.aimDir.x * range,
              y: caster.position.y + ctx.aimDir.y * range,
            };
          }
          // If targets are selected, use first target's position (for target-based area)
          if (targets.length > 0 && targets[0].position) {
            areaPos = { x: targets[0].position.x, y: targets[0].position.y };
          }
          
          // Get radius from Target op (for circle targets) or default
          let radius = 3; // Default
          if (ctx.assembly?.ops) {
            const targetOp = ctx.assembly.ops.find((op) => op.type === "Target");
            if (targetOp && targetOp.kind === "circle" && targetOp.radius) {
              radius = targetOp.radius;
            }
          }
          // Option can override radius if specified
          if (option.radius !== undefined) {
            radius = option.radius;
          }
          const durationMs = option.durationMs || 4000; // Default 4 seconds
          const tickIntervalMs = option.tickIntervalMs || 500; // Default 500ms per tick
          
          // Collect all debuffs from assembly that should be applied with this area effect
          // This includes debuffs from subsequent Action ops in the same assembly
          const areaDebuffs = [];
          if (option.debuff) {
            areaDebuffs.push(option.debuff);
          }
          // Check for debuff actions in the assembly that come after this SpawnAreaDoT
          if (ctx.assembly?.ops) {
            let currentOpIndex = ctx.currentOpIndex;
            // Fallback: try to find current op index
            if (currentOpIndex === undefined) {
              currentOpIndex = ctx.assembly.ops.findIndex((op) => 
                op.type === "Action" && op.kind === "SpawnAreaDoT"
              );
            }
            if (currentOpIndex >= 0) {
              // Look for Debuff actions after this SpawnAreaDoT action
              for (let i = currentOpIndex + 1; i < ctx.assembly.ops.length; i++) {
                const nextOp = ctx.assembly.ops[i];
                // Stop if we hit a Timeline (delay) or Condition/Target (new sequence)
                if (nextOp.type === "Timeline" || nextOp.type === "Condition" || nextOp.type === "Target") {
                  break;
                }
                // If it's a Debuff action, add it to the area debuffs
                if (nextOp.type === "Action" && nextOp.kind === "Debuff" && nextOp.option?.debuff) {
                  areaDebuffs.push(nextOp.option.debuff);
                  console.log("Found debuff action in assembly, adding to area effect:", nextOp.option.debuff);
                }
              }
            }
          }
          
          const areaEffect = {
            id: areaId,
            position: areaPos,
            radius: radius,
            tickFormula: option.tickFormula,
            casterId: ctx.casterId,
            createdAt: ctx.time,
            expiresAt: ctx.time + durationMs,
            lastTickAt: ctx.time,
            tickIntervalMs: tickIntervalMs,
            debuffs: areaDebuffs, // Store all debuffs to apply on each tick
          };
          world.areaEffects.push(areaEffect);
          console.log("Area DoT spawned at:", areaPos, "radius:", radius, "duration:", durationMs, "debuffs:", areaDebuffs.length);
          
          // Apply initial tick
          const enemiesInArea = Object.values(world.entities).filter((e) => {
            if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
            const dist = Math.hypot(
              (e.position?.x || 0) - areaPos.x,
              (e.position?.y || 0) - areaPos.y
            );
            return dist <= radius;
          });
          if (enemiesInArea.length > 0) {
            applyDamage(world, enemiesInArea, caster, option.tickFormula);
            // Apply all debuffs
            for (const debuff of areaDebuffs) {
              applyDebuff(world, enemiesInArea, debuff, ctx.time, caster);
            }
          }
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
        case "ChainTrigger":
          // ChainTrigger: store trigger info on caster for later use
          // This will be checked when the trigger event occurs
          caster.chainTriggers = caster.chainTriggers || [];
          caster.chainTriggers.push({
            triggerEvent: option.triggerEvent || "onHit",
            triggeredAction: option.triggeredAction,
            triggerChance: option.triggerChance || 1.0,
            maxTriggers: option.maxTriggers || -1,
            cooldown: option.cooldown || 0,
            triggerCount: 0,
            lastTriggerTime: 0,
            assembly: ctx.assembly,
          });
          console.log(`ChainTrigger registered: ${option.triggerEvent}, chance: ${option.triggerChance}`);
          return;
        case "Beam": {
          // Beam: create a persistent beam effect
          world.beams = world.beams || [];
          const beamId = `beam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const beamLength = option.beamLength || 15;
          const beamWidth = option.beamWidth || 1;
          const beamDuration = option.beamDuration || 2000;
          const tickInterval = option.tickInterval || 100;
          const tickFormula = option.tickFormula || { scale: 0.4, flat: 15 };
          const beamPierceCount = option.pierceCount || -1;
          
          // Calculate beam direction: prioritize targets, then aimDir
          let beamDir = ctx.aimDir || { x: 1, y: 0 };
          if (targets && targets.length > 0 && targets[0].position && caster.position) {
            // Aim at first target
            const dx = targets[0].position.x - caster.position.x;
            const dy = targets[0].position.y - caster.position.y;
            const dist = Math.hypot(dx, dy) || 1;
            beamDir = { x: dx / dist, y: dy / dist };
            console.log("Beam targeting:", targets[0].id, "direction:", beamDir);
          }
          
          // Calculate beam end position
          // 深拷贝caster位置，避免引用问题
          const beamStart = { x: caster.position.x, y: caster.position.y };
          const beamEnd = {
            x: beamStart.x + beamDir.x * beamLength,
            y: beamStart.y + beamDir.y * beamLength,
          };
          
          const beam = {
            id: beamId,
            start: beamStart, // 初始位置，会在更新时跟随caster
            end: beamEnd, // 初始结束位置，会在更新时重新计算
            direction: beamDir,
            length: beamLength,
            width: beamWidth,
            duration: beamDuration,
            tickInterval: tickInterval,
            tickFormula: tickFormula,
            pierceCount: beamPierceCount,
            casterId: ctx.casterId,
            createdAt: ctx.time,
            expiresAt: ctx.time + beamDuration,
            lastTickAt: ctx.time,
            canRotate: option.canRotate || false,
            rotateSpeed: option.rotateSpeed || 0,
            currentAngle: Math.atan2(beamDir.y, beamDir.x),
          };
          world.beams.push(beam);
          console.log(`Beam created: length=${beamLength}, duration=${beamDuration}ms, start=(${beamStart.x.toFixed(2)}, ${beamStart.y.toFixed(2)}), end=(${beamEnd.x.toFixed(2)}, ${beamEnd.y.toFixed(2)})`);
          return;
        }
        default:
          return;
      }
    };
    return base;
  }

  return base;
}
