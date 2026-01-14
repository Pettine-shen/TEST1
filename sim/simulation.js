import { assemblies } from "../configs/assemblies.js";
import { monsters as monsterProtos } from "../configs/monsters.js";
import { dropTables } from "../configs/drops.js";
import { buildEventBusWithAssemblies } from "../engine/runtime.js";
import { createRng, pickChance } from "../engine/rng.js";

const rng = createRng(1234);

function cloneEntity(proto, id, position) {
  return {
    ...JSON.parse(JSON.stringify(proto)),
    id,
    position: position || { x: 0, y: 0 },
    alive: true,
  };
}

function rollDrops(tableName) {
  const rolls = [];
  const table = dropTables[tableName] || [];
  for (const item of table) {
    if (pickChance(rng, item.chance)) rolls.push(item.item);
  }
  return rolls;
}

function processDeaths(world) {
  while (world.pendingDeaths.length) {
    const id = world.pendingDeaths.shift();
    const entity = world.entities[id];
    if (!entity) continue;
    const drops = rollDrops(entity.drops);
    world.drops.push(...drops);
  }
}

function runSimulation() {
  const world = {
    entities: {},
    queue: [],
    pendingDeaths: [],
    skillRuntime: {},
    log: [],
    drops: [],
  };

  // player
  world.entities.player = {
    id: "player",
    kind: "player",
    team: "players",
    hp: 600,
    maxHp: 600,
    atk: 80,
    defense: 5,
    mana: 200,
    ammo: 10,
    position: { x: 0, y: 0 },
    alive: true,
  };

  // spawn initial monsters
  let monsterId = 0;
  function spawn(protoName, pos) {
    const id = `m${monsterId++}`;
    world.entities[id] = cloneEntity(monsterProtos[protoName], id, pos);
    world.entities[id].team = "monsters";
  }
  for (let i = 0; i < 4; i++) spawn("meleeGrunt", { x: 6 + i, y: 0 });
  for (let i = 0; i < 2; i++) spawn("rangedShooter", { x: 10 + i, y: 2 });
  spawn("eliteBrute", { x: 12, y: -1 });

  const playerAssemblies = [assemblies.iceCone, assemblies.counterPulse, assemblies.groundControl, assemblies.meleeBurst];
  const bus = buildEventBusWithAssemblies(playerAssemblies, world);

  const durationMs = 30000;
  const step = 200;
  for (let time = 0; time <= durationMs; time += step) {
    // process scheduled tasks
    world.queue.sort((a, b) => a.at - b.at);
    while (world.queue.length && world.queue[0].at <= time) {
      const task = world.queue.shift();
      task.fn();
    }

    // player casts main skills every 1.5s (faster for MVP validation)
    if (time % 1500 === 0) {
      bus.emit("CastConfirm", { time, casterId: "player", rng: createRng(time) });
    }

    // monsters act
    for (const e of Object.values(world.entities)) {
      if (e.alive === false || e.kind !== "monster") continue;
      const player = world.entities.player;
      const dx = (player.position.x || 0) - (e.position.x || 0);
      const dy = (player.position.y || 0) - (e.position.y || 0);
      const dist = Math.hypot(dx, dy);
      if (dist > e.range) {
        // move closer
        const stepDist = Math.min(e.moveSpeed * (step / 1000), dist);
        const nx = (dx / dist) * stepDist;
        const ny = (dy / dist) * stepDist;
        e.position.x += nx;
        e.position.y += ny;
      } else {
        // attack player (with attack cooldown)
        e.lastAttackTime = e.lastAttackTime ?? -999999;
        const attackCdMs = e.attackCdMs ?? 1000;
        if (time - e.lastAttackTime >= attackCdMs) {
          e.lastAttackTime = time;
          player.hp -= Math.max(0, e.atk - player.defense);
          bus.emit("OnDamaged", { time, casterId: "player", rng: createRng(time + 7) });
        }
      }
    }

    // check deaths & drops
    for (const e of Object.values(world.entities)) {
      if (e.alive !== false && e.hp <= 0) {
        e.alive = false;
        world.pendingDeaths.push(e.id);
      }
    }
    processDeaths(world);

    if (world.entities.player.hp <= 0) {
      console.log("player defeated at", time);
      break;
    }
  }

  console.log("Simulation done.");
  console.log("Remaining monsters:", Object.values(world.entities).filter((e) => e.kind === "monster" && e.alive !== false).length);
  console.log("Drops collected:", world.drops);
  console.log("Player HP:", world.entities.player.hp);
}

runSimulation();
