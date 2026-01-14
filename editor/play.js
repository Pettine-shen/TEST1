import { templates } from "../configs/templates.js";
import { monsters as monsterProtos } from "../configs/monsters.js";
import { dropTables } from "../configs/drops.js";
import { compileAssembly, buildEventBusWithAssemblies } from "../engine/runtime.js";
import { createRng, pickChance } from "../engine/rng.js";

// ---------- UI State ----------
let currentTemplate = templates[0];
let order = currentTemplate.slots.map((s) => s.id);
let slotOptions = Object.fromEntries(currentTemplate.slots.map((s) => [s.id, s.defaultOption]));
let currentAssembly = compileAssembly(currentTemplate, order, slotOptions);

const elTemplate = document.getElementById("templateSelect");
const elSlots = document.getElementById("slots");
const elExport = document.getElementById("exportOut");
const elHp = document.getElementById("hp");
const elMon = document.getElementById("mon");
const elDrops = document.getElementById("drops");
const btnApply = document.getElementById("applyBtn");
const btnReset = document.getElementById("resetBtn");
const btnSpawn = document.getElementById("spawnBtn");
const btnPause = document.getElementById("pauseBtn");

for (const tpl of templates) {
  const opt = document.createElement("option");
  opt.value = tpl.id;
  opt.textContent = `${tpl.id} (${tpl.event})`;
  elTemplate.appendChild(opt);
}
elTemplate.value = currentTemplate.id;

function renderSlots() {
  elSlots.innerHTML = "";
  order.forEach((slotId, idx) => {
    const slot = currentTemplate.slots.find((s) => s.id === slotId);
    const wrap = document.createElement("div");
    wrap.className = "slot";

    const head = document.createElement("div");
    head.className = "slotTitle";
    head.innerHTML = `<div><b>${idx + 1}.</b> ${slot.id} <span class="muted">(${slot.type})</span></div>`;

    const controls = document.createElement("div");
    const up = document.createElement("button");
    up.textContent = "上移";
    up.disabled = idx === 0;
    up.onclick = () => {
      const tmp = order[idx - 1];
      order[idx - 1] = order[idx];
      order[idx] = tmp;
      renderSlots();
    };

    const down = document.createElement("button");
    down.textContent = "下移";
    down.disabled = idx === order.length - 1;
    down.onclick = () => {
      const tmp = order[idx + 1];
      order[idx + 1] = order[idx];
      order[idx] = tmp;
      renderSlots();
    };

    controls.appendChild(up);
    controls.appendChild(down);
    head.appendChild(controls);
    wrap.appendChild(head);

    const row = document.createElement("div");
    row.className = "row";
    const sel = document.createElement("select");
    for (const o of slot.options) {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = `${o.label || o.id}`;
      sel.appendChild(opt);
    }
    sel.value = slotOptions[slotId] || slot.defaultOption;
    sel.onchange = () => {
      slotOptions[slotId] = sel.value;
    };
    row.appendChild(sel);
    wrap.appendChild(row);

    elSlots.appendChild(wrap);
  });
}

function rebuildAssembly() {
  currentAssembly = compileAssembly(currentTemplate, order, slotOptions);
  elExport.textContent = JSON.stringify(
    {
      templateId: currentAssembly.templateId,
      event: currentAssembly.event,
      order: currentAssembly.order,
      slotOptions,
      budgets: currentAssembly.budgets,
      signature: currentAssembly.signature,
    },
    null,
    2
  );
}

elTemplate.onchange = () => {
  currentTemplate = templates.find((t) => t.id === elTemplate.value) || templates[0];
  order = currentTemplate.slots.map((s) => s.id);
  slotOptions = Object.fromEntries(currentTemplate.slots.map((s) => [s.id, s.defaultOption]));
  renderSlots();
  rebuildAssembly();
};

btnReset.onclick = () => {
  order = currentTemplate.slots.map((s) => s.id);
  slotOptions = Object.fromEntries(currentTemplate.slots.map((s) => [s.id, s.defaultOption]));
  renderSlots();
  rebuildAssembly();
};

// ---------- Game / Sim ----------
const canvas = document.getElementById("c");
const ctx2d = canvas.getContext("2d");
const rng = createRng(1234);
let paused = false;

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}
window.addEventListener("resize", resize);
resize();

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

function newWorld() {
  const world = {
    entities: {},
    queue: [],
    pendingDeaths: [],
    skillRuntime: {},
    log: [],
    drops: [],
  };
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

  let monsterId = 0;
  function spawn(protoName, pos) {
    const id = `m${monsterId++}`;
    world.entities[id] = cloneEntity(monsterProtos[protoName], id, pos);
    world.entities[id].team = "monsters";
  }
  for (let i = 0; i < 4; i++) spawn("meleeGrunt", { x: 6 + i, y: 0 });
  for (let i = 0; i < 2; i++) spawn("rangedShooter", { x: 10 + i, y: 2 });
  spawn("eliteBrute", { x: 12, y: -1 });
  return world;
}

let world = newWorld();
let bus = buildEventBusWithAssemblies([currentAssembly], world);
let time = 0;
const step = 100; // ms
const dtSeconds = step / 1000;

// ---------- Player Controller (M1) ----------
const input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, down: false },
};

window.addEventListener("keydown", (e) => input.keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => input.keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  input.mouse.x = e.clientX - r.left;
  input.mouse.y = e.clientY - r.top;
});
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) input.mouse.down = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) input.mouse.down = false;
});

function processDeaths() {
  while (world.pendingDeaths.length) {
    const id = world.pendingDeaths.shift();
    const entity = world.entities[id];
    if (!entity) continue;
    world.drops.push(...rollDrops(entity.drops));
  }
}

function tickOnce() {
  // scheduled tasks
  world.queue.sort((a, b) => a.at - b.at);
  while (world.queue.length && world.queue[0].at <= time) {
    world.queue.shift().fn();
  }

  // player move (WASD)
  const player = world.entities.player;
  if (!player || player.alive === false) {
    time += step;
    return;
  }
  const speed = 5; // world units per second
  let mx = 0;
  let my = 0;
  if (input.keys.has("w")) my -= 1;
  if (input.keys.has("s")) my += 1;
  if (input.keys.has("a")) mx -= 1;
  if (input.keys.has("d")) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.position.x += mx * speed * dtSeconds;
    player.position.y += my * speed * dtSeconds;
  }

  // aim dir from mouse (for future indicators / projectile travel)
  const aimWorld = screenToWorld(input.mouse.x, input.mouse.y);
  const ax = aimWorld.x - player.position.x;
  const ay = aimWorld.y - player.position.y;
  const alen = Math.hypot(ax, ay) || 1;
  player.aimDir = { x: ax / alen, y: ay / alen };

  // manual cast on left mouse down, with simple rate limit
  player.lastCastTime = player.lastCastTime ?? -999999;
  const castCdMs = 200; // spam guard for MVP
  if (input.mouse.down && time - player.lastCastTime >= castCdMs) {
    player.lastCastTime = time;
    bus.emit("CastConfirm", { time, casterId: "player", rng: createRng(time), aimDir: player.aimDir });
  }

  // if player is dead, stop combat progression (but still let input update above)
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    time += step;
    return;
  }

  // monsters act with attack cooldown
  for (const e of Object.values(world.entities)) {
    if (e.alive === false || e.kind !== "monster") continue;
    const player = world.entities.player;
    const dx = (player.position.x || 0) - (e.position.x || 0);
    const dy = (player.position.y || 0) - (e.position.y || 0);
    const dist = Math.hypot(dx, dy);
    if (dist > e.range) {
      const stepDist = Math.min(e.moveSpeed * (step / 1000), dist);
      const nx = (dx / dist) * stepDist;
      const ny = (dy / dist) * stepDist;
      e.position.x += nx;
      e.position.y += ny;
    } else {
      e.lastAttackTime = e.lastAttackTime ?? -999999;
      const attackCdMs = e.attackCdMs ?? 1000;
      if (time - e.lastAttackTime >= attackCdMs) {
        e.lastAttackTime = time;
        player.hp -= Math.max(0, e.atk - player.defense);
        bus.emit("OnDamaged", { time, casterId: "player", rng: createRng(time + 7) });
      }
    }
  }

  for (const e of Object.values(world.entities)) {
    if (e.alive !== false && e.hp <= 0) {
      e.alive = false;
      world.pendingDeaths.push(e.id);
    }
  }
  processDeaths();
  time += step;
}

function worldToScreen(p) {
  // simple 2D transform: world units -> pixels
  const scale = 45;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return { x: cx + p.x * scale, y: cy + p.y * scale };
}

function screenToWorld(px, py) {
  const scale = 45;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return { x: (px * devicePixelRatio - cx) / scale, y: (py * devicePixelRatio - cy) / scale };
}

function draw() {
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  // draw entities
  for (const e of Object.values(world.entities)) {
    if (e.alive === false) continue;
    const p = worldToScreen(e.position || { x: 0, y: 0 });
    const r = e.kind === "player" ? 12 : e.id.includes("elite") ? 14 : 10;
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, r * devicePixelRatio, 0, Math.PI * 2);
    ctx2d.fillStyle = e.kind === "player" ? "#3ce7ff" : "#ff5a7a";
    ctx2d.fill();

    // hp bar for monsters
    if (e.kind === "monster") {
      const w = 40 * devicePixelRatio;
      const h = 6 * devicePixelRatio;
      const hpPct = Math.max(0, Math.min(1, (e.hp || 0) / (e.maxHp || e.hp || 1)));
      ctx2d.fillStyle = "rgba(255,255,255,0.15)";
      ctx2d.fillRect(p.x - w / 2, p.y - 22 * devicePixelRatio, w, h);
      ctx2d.fillStyle = "#7bff8a";
      ctx2d.fillRect(p.x - w / 2, p.y - 22 * devicePixelRatio, w * hpPct, h);
    }
  }

  // draw aim line (minimal feedback)
  const player = world.entities.player;
  if (player?.alive !== false) {
    const p = worldToScreen(player.position || { x: 0, y: 0 });
    const end = {
      x: p.x + (player.aimDir?.x || 1) * 80 * devicePixelRatio,
      y: p.y + (player.aimDir?.y || 0) * 80 * devicePixelRatio,
    };
    ctx2d.strokeStyle = "rgba(60,231,255,0.55)";
    ctx2d.lineWidth = 2 * devicePixelRatio;
    ctx2d.beginPath();
    ctx2d.moveTo(p.x, p.y);
    ctx2d.lineTo(end.x, end.y);
    ctx2d.stroke();
  }
}

function updateHud() {
  const player = world.entities.player;
  const aliveMonsters = Object.values(world.entities).filter((e) => e.kind === "monster" && e.alive !== false);
  elHp.textContent = Math.max(0, Math.floor(player.hp));
  elMon.textContent = String(aliveMonsters.length);
  elDrops.textContent = world.drops.length ? world.drops.slice(0, 6).join(", ") + (world.drops.length > 6 ? "..." : "") : "(空)";
}

function loop() {
  if (!paused) {
    // Always tick (movement/aim), combat logic is gated inside tickOnce.
    // Run a few sim steps per frame for smoothness.
    for (let i = 0; i < 2; i++) tickOnce();
  }
  draw();
  updateHud();
  requestAnimationFrame(loop);
}

btnApply.onclick = () => {
  rebuildAssembly();
  // apply to combat
  bus = buildEventBusWithAssemblies([currentAssembly], world);
};

btnSpawn.onclick = () => {
  world = newWorld();
  time = 0;
  bus = buildEventBusWithAssemblies([currentAssembly], world);
};

btnPause.onclick = () => {
  paused = !paused;
  btnPause.textContent = paused ? "继续" : "暂停";
};

renderSlots();
rebuildAssembly();
loop();

