import { templates } from "../configs/templates.js";
import { monsters as monsterProtos } from "../configs/monsters.js";
import { dropTables } from "../configs/drops.js";
import { compileAssembly, buildEventBusWithAssemblies } from "../engine/runtime.js";
import { createRng, pickChance } from "../engine/rng.js";
import { generateSkillDescription, generateFullSkillDescription } from "../engine/skillDescription.js";
import { generateRandomWeapon } from "../engine/randomWeapon.js";
import { applyDamage, applyDebuff } from "../engine/ops.js";
import { SKILL_PERSONALITIES } from "../configs/skillPersonalities.js";

// ---------- UI State ----------
let currentTemplate = templates[0];
let order = currentTemplate.slots.map((s) => s.id);
let slotOptions = Object.fromEntries(currentTemplate.slots.map((s) => [s.id, s.defaultOption]));
let currentAssembly = compileAssembly(currentTemplate, order, slotOptions);

const elTemplate = document.getElementById("templateSelect");
const elSlots = document.getElementById("slots");
const elExport = document.getElementById("exportOut");
const elHp = document.getElementById("hp");
const elMaxHp = document.getElementById("maxHp");
const elMana = document.getElementById("mana");
const elMaxMana = document.getElementById("maxMana");
const elPlayerState = document.getElementById("playerState");
const elMon = document.getElementById("mon");
const elDrops = document.getElementById("drops");
const elPreviewSummary = document.getElementById("previewSummary");
const elBudgetDisplay = document.getElementById("budgetDisplay");
const elSkillDescription = document.getElementById("skillDescription");
const elArtifactName = document.getElementById("artifactName");
const elArtifactCultivation = document.getElementById("artifactCultivation");
const elEcaVisualization = document.getElementById("ecaVisualization");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas ? previewCanvas.getContext("2d") : null;
const btnApply = document.getElementById("applyBtn");
const btnReset = document.getElementById("resetBtn");
const btnSpawn = document.getElementById("spawnBtn");
const btnRandomWeapon = document.getElementById("randomWeaponBtn");
const btnPause = document.getElementById("pauseBtn");

// 当前武器是否为随机生成
let isRandomWeapon = false;

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
    wrap.draggable = true;
    wrap.dataset.index = idx;
    wrap.dataset.slotId = slotId;

    // Drag handlers
    wrap.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", idx.toString());
      wrap.style.opacity = "0.5";
    });
    wrap.addEventListener("dragend", (e) => {
      wrap.style.opacity = "1";
    });
    wrap.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const afterElement = getDragAfterElement(elSlots, e.clientY);
      if (afterElement == null) {
        elSlots.appendChild(wrap);
      } else {
        elSlots.insertBefore(wrap, afterElement);
      }
    });
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
      const toIndex = idx;
      if (fromIndex !== toIndex) {
        const [removed] = order.splice(fromIndex, 1);
        order.splice(toIndex, 0, removed);
        renderSlots();
        rebuildAssembly();
      }
    });

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
      rebuildAssembly();
    };

    const down = document.createElement("button");
    down.textContent = "下移";
    down.disabled = idx === order.length - 1;
    down.onclick = () => {
      const tmp = order[idx + 1];
      order[idx + 1] = order[idx];
      order[idx] = tmp;
      renderSlots();
      rebuildAssembly();
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
      rebuildAssembly();
    };
    row.appendChild(sel);
    wrap.appendChild(row);

    elSlots.appendChild(wrap);
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".slot:not(.dragging)")];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
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
      description: generateSkillDescription(currentTemplate, order, slotOptions),
      isRandom: isRandomWeapon,
    },
    null,
    2
  );
  updatePreview();
  updateBudgetDisplay();
  updateSkillDescription();
  updateEcaVisualization();
}

function updatePreview() {
  if (!elPreviewSummary) return;
  if (!currentAssembly || !currentAssembly.presentation) {
    elPreviewSummary.textContent = "(选择模板后显示)";
    return;
  }
  
  const pres = currentAssembly.presentation;
  const windupMs = pres.windupMs || 200;
  const recoveryMs = pres.recoveryMs || 300;
  const projSpeed = pres.projectileSpeed || 12;
  const speedLabel = projSpeed >= 16 ? "快" : projSpeed >= 10 ? "中" : "慢";
  const shapeLabel = pres.indicatorShape === "line" ? "直线" : 
                     pres.indicatorShape === "cone" ? "扇形" :
                     pres.indicatorShape === "circle" ? "圆形" :
                     pres.indicatorShape === "dash" ? "突进" : "未知";
  
  elPreviewSummary.innerHTML = `
    <div style="font-size:12px; line-height:1.6;">
      <div>前摇: <b>${windupMs}ms</b></div>
      <div>后摇: <b>${recoveryMs}ms</b></div>
      <div>弹速: <b>${speedLabel}</b> (${projSpeed})</div>
      <div>指示器: <b>${shapeLabel}</b></div>
    </div>
  `;
  
  // Draw indicator preview
  if (!previewCanvas || !previewCtx) return;
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const centerX = previewCanvas.width / 2;
  const centerY = previewCanvas.height / 2;
  const scale = 3;
  
  previewCtx.save();
  previewCtx.globalAlpha = 0.4;
  previewCtx.strokeStyle = "#3ce7ff";
  previewCtx.fillStyle = "rgba(60,231,255,0.15)";
  previewCtx.lineWidth = 2;
  
  if (pres.indicatorShape === "line") {
    const range = (pres.indicatorSize.range || 12) * scale;
    previewCtx.beginPath();
    previewCtx.moveTo(centerX, centerY);
    previewCtx.lineTo(centerX + range, centerY);
    previewCtx.stroke();
    previewCtx.beginPath();
    previewCtx.arc(centerX + range, centerY, 3, 0, Math.PI * 2);
    previewCtx.fill();
  } else if (pres.indicatorShape === "cone") {
    const range = (pres.indicatorSize.range || 10) * scale;
    const angle = (pres.indicatorSize.angle || 60) * (Math.PI / 180);
    const halfAngle = angle / 2;
    previewCtx.beginPath();
    previewCtx.moveTo(centerX, centerY);
    previewCtx.arc(centerX, centerY, range, -halfAngle, halfAngle);
    previewCtx.closePath();
    previewCtx.fill();
    previewCtx.stroke();
  } else if (pres.indicatorShape === "circle") {
    const radius = (pres.indicatorSize.radius || 3) * scale;
    previewCtx.beginPath();
    previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    previewCtx.fill();
    previewCtx.stroke();
  } else if (pres.indicatorShape === "dash") {
    const distance = (pres.indicatorSize.distance || 5) * scale;
    previewCtx.beginPath();
    previewCtx.moveTo(centerX, centerY);
    previewCtx.lineTo(centerX + distance, centerY);
    previewCtx.stroke();
    previewCtx.beginPath();
    previewCtx.arc(centerX + distance, centerY, 4, 0, Math.PI * 2);
    previewCtx.fill();
  }
  
  // Draw player position marker
  previewCtx.globalAlpha = 1.0;
  previewCtx.fillStyle = "#3ce7ff";
  previewCtx.beginPath();
  previewCtx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  previewCtx.fill();
  
  previewCtx.restore();
}

function updateBudgetDisplay() {
  if (!elBudgetDisplay) return;
  if (!currentAssembly || !currentAssembly.budgets || !currentTemplate) {
    elBudgetDisplay.innerHTML = "";
    return;
  }
  
  const budgets = currentAssembly.budgets;
  const caps = currentTemplate.budgetCap || {};
  const keys = ["damage", "cc", "mobility", "proc", "perf"];
  const labels = { damage: "伤害", cc: "控制", mobility: "机动", proc: "触发", perf: "性能" };
  
  let html = '<div style="font-size:12px;">';
  for (const key of keys) {
    const value = budgets[key] || 0;
    const cap = caps[key] || 100;
    const pct = Math.min(100, (value / cap) * 100);
    const isOver = value > cap;
    const color = isOver ? "#ff5a7a" : pct > 80 ? "#ffaa00" : "#7bff8a";
    
    html += `
      <div style="margin:4px 0;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>${labels[key] || key}:</span>
          <span style="color:${color}"><b>${Math.floor(value)}/${cap}</b></span>
        </div>
        <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden;">
          <div style="background:${color}; height:100%; width:${Math.min(100, pct)}%; transition:width 0.3s;"></div>
        </div>
      </div>
    `;
  }
  html += '</div>';
  elBudgetDisplay.innerHTML = html;
}

function updateSkillDescription() {
  if (!elSkillDescription) return;
  if (!currentTemplate || !order || !slotOptions) {
    elSkillDescription.textContent = "未知技能";
    if (elArtifactName) elArtifactName.textContent = "(未知)";
    if (elArtifactCultivation) elArtifactCultivation.textContent = "(未知)";
    return;
  }
  
  try {
    const description = generateSkillDescription(currentTemplate, order, slotOptions);
    elSkillDescription.textContent = description;
    elSkillDescription.style.color = isRandomWeapon ? "#ffaa00" : "#e8ecff";
    
    // 生成修仙风格的描述
    if (elArtifactName && elArtifactCultivation) {
      try {
        const fullDesc = generateFullSkillDescription(currentTemplate, order, slotOptions);
        elArtifactName.textContent = fullDesc.artifactName;
        elArtifactCultivation.textContent = fullDesc.cultivation;
      } catch (e) {
        console.warn("Failed to generate cultivation description:", e);
        if (elArtifactName) elArtifactName.textContent = "未知法器";
        if (elArtifactCultivation) elArtifactCultivation.textContent = "此物功效未知。";
      }
    }
  } catch (e) {
    console.warn("Failed to generate skill description:", e);
    elSkillDescription.textContent = "技能描述生成失败";
    if (elArtifactName) elArtifactName.textContent = "未知法器";
    if (elArtifactCultivation) elArtifactCultivation.textContent = "此物功效未知。";
  }
}

function updateEcaVisualization() {
  if (!elEcaVisualization) return;
  if (!currentTemplate || !order || !slotOptions) {
    elEcaVisualization.innerHTML = "";
    return;
  }
  
  const orderedSlots = order.map((slotId) => {
    const slot = currentTemplate.slots.find((s) => s.id === slotId);
    const optionId = slotOptions[slotId] || slot?.defaultOption;
    const option = slot?.options.find((o) => o.id === optionId);
    return { slot, option, slotId };
  });
  
  const typeLabels = { Condition: "C", Target: "T", Action: "A", Timeline: "TL" };
  const typeColors = { Condition: "#7bff8a", Target: "#3ce7ff", Action: "#ffaa00", Timeline: "#ff5a7a" };
  
  let html = '<div style="font-size:12px; line-height:1.8;">';
  html += '<div style="margin-bottom:8px; font-weight:bold; color:#e8ecff;">ECA 拼装：</div>';
  
  // 模块链可视化
  html += '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">';
  orderedSlots.forEach((item, idx) => {
    const type = item.slot?.type || "?";
    const typeLabel = typeLabels[type] || "?";
    const color = typeColors[type] || "#888";
    html += `
      <div style="display:flex; align-items:center; gap:4px;">
        <div style="background:${color}; color:#0b1020; width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:11px;">
          ${typeLabel}${idx + 1}
        </div>
        ${idx < orderedSlots.length - 1 ? '<span style="color:#666;">→</span>' : ''}
      </div>
    `;
  });
  html += '</div>';
  
  // 详细列表
  html += '<div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">';
  orderedSlots.forEach((item, idx) => {
    const type = item.slot?.type || "?";
    const optionLabel = item.option?.label || item.option?.id || "未知";
    const color = typeColors[type] || "#888";
    html += `
      <div style="margin:4px 0; font-size:11px; color:#ccc;">
        <span style="color:${color}; font-weight:bold;">${idx + 1}.</span>
        <span style="color:#888;">${type}:</span>
        <span>${optionLabel}</span>
      </div>
    `;
  });
  html += '</div>';
  
  html += '</div>';
  elEcaVisualization.innerHTML = html;
}

elTemplate.onchange = () => {
  currentTemplate = templates.find((t) => t.id === elTemplate.value) || templates[0];
  order = currentTemplate.slots.map((s) => s.id);
  slotOptions = Object.fromEntries(currentTemplate.slots.map((s) => [s.id, s.defaultOption]));
  isRandomWeapon = false; // 手动选择模板时，不再是随机武器
  renderSlots();
  rebuildAssembly();
};

btnReset.onclick = () => {
  order = currentTemplate.slots.map((s) => s.id);
  slotOptions = Object.fromEntries(currentTemplate.slots.map((s) => [s.id, s.defaultOption]));
  isRandomWeapon = false; // 重置为默认时，不再是随机武器
  renderSlots();
  rebuildAssembly();
};

// ---------- Player State Machine (M1.5) ----------
// Define PlayerState BEFORE newWorld() uses it
const PlayerState = {
  Idle: "Idle",
  Move: "Move",
  CastWindup: "CastWindup",
  CastRelease: "CastRelease",
  CastRecovery: "CastRecovery",
  Dash: "Dash", // 突进状态
  Roll: "Roll",
  Hitstun: "Hitstun",
  Death: "Death",
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
    projectiles: [],
    areaEffects: [], // Persistent area effects (DoT zones)
    hitEffects: [], // For visual feedback
    chainEffects: [], // Chain damage visual effects
    deathAnimations: [], // For death animations
    decorations: [], // Background decorations (rocks, grass, flowers)
  };
  
  // 装饰元素改为程序化生成，不再预生成
  // 装饰元素会在渲染时根据玩家位置动态生成
  world.entities.player = {
    id: "player",
    kind: "player",
    team: "players",
    hp: 2000, // Increased for survivability (need 10+ hits to die)
    maxHp: 2000,
    atk: 80,
    defense: 5,
    mana: 200,
    maxMana: 200,
    ammo: 10,
    position: { x: 0, y: 0 },
    alive: true,
    state: PlayerState.Idle,
    stateTime: 0,
    rollCooldown: 0,
    rollState: null, // 翻滚状态
    castWindupEnd: 0,
    castRecoveryEnd: 0,
    invulnerableUntil: 0,
  };

  let monsterId = 0;
  function spawn(protoName, pos) {
    const id = `m${monsterId++}`;
    world.entities[id] = cloneEntity(monsterProtos[protoName], id, pos);
    world.entities[id].team = "monsters";
    world.entities[id].protoName = protoName; // Save for visual rendering
  }
  for (let i = 0; i < 4; i++) spawn("meleeGrunt", { x: 6 + i, y: 0 });
  for (let i = 0; i < 2; i++) spawn("rangedShooter", { x: 10 + i, y: 2 });
  spawn("eliteBrute", { x: 12, y: -1 });
  return world;
}

let world = newWorld();
// Presentation event bus (for visual feedback)
world.presentationBus = new (class {
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
})();
// Initialize bus with current assembly + counter template for OnDamaged
let allAssemblies = [currentAssembly];
const counterTemplate = templates.find((t) => t.id === "tpl_counter_v1");
if (counterTemplate) {
  const counterAssembly = compileAssembly(counterTemplate, counterTemplate.slots.map((s) => s.id), Object.fromEntries(counterTemplate.slots.map((s) => [s.id, s.defaultOption])));
  allAssemblies.push(counterAssembly);
}
let bus = buildEventBusWithAssemblies(allAssemblies, world);
let time = 0;
const step = 100; // ms
const dtSeconds = step / 1000;

// Debug: log initial world state
console.log("=== GAME INIT ===");
console.log("Initial world:", world);
console.log("Player:", world.entities.player);
console.log("Player position:", world.entities.player?.position);
console.log("Player alive:", world.entities.player?.alive);
console.log("Entities count:", Object.keys(world.entities).length);

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
  if (e.button === 0) {
    input.mouse.down = true;
    console.log("Mouse down detected at", time);
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    input.mouse.down = false;
    console.log("Mouse up detected at", time);
  }
});

function processDeaths() {
  const player = world.entities.player;
  while (world.pendingDeaths.length) {
    const id = world.pendingDeaths.shift();
    const entity = world.entities[id];
    if (!entity) continue;
    world.drops.push(...rollDrops(entity.drops));
    
    // Check for ChainTrigger: onKill event
    if (player && player.chainTriggers && player.chainTriggers.length > 0) {
      for (const trigger of player.chainTriggers) {
        if (trigger.triggerEvent === "onKill" && 
            (trigger.maxTriggers < 0 || trigger.triggerCount < trigger.maxTriggers) &&
            (trigger.cooldown === 0 || time - trigger.lastTriggerTime >= trigger.cooldown)) {
          
          // Check trigger chance
          if (Math.random() < trigger.triggerChance) {
            // Execute triggered action
            const triggeredAction = trigger.triggeredAction;
            if (triggeredAction) {
              // Create a new context for the triggered action
              const triggerCtx = {
                casterId: player.id,
                targets: [],
                time: time,
                aimDir: player.aimDir || { x: 1, y: 0 },
                assembly: trigger.assembly,
              };
              
              // Execute triggered action (simplified: spawn projectile)
              if (triggeredAction.kind === "SpawnProjectile") {
                world.projectiles = world.projectiles || [];
                const triggerProjId = `proj_trigger_kill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const triggerProj = {
                  id: triggerProjId,
                  position: entity.position ? { x: entity.position.x, y: entity.position.y } : player.position,
                  velocity: triggerCtx.aimDir,
                  speed: (triggeredAction.presentation?.projectileSpeed || 12) / 3,
                  radius: 0.3,
                  damage: triggeredAction.formula || { scale: 0.5, flat: 15 },
                  casterId: player.id,
                  createdAt: time,
                  targets: [],
                  assembly: trigger.assembly,
                };
                world.projectiles.push(triggerProj);
                console.log(`ChainTrigger (onKill) activated: spawned projectile from kill`);
              }
              
              trigger.triggerCount++;
              trigger.lastTriggerTime = time;
            }
          }
        }
      }
    }
  }
}

function applyProjectileDamage(world, targets, caster, formula, hitPos) {
  const currentTime = world.time || time;
  for (const t of targets) {
    const atk = caster.atk || 0;
    const raw = atk * (formula.scale || 0) + (formula.flat || 0);
    const mitigated = Math.max(0, raw - (t.defense || 0));
    const prevHp = t.hp || 0;
    t.hp = prevHp - mitigated;
    world.log?.push?.({ type: "damage", target: t.id, value: mitigated });
    
    // Add hit effect at target position (not projectile position)
    const effectPos = t.position || hitPos;
    world.hitEffects = world.hitEffects || [];
    world.hitEffects.push({
      position: { x: effectPos.x, y: effectPos.y },
      damage: mitigated,
      createdAt: currentTime,
      duration: 800,
    });
    
    // Trigger hit flash on monster
    if (t.kind === "monster") {
      t.hitFlashUntil = currentTime + 100;
    }
    
    // Emit hit confirmed event
    if (world.presentationBus) {
      world.presentationBus.emit("OnHitConfirmed", { time: currentTime, targetId: t.id, damage: mitigated, position: effectPos });
    }
    
    if (t.hp <= 0) {
      t.alive = false;
      t.hp = 0;
      world.pendingDeaths.push(t.id);
    }
  }
}

function checkCastConditions(player, assembly) {
  // Check mana/resources (simplified: check first Condition op)
  // Note: This is a pre-check, actual conditions are checked in executeOps
  for (const op of assembly.ops) {
    if (op.type === "Condition" && op.kind === "HasResource") {
      const resource = op.resource || "mana";
      const amount = op.amount || 0;
      if ((player[resource] || 0) < amount) {
        return { ok: false, reason: `资源不足: ${resource} < ${amount}` };
      }
    }
  }
  // Always allow cast attempt - let executeOps handle condition checks
  return { ok: true };
}

let castFailHintTimeout = 0;
function showCastFailHint(reason) {
  const hintEl = document.getElementById("castFailHint");
  if (hintEl) {
    hintEl.textContent = reason;
    hintEl.style.opacity = "1";
    clearTimeout(castFailHintTimeout);
    castFailHintTimeout = setTimeout(() => {
      hintEl.style.opacity = "0";
    }, 2000);
  }
}

function updatePlayerState(player, dtMs) {
  if (!player || player.alive === false) {
    if (player) player.state = PlayerState.Death;
    return;
  }

  // 注意：stateTime 需要在状态检查之前更新，但 windupEnd 等时间戳是基于 time 的
  const prevStateTime = player.stateTime || 0;
  player.stateTime += dtMs;
  player.rollCooldown = Math.max(0, player.rollCooldown - dtMs);
  player.invulnerableUntil = Math.max(0, player.invulnerableUntil - dtMs);

  // Mana auto regen (参考 Noita)
  if (player.mana < player.maxMana) {
    player.mana = Math.min(player.maxMana, player.mana + (10 * dtMs) / 1000);
  }

  // State transitions
  if (player.state === PlayerState.Death) return;

  // Roll input (Space) - disabled during dash, cast, and other states
  if (input.keys.has(" ") && player.rollCooldown <= 0 && 
      player.state !== PlayerState.Roll && 
      player.state !== PlayerState.Dash &&
      player.state !== PlayerState.CastWindup &&
      player.state !== PlayerState.CastRelease &&
      player.state !== PlayerState.CastRecovery &&
      player.state !== PlayerState.Hitstun) {
    player.state = PlayerState.Roll;
    player.stateTime = 0;
    player.rollCooldown = 1000; // 1s cooldown
    player.invulnerableUntil = time + 300; // 0.3s invulnerable
    
    // 初始化翻滚状态：根据移动方向或鼠标方向决定翻滚方向
    const moveDir = { x: 0, y: 0 };
    if (input.keys.has("w") || input.keys.has("W")) moveDir.y -= 1;
    if (input.keys.has("s") || input.keys.has("S")) moveDir.y += 1;
    if (input.keys.has("a") || input.keys.has("A")) moveDir.x -= 1;
    if (input.keys.has("d") || input.keys.has("D")) moveDir.x += 1;
    
    // 如果有移动输入，使用移动方向；否则使用鼠标方向
    const rollDist = 3; // 翻滚距离
    const rollDuration = 200; // 翻滚持续时间
    let rollDir = { x: 0, y: 0 };
    
    if (Math.abs(moveDir.x) > 0 || Math.abs(moveDir.y) > 0) {
      const moveLen = Math.hypot(moveDir.x, moveDir.y) || 1;
      rollDir = { x: moveDir.x / moveLen, y: moveDir.y / moveLen };
    } else if (player.aimDir) {
      rollDir = { x: player.aimDir.x, y: player.aimDir.y };
    } else {
      rollDir = { x: 0, y: -1 }; // 默认向上翻滚
    }
    
    player.rollState = {
      active: true,
      direction: rollDir,
      distance: rollDist,
      duration: rollDuration,
      speed: rollDist / (rollDuration / 1000), // 速度 = 距离 / 时间
      startPos: { x: player.position.x, y: player.position.y },
      targetPos: {
        x: player.position.x + rollDir.x * rollDist,
        y: player.position.y + rollDir.y * rollDist
      }
    };
  }

  // Roll duration and movement
  if (player.state === PlayerState.Roll && player.rollState && player.rollState.active) {
    const roll = player.rollState;
    const progress = Math.min(1, player.stateTime / roll.duration);
    
    // 计算当前位置（平滑移动）
    const currentX = roll.startPos.x + roll.direction.x * roll.distance * progress;
    const currentY = roll.startPos.y + roll.direction.y * roll.distance * progress;
    player.position.x = currentX;
    player.position.y = currentY;
    
    // 翻滚结束
    if (player.stateTime >= roll.duration) {
      player.position.x = roll.targetPos.x;
      player.position.y = roll.targetPos.y;
      player.state = PlayerState.Idle;
      player.stateTime = 0;
      player.rollState = null;
    }
  } else if (player.state === PlayerState.Roll && !player.rollState) {
    // 如果没有rollState，直接结束（兜底）
    player.state = PlayerState.Idle;
    player.stateTime = 0;
  }

  // Check if current skill has Charge action (declare once at the start)
  const hasChargeAction = currentAssembly?.ops?.some(op => op.kind === "Charge");
  
  // Cast windup -> release -> recovery (only for non-charge skills)
  if (!hasChargeAction && player.state === PlayerState.CastWindup && player.castWindupEnd && time >= player.castWindupEnd) {
    player.state = PlayerState.CastRelease;
    player.stateTime = 0;
    player.castRecoveryEnd = time + (currentAssembly.presentation?.recoveryMs || 300);
    console.log("CastWindup -> CastRelease at time", time);
  }
  
  // For charge skills, max charge time reached - auto release
  if (hasChargeAction && player.state === PlayerState.CastWindup && player.castWindupEnd && time >= player.castWindupEnd) {
    const chargeTime = Math.min(time - player.chargeStartTime, player.maxChargeTime || 2000);
    console.log("Max charge reached, auto releasing at time", time, "chargeTime:", chargeTime);
    player.chargeTime = chargeTime;
    player.state = PlayerState.CastRelease;
    player.stateTime = 0;
    player.castRecoveryEnd = time + (currentAssembly.presentation?.recoveryMs || 300);
  }
  // Note: CastRelease state is handled in tickOnce() to trigger CastConfirm event
  // Don't immediately transition to CastRecovery here
  if (player.state === PlayerState.CastRecovery && time >= player.castRecoveryEnd) {
    player.state = PlayerState.Idle;
    player.stateTime = 0;
  }

  // Hitstun duration (0.1s)
  if (player.state === PlayerState.Hitstun && player.stateTime >= 100) {
    player.state = PlayerState.Idle;
    player.stateTime = 0;
  }
  
  // Cast input handling: different logic for Charge vs normal skills
  if (hasChargeAction) {
    // Charge skill: start charging on mouse down, release on mouse up
    if (
      input.mouse.down &&
      !player._mouseWasDown && // Edge detection: was not down before
      player.state !== PlayerState.CastRecovery &&
      player.state !== PlayerState.CastWindup &&
      player.state !== PlayerState.Roll &&
      player.state !== PlayerState.Dash &&
      player.state !== PlayerState.Hitstun
    ) {
      // Start charging
      console.log("Starting charge at time", time);
      player.state = PlayerState.CastWindup; // Use CastWindup state for charging
      player.stateTime = 0;
      player.chargeStartTime = time;
      // Find Charge action to get maxChargeTime
      const chargeOp = currentAssembly.ops.find(op => op.kind === "Charge");
      player.maxChargeTime = chargeOp?.maxChargeTime || 2000;
      player.castWindupEnd = time + player.maxChargeTime; // Use this to track max charge time
      // Emit charge start event
      if (world.presentationBus) {
        world.presentationBus.emit("OnCastWindupStart", { time, casterId: "player", assembly: currentAssembly });
      }
    }
    
    // Release charge on mouse up
    if (
      !input.mouse.down &&
      player._mouseWasDown && // Was down before
      player.state === PlayerState.CastWindup &&
      player.chargeStartTime !== undefined
    ) {
      // Calculate charge time
      const chargeTime = Math.min(time - player.chargeStartTime, player.maxChargeTime || 2000);
      console.log("Releasing charge at time", time, "chargeTime:", chargeTime);
      player.chargeTime = chargeTime; // Store charge time for skill execution
      player.state = PlayerState.CastRelease;
      player.stateTime = 0;
      player.castRecoveryEnd = time + (currentAssembly.presentation?.recoveryMs || 300);
    }
    
    // Update charge progress while charging
    if (player.state === PlayerState.CastWindup && player.chargeStartTime !== undefined) {
      const chargeTime = Math.min(time - player.chargeStartTime, player.maxChargeTime || 2000);
      player.chargeProgress = chargeTime / (player.maxChargeTime || 2000); // 0 to 1
    }
  } else {
    // Normal skill: use edge detection on mouse down
    if (
      input.mouse.down &&
      !player._mouseWasDown && // Edge detection: was not down before
      player.state !== PlayerState.CastRecovery &&
      player.state !== PlayerState.CastWindup &&
      player.state !== PlayerState.Roll &&
      player.state !== PlayerState.Dash && // Cannot cast during dash
      player.state !== PlayerState.Hitstun
    ) {
      console.log("Starting cast windup at time", time);
      const windupMs = currentAssembly.presentation?.windupMs || 200;
      player.state = PlayerState.CastWindup;
      player.stateTime = 0;
      player.castWindupEnd = time + windupMs;
      // Emit windup start event (for indicators)
      if (world.presentationBus) {
        world.presentationBus.emit("OnCastWindupStart", { time, casterId: "player", assembly: currentAssembly });
      }
    }
  }
  
  // Track mouse state for edge detection
  player._mouseWasDown = input.mouse.down;
}

function tickOnce() {
  // Set world.time for use by damage functions
  world.time = time;
  
  // scheduled tasks
  world.queue.sort((a, b) => a.at - b.at);
  while (world.queue.length && world.queue[0].at <= time) {
    world.queue.shift().fn();
  }

  const player = world.entities.player;
  if (!player || player.alive === false) {
    time += step;
    return;
  }

  // Update dash state (if active)
  if (player.dashState && player.dashState.active) {
    const dash = player.dashState;
    const dashMove = dash.speed * dtSeconds;
    
    if (dash.remainingDistance > 0) {
      // Move player along dash direction
      const moveDist = Math.min(dashMove, dash.remainingDistance);
      player.position.x += dash.direction.x * moveDist;
      player.position.y += dash.direction.y * moveDist;
      dash.remainingDistance -= moveDist;
      
      // Add trail point periodically
      const trailInterval = 50; // ms
      if (time - (dash.trail[dash.trail.length - 1]?.time || dash.startTime) >= trailInterval) {
        dash.trail.push({
          x: player.position.x,
          y: player.position.y,
          time: time,
        });
        // Keep only recent trail points (last 200ms)
        const maxTrailAge = 200;
        dash.trail = dash.trail.filter((p) => time - p.time <= maxTrailAge);
      }
      
      // Set player state to Dash
      if (player.state !== PlayerState.Dash) {
        player.state = PlayerState.Dash;
        player.stateTime = 0;
      }
    } else {
      // Dash complete
      dash.active = false;
      player.dashState = null;
      if (player.state === PlayerState.Dash) {
        player.state = PlayerState.Idle;
        player.stateTime = 0;
      }
    }
  }
  
  // Update jump state (if active)
  if (player.jumpState && player.jumpState.active) {
    const jump = player.jumpState;
    const elapsed = time - jump.startTime;
    const progress = Math.min(elapsed / jump.duration, 1);
    
    if (progress < 1) {
      // Parabolic interpolation
      const t = progress;
      const x = jump.startPos.x + (jump.targetPos.x - jump.startPos.x) * t;
      const y = jump.startPos.y + (jump.targetPos.y - jump.startPos.y) * t;
      const height = jump.height * (4 * t * (1 - t)); // Parabolic arc
      
      player.position.x = x;
      player.position.y = y - height; // Subtract height to go up
      
      // Set player state to Dash (reuse for jump)
      if (player.state !== PlayerState.Dash) {
        player.state = PlayerState.Dash;
        player.stateTime = 0;
      }
    } else {
      // Jump complete - land
      player.position.x = jump.targetPos.x;
      player.position.y = jump.targetPos.y;
      
      // Apply landing damage if specified
      if (jump.landDamage) {
        const enemies = Object.values(world.entities).filter((e) => {
          if (e.alive === false || e.kind !== "monster") return false;
          if (!e.position) return false;
          const dist = Math.hypot(
            e.position.x - player.position.x,
            e.position.y - player.position.y
          );
          return dist <= 2; // Landing radius
        });
        
        if (enemies.length > 0) {
          applyDamage(world, enemies, player, jump.landDamage);
        }
      }
      
      // Visual feedback for landing
      world.hitEffects = world.hitEffects || [];
      world.hitEffects.push({
        position: { x: jump.targetPos.x, y: jump.targetPos.y },
        damage: 0,
        createdAt: time,
        duration: 300,
        type: "jumpLand",
      });
      
      jump.active = false;
      player.jumpState = null;
      if (player.state === PlayerState.Dash) {
        player.state = PlayerState.Idle;
        player.stateTime = 0;
      }
    }
  }

  // Update player state machine
  updatePlayerState(player, step);

  // Player movement (WASD) - disabled during dash, jump, roll, and cast states
  // 前摇、释放、后摇期间完全禁止移动
  if ((!player.dashState || !player.dashState.active) && 
      (!player.jumpState || !player.jumpState.active) &&
      player.state !== PlayerState.Roll &&
      player.state !== PlayerState.CastWindup &&
      player.state !== PlayerState.CastRelease &&
      player.state !== PlayerState.CastRecovery) {
    const baseSpeed = 1.67; // world units per second (reduced from 5 to ~1/3)
    let speedMultiplier = 1.0;
    
    // Apply debuffs
    if (player.debuffs) {
      const now = time;
      // Check slow
      if (player.debuffs.slow && now < player.debuffs.slow.until) {
        speedMultiplier *= (1 - player.debuffs.slow.power);
      }
      // Check selfSlow
      if (player.debuffs.selfSlow && now < player.debuffs.selfSlow.until) {
        speedMultiplier *= (1 - player.debuffs.selfSlow.power);
      }
      // Check root (cannot move)
      if (player.debuffs.root && now < player.debuffs.root.until) {
        speedMultiplier = 0; // Cannot move
      }
      // Check selfRoot
      if (player.debuffs.selfRoot && now < player.debuffs.selfRoot.until) {
        speedMultiplier = 0; // Cannot move
      }
    }
    
    // Apply buffs
    if (player.buffs) {
      const now = time;
      if (player.buffs.speedBoost && now < player.buffs.speedBoost.until) {
        speedMultiplier *= (1 + player.buffs.speedBoost.power);
      }
      if (player.buffs.haste && now < player.buffs.haste.until) {
        speedMultiplier *= (1 + player.buffs.haste.speedBoost);
      }
    }
    
    // Check for sleep (cannot move)
    if (player.sleepUntil && time < player.sleepUntil) {
      speedMultiplier = 0;
      // Heal over time
      if (player.healRate && player.healRate > 0) {
        const healAmount = player.healRate * dtSeconds;
        player.hp = Math.min(player.maxHp || player.hp || 1, (player.hp || 0) + healAmount);
      }
    }
    
    // Check for ground (cannot move)
    if (player.groundUntil && time < player.groundUntil) {
      speedMultiplier = 0;
    }
    
    const speed = baseSpeed * speedMultiplier;

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
      if (player.state === PlayerState.Idle) {
        player.state = PlayerState.Move;
        player.stateTime = 0;
      }
    } else if (player.state === PlayerState.Move) {
      player.state = PlayerState.Idle;
      player.stateTime = 0;
    }
  }

  // Aim dir from mouse
  const aimWorld = screenToWorld(input.mouse.x, input.mouse.y);
  const ax = aimWorld.x - player.position.x;
  const ay = aimWorld.y - player.position.y;
  const alen = Math.hypot(ax, ay) || 1;
  player.aimDir = { x: ax / alen, y: ay / alen };

  // Cast release (when windup ends) - trigger skill execution
  if (player.state === PlayerState.CastRelease) {
    console.log("=== CAST RELEASE ===");
    // Check resources before casting
    const canCast = checkCastConditions(player, currentAssembly);
    console.log("CastRelease - canCast:", canCast, "assembly:", currentAssembly?.templateId, "ops:", currentAssembly?.ops?.length);
    if (canCast.ok) {
      console.log("Emitting CastConfirm event with:", {
        time,
        casterId: "player",
        aimDir: player.aimDir,
        assemblyId: currentAssembly?.templateId,
        chargeTime: player.chargeTime // Pass charge time to skill execution
      });
      // Check stealth: reveal on attack
      if (player.stealthUntil && time < player.stealthUntil && player.revealOnAttack) {
        player.stealthUntil = 0; // Reveal
      }
      
      // Store charge time in context for Charge action to use
      const chargeTime = player.chargeTime || 0;
      player.chargeTime = undefined; // Clear after use
      player.chargeStartTime = undefined;
      player.chargeProgress = undefined;
      
      bus.emit("CastConfirm", { 
        time, 
        casterId: "player", 
        rng: createRng(time), 
        aimDir: player.aimDir,
        assembly: currentAssembly,
        chargeTime: chargeTime // Pass charge time to execution context
      });
      console.log("After CastConfirm emit, projectiles count:", world.projectiles?.length || 0);
      if (world.presentationBus) {
        world.presentationBus.emit("OnCastRelease", { time, casterId: "player", assembly: currentAssembly });
      }
      // Transition to recovery after triggering cast
      player.state = PlayerState.CastRecovery;
      player.stateTime = 0;
    } else {
      // Cast failed, show UI hint
      console.log("Cast failed:", canCast.reason);
      showCastFailHint(canCast.reason);
      player.state = PlayerState.Idle;
      player.stateTime = 0;
      // Clear charge state on failure
      player.chargeTime = undefined;
      player.chargeStartTime = undefined;
      player.chargeProgress = undefined;
    }
  }

  // Update area effects (DoT zones)
  if (world.areaEffects && world.areaEffects.length > 0) {
    const areaToRemove = [];
    for (let i = world.areaEffects.length - 1; i >= 0; i--) {
      const area = world.areaEffects[i];
      if (!area || time >= area.expiresAt) {
        areaToRemove.push(i);
        continue;
      }
      
      // Check if it's time for a tick
      if (time - area.lastTickAt >= area.tickIntervalMs) {
        const caster = world.entities[area.casterId];
        if (caster) {
          // Find all enemies in area
          const enemiesInArea = Object.values(world.entities).filter((e) => {
            if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
            const dist = Math.hypot(
              (e.position?.x || 0) - area.position.x,
              (e.position?.y || 0) - area.position.y
            );
            return dist <= area.radius;
          });
          
          if (enemiesInArea.length > 0) {
            // Apply damage (this will add hit effects automatically)
            applyDamage(world, enemiesInArea, caster, area.tickFormula);
            
            // Add area tick visual effect
            world.hitEffects = world.hitEffects || [];
            world.hitEffects.push({
              position: { x: area.position.x, y: area.position.y },
              damage: 0,
              createdAt: time,
              duration: 50,
              type: "areaTick",
            });
            
            // Apply all debuffs (support both old single debuff and new debuffs array)
            const debuffsToApply = area.debuffs || (area.debuff ? [area.debuff] : []);
            const areaCaster = world.entities[area.casterId];
            for (const debuff of debuffsToApply) {
              applyDebuff(world, enemiesInArea, debuff, time, areaCaster);
            }
            
            console.log(`Area DoT tick at (${area.position.x.toFixed(2)}, ${area.position.y.toFixed(2)}), hit ${enemiesInArea.length} enemies, applied ${debuffsToApply.length} debuffs`);
          }
        }
        area.lastTickAt = time;
      }
    }
    // Remove expired areas
    for (const idx of areaToRemove.reverse()) {
      world.areaEffects.splice(idx, 1);
    }
  }
  
  // Update beams (persistent beam effects)
  if (world.beams && world.beams.length > 0) {
    const beamsToRemove = [];
    for (let i = world.beams.length - 1; i >= 0; i--) {
      const beam = world.beams[i];
      if (!beam || time >= beam.expiresAt) {
        beamsToRemove.push(i);
        continue;
      }
      
      const caster = world.entities[beam.casterId];
      if (!caster) {
        beamsToRemove.push(i);
        continue;
      }
      
      // Update beam start position to follow caster (深拷贝避免引用问题)
      beam.start = { x: caster.position.x, y: caster.position.y };
      
      // Update beam rotation if enabled
      if (beam.canRotate && beam.rotateSpeed) {
        beam.currentAngle += beam.rotateSpeed * dtSeconds;
        const beamDir = { x: Math.cos(beam.currentAngle), y: Math.sin(beam.currentAngle) };
        beam.direction = beamDir;
      }
      
      // Update beam end position based on current start and direction
      beam.end = {
        x: beam.start.x + beam.direction.x * beam.length,
        y: beam.start.y + beam.direction.y * beam.length,
      };
      
      // Apply tick damage
      if (time - beam.lastTickAt >= beam.tickInterval) {
        // Find all enemies in beam path
        const enemiesInBeam = Object.values(world.entities).filter((e) => {
          if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
          if (!e.position) return false;
          
          // Check if enemy is in beam path (line segment distance)
          const distToLine = pointToLineDistance(e.position, beam.start, beam.end);
          return distToLine <= beam.width;
        });
        
        if (enemiesInBeam.length > 0) {
          // Sort by distance along beam (projection onto beam direction)
          enemiesInBeam.sort((a, b) => {
            // Project enemy position onto beam direction vector
            const dirX = beam.direction.x;
            const dirY = beam.direction.y;
            const aDx = a.position.x - beam.start.x;
            const aDy = a.position.y - beam.start.y;
            const bDx = b.position.x - beam.start.x;
            const bDy = b.position.y - beam.start.y;
            const aProj = aDx * dirX + aDy * dirY;
            const bProj = bDx * dirX + bDy * dirY;
            return aProj - bProj;
          });
          
          // Apply damage with pierce limit
          // pierceCount < 0 means infinite pierce
          let pierced = 0;
          for (const enemy of enemiesInBeam) {
            if (beam.pierceCount >= 0 && pierced >= beam.pierceCount) break;
            applyProjectileDamage(world, [enemy], caster, beam.tickFormula, enemy.position);
            pierced++;
            // Add hit effect for beam hits
            world.hitEffects = world.hitEffects || [];
            world.hitEffects.push({
              position: { x: enemy.position.x, y: enemy.position.y },
              damage: 0, // Damage number is shown by applyProjectileDamage
              createdAt: time,
              duration: 300,
              type: "beam",
            });
          }
          
          console.log(`Beam tick hit ${pierced} enemies`);
        }
        
        beam.lastTickAt = time;
      }
    }
    
    // Remove expired beams
    for (const idx of beamsToRemove.reverse()) {
      world.beams.splice(idx, 1);
    }
  }
  
  // Helper function: calculate distance from point to line segment
  function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.hypot(dx, dy);
  }
  
  // Update bleed debuffs (DoT ticks)
  for (const e of Object.values(world.entities)) {
    if (e.alive === false || !e.debuffs?.bleed) continue;
    const bleed = e.debuffs.bleed;
    const now = time;
    
    if (now >= bleed.until) {
      // Bleed expired
      delete e.debuffs.bleed;
      continue;
    }
    
    // Check if it's time for a tick
    if (now - bleed.lastTickAt >= bleed.tickIntervalMs) {
      const caster = world.entities[bleed.casterId] || world.entities.player;
      if (caster) {
        // Apply tick damage (multiplied by stacks)
        const tickDmg = {
          scale: bleed.tickFormula.scale * bleed.stacks,
          flat: bleed.tickFormula.flat * bleed.stacks,
        };
        applyDamage(world, [e], caster, tickDmg);
        
        // Visual feedback
        if (e.position) {
          world.hitEffects = world.hitEffects || [];
          world.hitEffects.push({
            position: { x: e.position.x, y: e.position.y },
            damage: 0,
            createdAt: now,
            duration: 200,
            type: "bleed",
          });
        }
      }
      bleed.lastTickAt = now;
    }
  }

  // Update projectiles
  if (world.projectiles && world.projectiles.length > 0) {
    const toRemove = [];
    for (let i = world.projectiles.length - 1; i >= 0; i--) {
      const proj = world.projectiles[i];
      if (!proj || !proj.velocity) {
        toRemove.push(i);
        continue;
      }
      
      // Homing: track nearest enemy
      if (proj.homing) {
        const caster = world.entities[proj.casterId];
        if (caster) {
          const enemies = Object.values(world.entities).filter((e) => {
            if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
            if (!e.position) return false;
            const dist = Math.hypot(
              e.position.x - proj.position.x,
              e.position.y - proj.position.y
            );
            return dist <= (proj.homing.loseTargetRange || 10);
          });
          
          if (enemies.length > 0) {
            // Find nearest enemy
            enemies.sort((a, b) => {
              const distA = Math.hypot(a.position.x - proj.position.x, a.position.y - proj.position.y);
              const distB = Math.hypot(b.position.x - proj.position.x, b.position.y - proj.position.y);
              return distA - distB;
            });
            const target = enemies[0];
            
            // Turn towards target
            const dx = target.position.x - proj.position.x;
            const dy = target.position.y - proj.position.y;
            const dist = Math.hypot(dx, dy) || 1;
            const targetDir = { x: dx / dist, y: dy / dist };
            
            // Apply turn rate
            const turnRate = proj.homing.turnRate || 0.1;
            const currentAngle = Math.atan2(proj.velocity.y, proj.velocity.x);
            const targetAngle = Math.atan2(targetDir.y, targetDir.x);
            let angleDiff = targetAngle - currentAngle;
            // Normalize angle difference
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            const maxTurn = turnRate * dtSeconds;
            const turnAmount = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
            const newAngle = currentAngle + turnAmount;
            
            proj.velocity.x = Math.cos(newAngle);
            proj.velocity.y = Math.sin(newAngle);
          }
        }
      }
      
      // Spiral: spiral motion (corkscrew path around forward direction)
      if (proj.spiral) {
        if (proj.spiral.angle === undefined) proj.spiral.angle = 0;
        
        // Update spiral angle (this controls the spiral phase, accumulates over time)
        const spiralSpeed = proj.spiral.spiralSpeed || 5; // radians per second
        proj.spiral.angle += spiralSpeed * dtSeconds;
        
        // Calculate perpendicular direction (90 degrees to velocity)
        const baseDir = Math.atan2(proj.velocity.y, proj.velocity.x);
        const perpDir = baseDir + Math.PI / 2;
        
        // Calculate spiral offset (perpendicular to movement direction, rotating around forward axis)
        // Use cosine and sine to create circular motion in perpendicular plane
        const spiralRadius = proj.spiral.spiralRadius || 0.5;
        const spiralOffset = {
          x: Math.cos(perpDir) * Math.cos(proj.spiral.angle) * spiralRadius,
          y: Math.sin(perpDir) * Math.cos(proj.spiral.angle) * spiralRadius,
        };
        
        // Apply spiral offset to position (in addition to normal movement)
        // Scale by speed to make spiral size consistent regardless of projectile speed
        const spiralScale = (proj.speed || 10) * 0.1; // Scale factor for spiral size
        proj.position.x += spiralOffset.x * spiralScale;
        proj.position.y += spiralOffset.y * spiralScale;
        
        // Also update velocity slightly to create smoother spiral (optional enhancement)
        // This creates a more visible spiral effect
        const velocityAdjustment = 0.02; // Small adjustment factor
        proj.velocity.x += Math.cos(perpDir) * Math.sin(proj.spiral.angle) * spiralRadius * velocityAdjustment;
        proj.velocity.y += Math.sin(perpDir) * Math.sin(proj.spiral.angle) * spiralRadius * velocityAdjustment;
        
        // Normalize velocity to maintain speed
        const velMag = Math.hypot(proj.velocity.x, proj.velocity.y) || 1;
        proj.velocity.x = (proj.velocity.x / velMag) * (proj.speed || 10);
        proj.velocity.y = (proj.velocity.y / velMag) * (proj.speed || 10);
      }
      
      // Orbit: orbit around caster (skip normal movement)
      if (proj.orbit) {
        const caster = world.entities[proj.casterId];
        if (caster && caster.position) {
          if (proj.orbit.angle === undefined) proj.orbit.angle = 0;
          proj.orbit.angle += proj.orbit.orbitSpeed * dtSeconds;
          const orbitX = caster.position.x + Math.cos(proj.orbit.angle) * proj.orbit.orbitRadius;
          const orbitY = caster.position.y + Math.sin(proj.orbit.angle) * proj.orbit.orbitRadius;
          proj.position.x = orbitX;
          proj.position.y = orbitY;
          proj.velocity.x = -Math.sin(proj.orbit.angle);
          proj.velocity.y = Math.cos(proj.orbit.angle);
          
          // Check duration
          if (proj.orbit.createdAt && time - proj.orbit.createdAt >= proj.orbit.durationMs) {
            toRemove.push(i);
            continue;
          }
          // Skip normal movement for orbit projectiles
          continue;
        }
      }
      
      // Return: return to caster after max distance
      if (proj.return) {
        const caster = world.entities[proj.casterId];
        if (caster && caster.position) {
          const dist = Math.hypot(
            proj.position.x - caster.position.x,
            proj.position.y - caster.position.y
          );
          
          if (!proj.return.started && dist >= proj.return.maxDistance) {
            // Start returning
            proj.return.started = true;
            proj.returnSpeed = proj.return.returnSpeed || proj.speed;
          }
          
          if (proj.return.started) {
            // Return to caster
            const dx = caster.position.x - proj.position.x;
            const dy = caster.position.y - proj.position.y;
            const returnDist = Math.hypot(dx, dy) || 1;
            proj.velocity.x = dx / returnDist;
            proj.velocity.y = dy / returnDist;
            proj.speed = proj.returnSpeed;
            
            // Check if reached caster
            if (returnDist < 0.5) {
              toRemove.push(i);
              continue;
            }
          }
        }
      }
      
      // Move projectile (skip if orbiting)
      // Note: Spiral movement is applied BEFORE normal movement, so it adds to the base movement
      if (!proj.orbit) {
        proj.position.x += proj.velocity.x * proj.speed * dtSeconds;
        proj.position.y += proj.velocity.y * proj.speed * dtSeconds;
      }
      
      // Check for Hover: if active, apply tick damage and don't move
      if (proj.hover && proj.hover.active) {
        const hover = proj.hover;
        const hoverPos = hover.hoverPosition || proj.position;
        const hoverDuration = hover.hoverDuration || 2000;
        const hoverRadius = hover.hoverRadius || 2;
        const tickInterval = hover.tickInterval || 200;
        const tickFormula = hover.tickFormula || proj.damage;
        
        // Check if hover duration expired
        if (time - hover.hoverStartTime >= hoverDuration) {
          toRemove.push(i);
          continue;
        }
        
        // Apply tick damage
        if (time - hover.lastTickAt >= tickInterval) {
          const caster = world.entities[proj.casterId];
          if (caster) {
            // Find all enemies in hover radius
            const enemiesInHover = Object.values(world.entities).filter((e) => {
              if (e.alive === false || e.kind !== "monster" || e.team === caster.team) return false;
              if (!e.position) return false;
              const dist = Math.hypot(
                e.position.x - hoverPos.x,
                e.position.y - hoverPos.y
              );
              return dist <= hoverRadius;
            });
            
            if (enemiesInHover.length > 0) {
              applyProjectileDamage(world, enemiesInHover, caster, tickFormula, hoverPos);
              console.log(`Hover tick at (${hoverPos.x.toFixed(2)}, ${hoverPos.y.toFixed(2)}), hit ${enemiesInHover.length} enemies`);
            }
          }
          hover.lastTickAt = time;
        }
        
        // Don't move hover projectiles
        continue;
      }
      
      // Check for explosion (before collision check)
      if (proj.explosionAt && time >= proj.explosionAt) {
        // Explode!
        const caster = world.entities[proj.casterId];
        if (caster && proj.explosionFormula && proj.explosionRadius) {
          // Find all enemies in explosion radius
          const explosionTargets = [];
          for (const e of Object.values(world.entities)) {
            if (e.alive === false || e.kind !== "monster" || e.team === caster.team) continue;
            if (!e.position) continue;
            const dist = Math.hypot(
              proj.position.x - e.position.x,
              proj.position.y - e.position.y
            );
            if (dist <= proj.explosionRadius) {
              explosionTargets.push(e);
            }
          }
          
          // Apply explosion damage
          if (explosionTargets.length > 0) {
            applyProjectileDamage(world, explosionTargets, caster, proj.explosionFormula, proj.position);
            console.log(`Explosion at (${proj.position.x.toFixed(2)}, ${proj.position.y.toFixed(2)}), hit ${explosionTargets.length} targets`);
          }
          
          // Always create explosion visual effect (even if no targets)
          world.hitEffects = world.hitEffects || [];
          world.hitEffects.push({
            position: { x: proj.position.x, y: proj.position.y },
            type: "explosion",
            radius: proj.explosionRadius || 2.5,
            createdAt: time,
            duration: 500, // Increased duration for better visibility
            damage: 0, // No damage number for explosion (damage already applied)
          });
          
          console.log(`Explosion visual effect created at (${proj.position.x.toFixed(2)}, ${proj.position.y.toFixed(2)}), radius: ${proj.explosionRadius}`);
        } else {
          console.warn("Explosion triggered but missing data:", { caster: !!caster, explosionFormula: !!proj.explosionFormula, explosionRadius: proj.explosionRadius });
        }
        toRemove.push(i);
        continue;
      }
      
      // Check collision with all enemies (not just preset targets)
      let hit = false;
      const caster = world.entities[proj.casterId];
      if (!caster) continue;
      
      // Check all enemies in the world
      for (const e of Object.values(world.entities)) {
        if (e.alive === false || e.kind !== "monster" || e.team === caster.team) continue;
        
        const dist = Math.hypot(
          proj.position.x - (e.position?.x || 0),
          proj.position.y - (e.position?.y || 0)
        );
        const targetRadius = e.id.includes("elite") ? 0.35 : 0.3; // Slightly larger hitbox
        if (dist < (proj.radius || 0.3) + targetRadius) {
          // Hit!
          console.log("Projectile hit:", e.id, "damage:", proj.damage);
          if (proj.damage && (!proj.hover || !proj.hover.active)) {
            // Only apply initial damage if not hovering (hover applies tick damage)
            applyProjectileDamage(world, [e], caster, proj.damage, proj.position);
            // Hit effect is already added in applyProjectileDamage
            
            // Check for ChainTrigger: onHit event
            if (caster.chainTriggers && caster.chainTriggers.length > 0) {
              for (const trigger of caster.chainTriggers) {
                if (trigger.triggerEvent === "onHit" && 
                    (trigger.maxTriggers < 0 || trigger.triggerCount < trigger.maxTriggers) &&
                    (trigger.cooldown === 0 || time - trigger.lastTriggerTime >= trigger.cooldown)) {
                  
                  // Check trigger chance
                  if (Math.random() < trigger.triggerChance) {
                    // Execute triggered action
                    const triggeredAction = trigger.triggeredAction;
                    if (triggeredAction) {
                      // Create a new context for the triggered action
                      const triggerCtx = {
                        ...ctx,
                        casterId: caster.id,
                        targets: [e.id],
                        time: time,
                        aimDir: proj.velocity || { x: 1, y: 0 },
                        assembly: trigger.assembly,
                      };
                      
                      // Execute triggered action (simplified: spawn projectile)
                      if (triggeredAction.kind === "SpawnProjectile") {
                        world.projectiles = world.projectiles || [];
                        const triggerProjId = `proj_trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const triggerProj = {
                          id: triggerProjId,
                          position: { x: proj.position.x, y: proj.position.y },
                          velocity: triggerCtx.aimDir,
                          speed: (triggeredAction.presentation?.projectileSpeed || 12) / 3,
                          radius: 0.3,
                          damage: triggeredAction.formula || { scale: 0.4, flat: 12 },
                          casterId: caster.id,
                          createdAt: time,
                          targets: [],
                          assembly: trigger.assembly,
                        };
                        world.projectiles.push(triggerProj);
                        console.log(`ChainTrigger activated: spawned projectile from hit`);
                      }
                      
                      trigger.triggerCount++;
                      trigger.lastTriggerTime = time;
                    }
                  }
                }
              }
            }
          }
          
          // Check for Hover: activate hover effect on hit (don't remove projectile)
          if (proj.hover && !proj.hover.active) {
            proj.hover.active = true;
            proj.hover.hoverPosition = { x: proj.position.x, y: proj.position.y };
            proj.hover.hoverStartTime = time;
            proj.hover.lastTickAt = time;
            // Stop projectile movement
            proj.velocity = { x: 0, y: 0 };
            proj.speed = 0;
            console.log(`Hover activated at (${proj.hover.hoverPosition.x.toFixed(2)}, ${proj.hover.hoverPosition.y.toFixed(2)})`);
            // Don't remove projectile, let it hover (set hit = false and break)
            hit = false;
            break; // Exit collision check, projectile will continue hovering
          }
          
          // If not hovering, mark as hit (will be removed unless ricochet)
          if (!proj.hover || !proj.hover.active) {
            hit = true;
          }
          
          // Check for SplitDamage: spawn split projectiles on hit
          // Only for ranged projectiles (not melee attacks)
          if (proj.assembly && !proj.split && proj.assembly.templateId !== "tpl_melee_burst_v1") {
            // Find SplitDamage action in assembly
            for (const op of proj.assembly.ops || []) {
              if (op.type === "Action" && op.kind === "SplitDamage") {
                const splitCount = op.splitCount || 3;
                const splitAngle = op.splitAngle || 60;
                const splitDecay = op.damageDecay || 0.7;
                const splitSpeed = op.projectileSpeed || (proj.speed || 10);
                
                // Calculate split directions from hit position
                const hitPos = proj.position;
                const baseAngle = Math.atan2(
                  e.position.y - hitPos.y,
                  e.position.x - hitPos.x
                );
                const angleStep = (splitAngle * Math.PI / 180) / (splitCount - 1 || 1);
                const startAngle = baseAngle - (splitAngle * Math.PI / 180) / 2;
                
                // Spawn split projectiles
                for (let i = 0; i < splitCount; i++) {
                  const angle = startAngle + angleStep * i;
                  const splitDir = { x: Math.cos(angle), y: Math.sin(angle) };
                  const splitFormula = {
                    scale: (proj.damage?.scale || 0) * splitDecay,
                    flat: (proj.damage?.flat || 0) * splitDecay,
                  };
                  
                  const splitProj = {
                    id: `split_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                    casterId: caster.id,
                    position: { x: hitPos.x, y: hitPos.y },
                    velocity: splitDir,
                    speed: splitSpeed,
                    radius: proj.radius || 0.3,
                    damage: splitFormula,
                    createdAt: time,
                    split: true, // Mark as split projectile to avoid infinite recursion
                    assembly: proj.assembly, // Keep assembly for other effects
                  };
                  
                  world.projectiles = world.projectiles || [];
                  world.projectiles.push(splitProj);
                  console.log("Split projectile spawned:", splitProj.id, "direction:", splitDir, "damage:", splitFormula);
                }
                break; // Only process first SplitDamage
              }
            }
          }
          
          // Ricochet: bounce to next target
          if (proj.ricochet) {
            const ricochetCount = proj.ricochetCount || 0;
            if (ricochetCount < proj.ricochet.bounceCount) {
              proj.ricochetCount = ricochetCount + 1;
              
              // Find next target
              const bounceRange = proj.ricochet.bounceRange || 4;
              const nextTargets = Object.values(world.entities).filter((t) => {
                if (t.alive === false || t.kind !== "monster" || t.team === caster.team) return false;
                if (t.id === e.id || proj.hitTargets?.includes(t.id)) return false; // Don't bounce to same target
                if (!t.position) return false;
                const bounceDist = Math.hypot(
                  t.position.x - proj.position.x,
                  t.position.y - proj.position.y
                );
                return bounceDist <= bounceRange;
              });
              
              if (nextTargets.length > 0) {
                // Pick nearest
                nextTargets.sort((a, b) => {
                  const distA = Math.hypot(a.position.x - proj.position.x, a.position.y - proj.position.y);
                  const distB = Math.hypot(b.position.x - proj.position.x, b.position.y - proj.position.y);
                  return distA - distB;
                });
                const nextTarget = nextTargets[0];
                
                // Bounce direction
                const dx = nextTarget.position.x - proj.position.x;
                const dy = nextTarget.position.y - proj.position.y;
                const bounceDist = Math.hypot(dx, dy) || 1;
                proj.velocity.x = dx / bounceDist;
                proj.velocity.y = dy / bounceDist;
                
                // Apply damage decay
                if (proj.damage) {
                  proj.damage = {
                    scale: proj.damage.scale * (proj.ricochet.damageDecay || 0.8),
                    flat: proj.damage.flat * (proj.ricochet.damageDecay || 0.8),
                  };
                }
                
                // Track hit targets
                proj.hitTargets = proj.hitTargets || [];
                proj.hitTargets.push(e.id);
                
                hit = false; // Don't remove, continue bouncing
                continue;
              }
            }
          }
          
          // Only mark as hit if not hovering (hover already set hit = false)
          if (!proj.hover || !proj.hover.active) {
            hit = true;
          }
          break; // Only hit one target per projectile (unless ricochet or hover)
        }
      }
      
      // Check for Hover: auto-activate if projectile times out or reaches max distance
      if (proj.hover && !proj.hover.active) {
        const maxAge = 5000; // Auto-activate after 5s if not hit
        const maxDistance = 50; // Auto-activate after traveling 50 units
        const travelDist = Math.hypot(
          proj.position.x - (proj.initialPosition?.x || proj.position.x),
          proj.position.y - (proj.initialPosition?.y || proj.position.y)
        );
        
        if (time - proj.createdAt >= maxAge || travelDist >= maxDistance) {
          // Auto-activate hover at current position
          proj.hover.active = true;
          proj.hover.hoverPosition = { x: proj.position.x, y: proj.position.y };
          proj.hover.hoverStartTime = time;
          proj.hover.lastTickAt = time;
          proj.velocity = { x: 0, y: 0 };
          proj.speed = 0;
          console.log(`Hover auto-activated at (${proj.hover.hoverPosition.x.toFixed(2)}, ${proj.hover.hoverPosition.y.toFixed(2)})`);
        }
      }
      
      // Remove if hit (unless hovering) or too old (10s timeout)
      if (hit && (!proj.hover || !proj.hover.active)) {
        toRemove.push(i);
      } else if (time - proj.createdAt > 10000) {
        // Timeout after 10s
        toRemove.push(i);
      }
    }
    // Remove in reverse order to maintain indices
    for (const idx of toRemove.reverse()) {
      world.projectiles.splice(idx, 1);
    }
  }

  // Check death
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    player.state = PlayerState.Death;
    time += step;
    return;
  }

  // Update summons (AI and duration)
  for (const e of Object.values(world.entities)) {
    if (e.alive === false || e.kind !== "summon") continue;
    if (e.createdAt && time - e.createdAt >= e.durationMs) {
      // Summon expired
      e.alive = false;
      world.pendingDeaths.push(e.id);
      continue;
    }
    
    // Simple summon AI: attack nearest enemy
    const enemies = Object.values(world.entities).filter((t) => {
      if (t.alive === false || t.kind === "summon" || t.team === e.team) return false;
      if (!t.position) return false;
      return true;
    });
    
    if (enemies.length > 0) {
      enemies.sort((a, b) => {
        const distA = Math.hypot(a.position.x - e.position.x, a.position.y - e.position.y);
        const distB = Math.hypot(b.position.x - e.position.x, b.position.y - e.position.y);
        return distA - distB;
      });
      const target = enemies[0];
      const dist = Math.hypot(target.position.x - e.position.x, target.position.y - e.position.y);
      
      if (dist > e.range) {
        // Move towards target
        const dx = target.position.x - e.position.x;
        const dy = target.position.y - e.position.y;
        const moveDist = Math.min(e.moveSpeed * dtSeconds, dist);
        e.position.x += (dx / dist) * moveDist;
        e.position.y += (dy / dist) * moveDist;
      } else {
        // Attack target
        e.lastAttackTime = e.lastAttackTime || 0;
        if (time - e.lastAttackTime >= e.attackSpeed) {
          const damage = Math.max(0, e.atk - (target.defense || 0));
          target.hp = (target.hp || 0) - damage;
          e.lastAttackTime = time;
          
          if (target.hp <= 0) {
            target.alive = false;
            target.hp = 0;
            world.pendingDeaths.push(target.id);
          }
        }
      }
    }
  }
  
  // monsters act with attack cooldown and telegraph
  for (const e of Object.values(world.entities)) {
    if (e.alive === false || e.kind !== "monster") continue;
    const player = world.entities.player;
    if (!player || player.alive === false) continue;
    const dx = (player.position.x || 0) - (e.position.x || 0);
    const dy = (player.position.y || 0) - (e.position.y || 0);
    const dist = Math.hypot(dx, dy);
    
    // Initialize attack state
    e.attackState = e.attackState || "idle";
    e.attackWindupStart = e.attackWindupStart || 0;
    
    if (dist > e.range) {
      // Out of range: move towards player
      e.attackState = "idle";
      
      // Apply debuffs to monster movement and behavior
      const now = time;
      
      // Check for Suppress: completely disabled
      if (e.suppressUntil && now < e.suppressUntil) {
        continue; // Skip all AI during suppress
      }
      
      // Check for Sleep: cannot act, but heals over time
      if (e.sleepUntil && now < e.sleepUntil) {
        // Heal over time
        if (e.healRate && e.healRate > 0) {
          const healAmount = e.healRate * dtSeconds;
          e.hp = Math.min(e.maxHp || e.hp || 1, (e.hp || 0) + healAmount);
        }
        continue; // Skip all AI during sleep
      }
      
      // Check for Ground: knocked down, cannot move or attack
      if (e.groundUntil && now < e.groundUntil) {
        continue; // Skip all AI during ground
      }
      
      // Check for Banished: in another dimension
      if (e.banishedUntil && now < e.banishedUntil) {
        continue; // Skip all AI during banished
      }
      
      // Check for Polymorph: transformed into harmless form
      if (e.polymorphUntil && now < e.polymorphUntil) {
        // Can move but cannot attack
        const moveSpeed = e.moveSpeed / 3;
        const stepDist = Math.min(moveSpeed * (step / 1000), dist);
        const nx = (dx / dist) * stepDist;
        const ny = (dy / dist) * stepDist;
        e.position.x += nx;
        e.position.y += ny;
        continue; // Skip attack AI during polymorph
      }
      
      // Check for Fear: random movement
      if (e.debuffs?.fear && now < e.debuffs.fear.until) {
        if (!e.fearDirection) {
          // Initialize fear direction
          const fearAngle = Math.random() * Math.PI * 2;
          e.fearDirection = { x: Math.cos(fearAngle), y: Math.sin(fearAngle) };
          e.fearSpeed = e.debuffs.fear.moveSpeed || e.moveSpeed || 1;
        }
        const fearSpeed = e.fearSpeed || e.moveSpeed || 1;
        e.position.x += e.fearDirection.x * fearSpeed * dtSeconds;
        e.position.y += e.fearDirection.y * fearSpeed * dtSeconds;
        // Update fear direction periodically
        if (Math.random() < 0.05) { // 5% chance per frame to change direction
          const fearAngle = Math.random() * Math.PI * 2;
          e.fearDirection = { x: Math.cos(fearAngle), y: Math.sin(fearAngle) };
        }
        continue; // Skip normal AI during fear
      } else {
        // Clear fear state when debuff expires
        if (e.fearDirection) {
          delete e.fearDirection;
          delete e.fearSpeed;
        }
      }
      
      // Check for Charm: move towards caster
      if (e.debuffs?.charm && now < e.debuffs.charm.until) {
        if (!e.charmDirection && player.position) {
          // Initialize charm direction
          const dx2 = player.position.x - e.position.x;
          const dy2 = player.position.y - e.position.y;
          const dist2 = Math.hypot(dx2, dy2) || 1;
          e.charmDirection = { x: dx2 / dist2, y: dy2 / dist2 };
          e.charmSpeed = e.debuffs.charm.moveSpeed || e.moveSpeed || 1;
        }
        if (e.charmDirection && player.position) {
          const charmSpeed = e.charmSpeed || e.moveSpeed || 1;
          e.position.x += e.charmDirection.x * charmSpeed * dtSeconds;
          e.position.y += e.charmDirection.y * charmSpeed * dtSeconds;
          // Update charm direction to always point at player
          const dx2 = player.position.x - e.position.x;
          const dy2 = player.position.y - e.position.y;
          const dist2 = Math.hypot(dx2, dy2) || 1;
          if (dist2 > 0.1) {
            e.charmDirection = { x: dx2 / dist2, y: dy2 / dist2 };
          }
        }
        continue; // Skip normal AI during charm
      } else {
        // Clear charm state when debuff expires
        if (e.charmDirection) {
          delete e.charmDirection;
          delete e.charmSpeed;
        }
      }
      
      // Check for Taunt: force to attack taunt target
      if (e.tauntUntil && now < e.tauntUntil && e.tauntTarget) {
        const tauntTarget = world.entities[e.tauntTarget];
        if (tauntTarget && tauntTarget.alive !== false) {
          // Move towards taunt target instead of player
          const tx = (tauntTarget.position.x || 0) - (e.position.x || 0);
          const ty = (tauntTarget.position.y || 0) - (e.position.y || 0);
          const tdist = Math.hypot(tx, ty);
          if (tdist > e.range) {
            const moveSpeed = e.moveSpeed / 3;
            const stepDist = Math.min(moveSpeed * (step / 1000), tdist);
            const nx = (tx / tdist) * stepDist;
            const ny = (ty / tdist) * stepDist;
            e.position.x += nx;
            e.position.y += ny;
          }
          // Continue to attack logic below (will attack taunt target)
        }
      }
      
      // Check for Pull/Knockback: prevent normal movement during displacement
      const isPulled = e.debuffs?.pull && now < e.debuffs.pull.until;
      const isKnockedBack = e.debuffs?.knockback && now < e.debuffs.knockback.until;
      
      // If pulled or knocked back, skip normal movement to allow displacement to be visible
      if (isPulled || isKnockedBack) {
        // Continue pull/knockback movement if debuff is still active
        if (isPulled && player.position) {
          const pullDx = player.position.x - e.position.x;
          const pullDy = player.position.y - e.position.y;
          const pullDist = Math.hypot(pullDx, pullDy) || 1;
          const pullSpeed = e.debuffs.pull.moveSpeed || 10;
          // Continue pulling towards player at pull speed (until debuff expires or reaches player)
          const pullStep = pullSpeed * dtSeconds;
          if (pullDist > 0.5) { // Stop when very close to player
            e.position.x += (pullDx / pullDist) * pullStep;
            e.position.y += (pullDy / pullDist) * pullStep;
            console.log(`Pull: monster ${e.id} pulled towards player, dist=${pullDist.toFixed(2)}`);
          }
        }
        if (isKnockedBack && player.position) {
          const kbDx = e.position.x - player.position.x;
          const kbDy = e.position.y - player.position.y;
          const kbDist = Math.hypot(kbDx, kbDy) || 1;
          const kbSpeed = e.debuffs.knockback.moveSpeed || 5;
          // Continue knocking back away from player at knockback speed
          const kbStep = kbSpeed * dtSeconds;
          if (kbDist < 20) { // Continue until far enough
            e.position.x += (kbDx / kbDist) * kbStep;
            e.position.y += (kbDy / kbDist) * kbStep;
            console.log(`Knockback: monster ${e.id} knocked back, dist=${kbDist.toFixed(2)}`);
          }
        }
        continue; // Skip normal movement during pull/knockback
      }
      
      // Apply debuffs to monster movement
      let moveSpeed = e.moveSpeed / 3; // Reduced to 1/3 speed
      if (e.debuffs) {
        if (e.debuffs.slow && now < e.debuffs.slow.until) {
          moveSpeed *= (1 - e.debuffs.slow.power);
        }
        // Root prevents movement
        if (e.debuffs.root && now < e.debuffs.root.until) {
          moveSpeed = 0;
        }
      }
      
      const stepDist = Math.min(moveSpeed * (step / 1000), dist);
      const nx = (dx / dist) * stepDist;
      const ny = (dy / dist) * stepDist;
      e.position.x += nx;
      e.position.y += ny;
    } else {
      // In range: attack logic
      const protoName = e.protoName || "meleeGrunt";
      let windupMs = 300; // Default
      if (protoName === "rangedShooter") windupMs = 400;
      else if (protoName === "eliteBrute") windupMs = 600;
      
      if (e.attackState === "idle") {
        // Start windup
        e.attackState = "windup";
        e.attackWindupStart = time;
      } else if (e.attackState === "windup") {
        // Check if windup finished
        if (time - e.attackWindupStart >= windupMs) {
          // Check if monster is disarmed or stunned
          const isMonsterDisarmed = e.debuffs?.disarm && time < e.debuffs.disarm.until;
          const isMonsterStunned = e.debuffs?.stun && time < e.debuffs.stun.until;
          
          if (!isMonsterDisarmed && !isMonsterStunned) {
            // Execute attack
            e.attackState = "attacking";
            e.lastAttackTime = time;
            // Check invulnerability and player disarm
            const isPlayerDisarmed = player.debuffs?.disarm && time < player.debuffs.disarm.until;
            if (time >= player.invulnerableUntil && !isPlayerDisarmed) {
              // Apply defense buffs
              let defense = player.defense || 0;
              if (player.buffs?.defBoost && time < player.buffs.defBoost.until) {
                defense += player.buffs.defBoost.power;
              }
              
              // Apply attack buffs to monster
              let monsterAtk = e.atk || 0;
              if (e.buffs?.atkBoost && time < e.buffs.atkBoost.until) {
                monsterAtk *= (1 + e.buffs.atkBoost.power);
              }
              
              const damage = Math.max(0, monsterAtk - defense);
              player.hp -= damage;
              
              // Check stealth: reveal on damage
              if (player.stealthUntil && time < player.stealthUntil && player.revealOnDamage) {
                player.stealthUntil = 0; // Reveal
              }
              
              // Trigger hitstun (unless in roll)
              if (player.state !== PlayerState.Roll && player.state !== PlayerState.Death) {
                player.state = PlayerState.Hitstun;
                player.stateTime = 0;
              }
              bus.emit("OnDamaged", { time, casterId: "player", rng: createRng(time + 7) });
            }
          }
          // Reset after attack (or if disarmed/stunned)
          e.attackState = "idle";
          e.attackCdMs = e.attackCdMs || 1000;
          e.lastAttackTime = time;
        }
      } else if (e.attackState === "attacking") {
        // Cooldown check
        e.lastAttackTime = e.lastAttackTime ?? -999999;
        const attackCdMs = e.attackCdMs ?? 1000;
        if (time - e.lastAttackTime >= attackCdMs) {
          e.attackState = "idle";
        }
      }
    }
  }

  for (const e of Object.values(world.entities)) {
    if (e.alive !== false && e.hp <= 0) {
      e.alive = false;
      // Start death animation
      world.deathAnimations.push({
        entityId: e.id,
        position: { ...e.position },
        startTime: time,
        duration: 800,
        scale: 1.0,
      });
      world.pendingDeaths.push(e.id);
    }
  }
  processDeaths();
  
  // Update death animations
  if (world.deathAnimations) {
    const toRemove = [];
    for (let i = 0; i < world.deathAnimations.length; i++) {
      const anim = world.deathAnimations[i];
      const age = time - anim.startTime;
      if (age > anim.duration) {
        toRemove.push(i);
      } else {
        anim.scale = 1 - age / anim.duration;
        anim.alpha = 1 - age / anim.duration;
      }
    }
    for (const idx of toRemove.reverse()) {
      world.deathAnimations.splice(idx, 1);
    }
  }
  time += step;
}

function worldToScreen(p) {
  // Camera follows player: world units -> pixels (relative to player position)
  const player = world.entities.player;
  const playerPos = player?.position || { x: 0, y: 0 };
  const scale = 45 * devicePixelRatio;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  // Transform relative to player position
  return { 
    x: cx + (p.x - playerPos.x) * scale, 
    y: cy + (p.y - playerPos.y) * scale 
  };
}

function drawGrassBackground() {
  const player = world.entities.player;
  const playerPos = player?.position || { x: 0, y: 0 };
  const scale = 45 * devicePixelRatio;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  
  // Base grass color (dark green, not too bright)
  const baseColor = "#1a3a1a"; // Dark green
  const lightColor = "#2a4a2a"; // Slightly lighter for texture
  const darkColor = "#0f2a0f"; // Darker patches
  
  // Fill base grass color
  ctx2d.fillStyle = baseColor;
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grass texture pattern (simple procedural)
  const tileSize = 2 * devicePixelRatio;
  const worldTileSize = 0.5; // world units per tile
  
  // Calculate visible world bounds
  const viewWidth = canvas.width / scale;
  const viewHeight = canvas.height / scale;
  const startX = Math.floor((playerPos.x - viewWidth / 2) / worldTileSize);
  const startY = Math.floor((playerPos.y - viewHeight / 2) / worldTileSize);
  const endX = Math.ceil((playerPos.x + viewWidth / 2) / worldTileSize);
  const endY = Math.ceil((playerPos.y + viewHeight / 2) / worldTileSize);
  
  // Simple hash function for deterministic pattern
  function hash(x, y) {
    return ((x * 73856093) ^ (y * 19349663)) % 1000;
  }
  
  // Draw grass tiles with variation
  for (let wx = startX; wx <= endX; wx++) {
    for (let wy = startY; wy <= endY; wy++) {
      const h = hash(wx, wy);
      const screenX = cx + (wx * worldTileSize - playerPos.x) * scale;
      const screenY = cy + (wy * worldTileSize - playerPos.y) * scale;
      
      // Vary grass color slightly
      if (h % 3 === 0) {
        ctx2d.fillStyle = lightColor;
      } else if (h % 7 === 0) {
        ctx2d.fillStyle = darkColor;
      } else {
        ctx2d.fillStyle = baseColor;
      }
      
      ctx2d.fillRect(screenX, screenY, tileSize, tileSize);
      
      // Add small grass blades occasionally (subtle)
      if (h % 8 === 0) {
        ctx2d.strokeStyle = lightColor;
        ctx2d.lineWidth = 1 * devicePixelRatio;
        ctx2d.beginPath();
        const bladeX = screenX + (h % 10) / 10 * tileSize;
        const bladeY = screenY + tileSize;
        ctx2d.moveTo(bladeX, bladeY);
        ctx2d.lineTo(bladeX + (h % 3 - 1) * 0.5, bladeY - tileSize * 0.6);
        ctx2d.stroke();
      }
    }
  }
}

function drawDecoration(deco) {
  const p = worldToScreen(deco.position);
  const size = deco.size * 45 * devicePixelRatio;
  
  ctx2d.save();
  ctx2d.translate(p.x, p.y);
  ctx2d.rotate(deco.rotation);
  
  switch (deco.type) {
    case "rock":
      // Draw a simple rock (dark gray oval)
      ctx2d.fillStyle = "#3a3a3a";
      ctx2d.strokeStyle = "#2a2a2a";
      ctx2d.lineWidth = 1 * devicePixelRatio;
      ctx2d.beginPath();
      ctx2d.ellipse(0, 0, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.stroke();
      // Add highlight
      ctx2d.fillStyle = "#4a4a4a";
      ctx2d.beginPath();
      ctx2d.ellipse(-size * 0.2, -size * 0.2, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
      ctx2d.fill();
      break;
      
    case "grass":
      // Draw grass tuft (green lines)
      ctx2d.strokeStyle = "#2a5a2a";
      ctx2d.lineWidth = 2 * devicePixelRatio;
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * size * 0.2;
        ctx2d.beginPath();
        ctx2d.moveTo(offset, size * 0.3);
        ctx2d.lineTo(offset + (i % 2 === 0 ? -1 : 1) * size * 0.1, -size * 0.2);
        ctx2d.stroke();
      }
      break;
      
    case "flower":
      // Draw a simple flower (colored circle with petals)
      const flowerColors = ["#ff6b9d", "#ffaa44", "#88cc88", "#aa88ff"];
      const color = flowerColors[Math.floor(deco.position.x * 7 + deco.position.y * 11) % flowerColors.length];
      
      // Petals
      ctx2d.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const px = Math.cos(angle) * size * 0.3;
        const py = Math.sin(angle) * size * 0.3;
        ctx2d.beginPath();
        ctx2d.arc(px, py, size * 0.15, 0, Math.PI * 2);
        ctx2d.fill();
      }
      // Center
      ctx2d.fillStyle = "#ffd700";
      ctx2d.beginPath();
      ctx2d.arc(0, 0, size * 0.1, 0, Math.PI * 2);
      ctx2d.fill();
      break;
      
    case "bush":
      // Draw a bush (dark green circle with texture)
      ctx2d.fillStyle = "#1a4a1a";
      ctx2d.strokeStyle = "#0f3a0f";
      ctx2d.lineWidth = 1 * devicePixelRatio;
      ctx2d.beginPath();
      ctx2d.arc(0, 0, size, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.stroke();
      // Add some texture
      ctx2d.fillStyle = "#2a5a2a";
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const px = Math.cos(angle) * size * 0.5;
        const py = Math.sin(angle) * size * 0.5;
        ctx2d.beginPath();
        ctx2d.arc(px, py, size * 0.3, 0, Math.PI * 2);
        ctx2d.fill();
      }
      break;
  }
  
  ctx2d.restore();
}

/**
 * 程序化生成装饰元素（根据玩家位置动态生成）
 */
function drawProceduralDecorations() {
  const player = world.entities.player;
  const playerPos = player?.position || { x: 0, y: 0 };
  const scale = 45 * devicePixelRatio;
  
  // 计算可见区域的世界坐标范围（扩大一些，确保边缘也有装饰）
  const viewWidth = canvas.width / scale;
  const viewHeight = canvas.height / scale;
  const margin = 5; // 额外的边距，确保移动时也能看到装饰
  const minX = playerPos.x - viewWidth / 2 - margin;
  const maxX = playerPos.x + viewWidth / 2 + margin;
  const minY = playerPos.y - viewHeight / 2 - margin;
  const maxY = playerPos.y + viewHeight / 2 + margin;
  
  // 装饰元素的网格大小（世界单位）
  const gridSize = 3; // 每3个世界单位生成一个装饰元素
  
  // 使用确定性随机数生成器（基于网格坐标）
  function hash(x, y) {
    const n = Math.floor(x / gridSize) * 73856093 + Math.floor(y / gridSize) * 19349663;
    return ((n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  }
  
  // 装饰类型数组
  const decorationTypes = ["rock", "grass", "flower", "bush"];
  
  // 遍历可见区域内的网格
  const startGridX = Math.floor(minX / gridSize);
  const endGridX = Math.ceil(maxX / gridSize);
  const startGridY = Math.floor(minY / gridSize);
  const endGridY = Math.ceil(maxY / gridSize);
  
  for (let gridX = startGridX; gridX <= endGridX; gridX++) {
    for (let gridY = startGridY; gridY <= endGridY; gridY++) {
      const worldX = gridX * gridSize;
      const worldY = gridY * gridSize;
      
      // 使用哈希函数确定这个网格是否有装饰元素（30%概率）
      const h = hash(gridX, gridY);
      if (h > 0.3) continue; // 70%的网格不生成装饰，保持稀疏
      
      // 在网格内随机偏移位置
      const offsetX = (hash(gridX + 1, gridY) - 0.5) * gridSize * 0.8;
      const offsetY = (hash(gridX, gridY + 1) - 0.5) * gridSize * 0.8;
      const decoX = worldX + offsetX;
      const decoY = worldY + offsetY;
      
      // 确定装饰类型
      const typeIndex = Math.floor(hash(gridX * 2, gridY * 2) * decorationTypes.length);
      const decoType = decorationTypes[typeIndex];
      
      // 确定大小和旋转
      const decoSize = 0.2 + hash(gridX * 3, gridY * 3) * 0.4;
      const decoRotation = hash(gridX * 4, gridY * 4) * Math.PI * 2;
      
      // 绘制装饰元素
      drawDecoration({
        type: decoType,
        position: { x: decoX, y: decoY },
        size: decoSize,
        rotation: decoRotation,
      });
    }
  }
}

function screenToWorld(px, py) {
  // Camera follows player: pixels -> world units (relative to player position)
  const player = world.entities.player;
  const playerPos = player?.position || { x: 0, y: 0 };
  const scale = 45 * devicePixelRatio;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  // Transform relative to player position
  const worldX = (px * devicePixelRatio - cx) / scale + playerPos.x;
  const worldY = (py * devicePixelRatio - cy) / scale + playerPos.y;
  return { x: worldX, y: worldY };
}

function drawTelegraphs() {
  for (const e of Object.values(world.entities)) {
    if (e.alive === false || e.kind !== "monster") continue;
    if (e.attackState !== "windup") continue;
    
    const player = world.entities.player;
    if (!player || player.alive === false) continue;
    
    const protoName = e.protoName || "meleeGrunt";
    const p = worldToScreen(e.position || { x: 0, y: 0 });
    const dx = (player.position.x || 0) - (e.position.x || 0);
    const dy = (player.position.y || 0) - (e.position.y || 0);
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    ctx2d.save();
    ctx2d.globalAlpha = 0.5;
    ctx2d.strokeStyle = "#ff0000";
    ctx2d.fillStyle = "rgba(255,0,0,0.2)";
    ctx2d.lineWidth = 2 * devicePixelRatio;
    
    if (protoName === "meleeGrunt") {
      // Melee: cone telegraph
      const range = e.range * 45 * devicePixelRatio;
      const angle = 60 * (Math.PI / 180);
      const halfAngle = angle / 2;
      const dirAngle = Math.atan2(dirY, dirX);
      ctx2d.beginPath();
      ctx2d.moveTo(p.x, p.y);
      ctx2d.arc(p.x, p.y, range, dirAngle - halfAngle, dirAngle + halfAngle);
      ctx2d.closePath();
      ctx2d.fill();
      ctx2d.stroke();
    } else if (protoName === "rangedShooter") {
      // Ranged: line telegraph
      const range = e.range * 45 * devicePixelRatio;
      const endX = p.x + dirX * range;
      const endY = p.y + dirY * range;
      ctx2d.beginPath();
      ctx2d.moveTo(p.x, p.y);
      ctx2d.lineTo(endX, endY);
      ctx2d.stroke();
      // End marker
      ctx2d.beginPath();
      ctx2d.arc(endX, endY, 4 * devicePixelRatio, 0, Math.PI * 2);
      ctx2d.fill();
    } else if (protoName === "eliteBrute") {
      // Elite: large circle telegraph
      const radius = 5 * 45 * devicePixelRatio;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.stroke();
    }
    
    ctx2d.restore();
  }
}

function drawIndicators(player, assembly) {
  if (!player || player.alive === false) return;
  // 在前摇和释放期间都显示指示器
  if (player.state !== PlayerState.CastWindup && player.state !== PlayerState.CastRelease) return;
  if (!assembly || !assembly.presentation) return;

  const p = worldToScreen(player.position || { x: 0, y: 0 });
  const dir = player.aimDir || { x: 1, y: 0 };
  const shape = assembly.presentation.indicatorShape || "line";
  const size = assembly.presentation.indicatorSize || {};
  
  // Check if this is a charge skill
  const hasChargeAction = assembly?.ops?.some(op => op.kind === "Charge");
  const chargeProgress = player.chargeProgress || 0;

  ctx2d.save();
  ctx2d.globalAlpha = 0.4;
  ctx2d.strokeStyle = hasChargeAction ? "#ffaa00" : "#3ce7ff"; // Orange for charge, cyan for normal
  ctx2d.fillStyle = hasChargeAction ? "rgba(255,170,0,0.15)" : "rgba(60,231,255,0.15)";
  ctx2d.lineWidth = 2 * devicePixelRatio;

  if (shape === "line") {
    const range = (size.range || 12) * 45 * devicePixelRatio;
    const endX = p.x + dir.x * range;
    const endY = p.y + dir.y * range;
    ctx2d.beginPath();
    ctx2d.moveTo(p.x, p.y);
    ctx2d.lineTo(endX, endY);
    ctx2d.stroke();
    // End marker
    ctx2d.beginPath();
    ctx2d.arc(endX, endY, 4 * devicePixelRatio, 0, Math.PI * 2);
    ctx2d.fill();
  } else if (shape === "cone") {
    const range = (size.range || 10) * 45 * devicePixelRatio;
    const angle = (size.angle || 60) * (Math.PI / 180);
    const halfAngle = angle / 2;
    const dirAngle = Math.atan2(dir.y, dir.x);
    const startAngle = dirAngle - halfAngle;
    const endAngle = dirAngle + halfAngle;
    ctx2d.beginPath();
    ctx2d.moveTo(p.x, p.y);
    ctx2d.arc(p.x, p.y, range, startAngle, endAngle);
    ctx2d.closePath();
    ctx2d.fill();
    ctx2d.stroke();
  } else if (shape === "circle") {
    const radius = (size.radius || 3) * 45 * devicePixelRatio;
    // Circle at mouse position (or player position for ground-targeted)
    const targetWorld = screenToWorld(input.mouse.x, input.mouse.y);
    const targetScreen = worldToScreen(targetWorld);
    ctx2d.beginPath();
    ctx2d.arc(targetScreen.x, targetScreen.y, radius, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.stroke();
  } else if (shape === "dash") {
    const distance = (size.distance || 5) * 45 * devicePixelRatio;
    const endX = p.x + dir.x * distance;
    const endY = p.y + dir.y * distance;
    // Dash path
    ctx2d.beginPath();
    ctx2d.moveTo(p.x, p.y);
    ctx2d.lineTo(endX, endY);
    ctx2d.stroke();
    // End marker
    ctx2d.beginPath();
    ctx2d.arc(endX, endY, 6 * devicePixelRatio, 0, Math.PI * 2);
    ctx2d.fill();
  }
  
  // Draw charge progress indicator (for charge skills)
  if (hasChargeAction && player.state === PlayerState.CastWindup && chargeProgress > 0) {
    ctx2d.save();
    ctx2d.globalAlpha = 0.8;
    ctx2d.strokeStyle = "#ffaa00";
    ctx2d.fillStyle = "rgba(255,170,0,0.3)";
    ctx2d.lineWidth = 4 * devicePixelRatio;
    
    // Draw expanding ring around player
    const maxRadius = 20 * devicePixelRatio;
    const currentRadius = maxRadius * chargeProgress;
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
    ctx2d.stroke();
    
    // Draw inner core (more intense as charge increases)
    const coreRadius = maxRadius * 0.3 * chargeProgress;
    if (coreRadius > 2) {
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, coreRadius, 0, Math.PI * 2);
      ctx2d.fill();
    }
    
    // Draw charge percentage text
    ctx2d.fillStyle = "#ffaa00";
    ctx2d.font = `${16 * devicePixelRatio}px Arial`;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText(`${Math.round(chargeProgress * 100)}%`, p.x, p.y - maxRadius - 20 * devicePixelRatio);
    
    ctx2d.restore();
  }

  ctx2d.restore();
}

function draw() {
  // Ensure canvas is properly sized
  if (canvas.width === 0 || canvas.height === 0) {
    resize();
  }
  
  // Debug: log canvas size
  if (!draw._logged) {
    console.log("Canvas size:", canvas.width, "x", canvas.height);
    console.log("Canvas client size:", canvas.clientWidth, "x", canvas.clientHeight);
    console.log("Device pixel ratio:", devicePixelRatio);
    draw._logged = true;
  }
  
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grass background
  drawGrassBackground();
  
  // Draw decorations (rocks, grass, flowers, bushes) - 程序化生成
  drawProceduralDecorations();
  
  // Debug: draw center crosshair (subtle, for aiming)
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ctx2d.strokeStyle = "rgba(255,255,0,0.3)";
  ctx2d.lineWidth = 2 * devicePixelRatio;
  ctx2d.beginPath();
  ctx2d.moveTo(centerX - 20, centerY);
  ctx2d.lineTo(centerX + 20, centerY);
  ctx2d.moveTo(centerX, centerY - 20);
  ctx2d.lineTo(centerX, centerY + 20);
  ctx2d.stroke();

  // draw death animations
  if (world.deathAnimations) {
    for (const anim of world.deathAnimations) {
      const p = worldToScreen(anim.position);
      const protoName = anim.entityId.includes("elite") ? "eliteBrute" : anim.entityId.includes("ranged") ? "rangedShooter" : "meleeGrunt";
      const baseR = protoName === "eliteBrute" ? 14 : protoName === "rangedShooter" ? 8 : 10;
      const r = baseR * devicePixelRatio * anim.scale;
      
      ctx2d.save();
      ctx2d.globalAlpha = anim.alpha;
      
      if (protoName === "rangedShooter") {
        const w = 8 * devicePixelRatio * anim.scale;
        const h = 16 * devicePixelRatio * anim.scale;
        ctx2d.fillStyle = "#ff5a7a";
        ctx2d.fillRect(p.x - w / 2, p.y - h / 2, w, h);
      } else {
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx2d.fillStyle = protoName === "eliteBrute" ? "#8b1a2a" : "#ff5a7a";
        ctx2d.fill();
      }
      
      ctx2d.restore();
    }
  }
  
  // draw entities
  const entities = Object.values(world.entities);
  if (entities.length === 0) {
    // Debug: draw warning if no entities
    ctx2d.fillStyle = "#ff0000";
    ctx2d.font = `${20 * devicePixelRatio}px monospace`;
    ctx2d.textAlign = "center";
    ctx2d.fillText("No entities found! Click '刷新怪物'", centerX, centerY);
  }
  
  for (const e of entities) {
    if (e.alive === false) continue;
    
    // Check hit flash
    const isFlashing = e.hitFlashUntil && time < e.hitFlashUntil;
    const p = worldToScreen(e.position || { x: 0, y: 0 });
    
    if (e.kind === "player") {
      // Check for stealth (semi-transparent for player)
      const isStealthed = e.stealthUntil && time < e.stealthUntil;
      if (isStealthed) {
        // Player is always visible but semi-transparent when stealthed
        ctx2d.save();
        ctx2d.globalAlpha = 0.4; // Semi-transparent
      }
      
      // Draw dash trail first (behind player)
      if (e.dashState && e.dashState.active && e.dashState.trail && e.dashState.trail.length > 1) {
        ctx2d.save();
        ctx2d.strokeStyle = "#3ce7ff";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.globalAlpha = 0.6;
        ctx2d.lineCap = "round";
        ctx2d.lineJoin = "round";
        
        // Draw trail with fading effect
        for (let i = 0; i < e.dashState.trail.length - 1; i++) {
          const p1 = worldToScreen(e.dashState.trail[i]);
          const p2 = worldToScreen(e.dashState.trail[i + 1]);
          const age = time - e.dashState.trail[i].time;
          const alpha = Math.max(0, 1 - age / 200); // Fade over 200ms
          
          ctx2d.globalAlpha = alpha * 0.6;
          ctx2d.beginPath();
          ctx2d.moveTo(p1.x, p1.y);
          ctx2d.lineTo(p2.x, p2.y);
          ctx2d.stroke();
        }
        
        // Draw trail particles (small dots along the path)
        for (let i = 0; i < e.dashState.trail.length; i++) {
          const trailP = worldToScreen(e.dashState.trail[i]);
          const age = time - e.dashState.trail[i].time;
          const alpha = Math.max(0, 1 - age / 200);
          const size = 3 * devicePixelRatio * alpha;
          
          ctx2d.globalAlpha = alpha * 0.8;
          ctx2d.fillStyle = "#ffffff";
          ctx2d.beginPath();
          ctx2d.arc(trailP.x, trailP.y, size, 0, Math.PI * 2);
          ctx2d.fill();
        }
        
        ctx2d.restore();
      }
      
      // Player: 抖音小火人形象
      const isDashing = e.dashState && e.dashState.active;
      const isRolling = e.state === PlayerState.Roll;
      const isCasting = e.state === PlayerState.CastWindup || e.state === PlayerState.CastRelease;
      ctx2d.save();
      
      // 小火人身体（火焰形状）
      const bodyR = 12 * devicePixelRatio;
      const headR = 8 * devicePixelRatio;
      const playerR = Math.max(bodyR, headR); // 用于HP条位置计算
      
      // 前摇期间：降低透明度并添加蓄力效果
      if (e.state === PlayerState.CastWindup && e.castWindupEnd) {
        const windupDuration = e.castWindupEnd - (time - e.stateTime);
        const windupProgress = Math.min(1, e.stateTime / windupDuration);
        
        // 蓄力光环（逐渐扩大）
        ctx2d.strokeStyle = "#ffff00";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.globalAlpha = 0.6 * (1 - windupProgress);
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, bodyR * (1 + windupProgress * 0.8), 0, Math.PI * 2);
        ctx2d.stroke();
        
        // 蓄力能量聚集效果（内圈）
        ctx2d.fillStyle = "#ffff00";
        ctx2d.globalAlpha = 0.4 * windupProgress;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, bodyR * windupProgress, 0, Math.PI * 2);
        ctx2d.fill();
        
        // 降低角色透明度
        ctx2d.globalAlpha = 0.7 + 0.3 * windupProgress;
      }
      
      // 翻滚期间：半透明并添加残影
      if (isRolling) {
        ctx2d.globalAlpha = 0.6;
        // 绘制残影
        if (e.rollState && e.rollState.startPos) {
          const rollProgress = e.stateTime / e.rollState.duration;
          const shadowCount = 3;
          for (let i = 0; i < shadowCount; i++) {
            const shadowProgress = rollProgress - (i + 1) * 0.1;
            if (shadowProgress > 0) {
              const shadowX = e.rollState.startPos.x + e.rollState.direction.x * e.rollState.distance * shadowProgress;
              const shadowY = e.rollState.startPos.y + e.rollState.direction.y * e.rollState.distance * shadowProgress;
              const shadowP = worldToScreen({ x: shadowX, y: shadowY });
              ctx2d.globalAlpha = 0.3 * (1 - i / shadowCount);
              ctx2d.fillStyle = "#ff6600";
              ctx2d.beginPath();
              ctx2d.ellipse(shadowP.x, shadowP.y + bodyR * 0.3, bodyR * 0.8, bodyR, 0, 0, Math.PI * 2);
              ctx2d.fill();
            }
          }
          ctx2d.globalAlpha = 0.6;
        }
      }
      
      // 身体（底部较大的火焰）
      ctx2d.fillStyle = isDashing ? "#ffaa00" : isRolling ? "#ff8800" : "#ff6600";
      ctx2d.shadowBlur = 8 * devicePixelRatio;
      ctx2d.shadowColor = "#ff6600";
      ctx2d.beginPath();
      ctx2d.ellipse(p.x, p.y + bodyR * 0.3, bodyR * 0.8, bodyR, 0, 0, Math.PI * 2);
      ctx2d.fill();
      
      // 头部（较小的火焰）
      ctx2d.fillStyle = isDashing ? "#ffff00" : isRolling ? "#ffaa00" : "#ffaa00";
      ctx2d.shadowBlur = 6 * devicePixelRatio;
      ctx2d.shadowColor = "#ffaa00";
      ctx2d.beginPath();
      ctx2d.ellipse(p.x, p.y - headR * 0.5, headR * 0.7, headR, 0, 0, Math.PI * 2);
      ctx2d.fill();
      
      // 眼睛（两个小点）
      ctx2d.fillStyle = "#000000";
      ctx2d.shadowBlur = 0;
      const eyeSize = 2 * devicePixelRatio;
      ctx2d.beginPath();
      ctx2d.arc(p.x - 3 * devicePixelRatio, p.y - headR * 0.5, eyeSize, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.beginPath();
      ctx2d.arc(p.x + 3 * devicePixelRatio, p.y - headR * 0.5, eyeSize, 0, Math.PI * 2);
      ctx2d.fill();
      
      // 嘴巴（微笑，翻滚时可能变成惊讶）
      ctx2d.strokeStyle = "#000000";
      ctx2d.lineWidth = 1.5 * devicePixelRatio;
      ctx2d.beginPath();
      if (isRolling) {
        // 翻滚时：圆形嘴巴（惊讶）
        ctx2d.arc(p.x, p.y - headR * 0.2, 2 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
      } else {
        // 正常：微笑
        ctx2d.arc(p.x, p.y - headR * 0.2, 3 * devicePixelRatio, 0, Math.PI);
        ctx2d.stroke();
      }
      
      ctx2d.restore();
      
      // 绘制武器（如果存在）
      if (currentAssembly && e.aimDir) {
        const weaponAngle = Math.atan2(e.aimDir.y, e.aimDir.x);
        const weaponLength = 20 * devicePixelRatio;
        const weaponWidth = 4 * devicePixelRatio;
        const handOffset = 6 * devicePixelRatio; // 手的位置偏移
        
        ctx2d.save();
        ctx2d.translate(p.x + Math.cos(weaponAngle) * handOffset, p.y + Math.sin(weaponAngle) * handOffset);
        ctx2d.rotate(weaponAngle);
        
        // 武器主体（根据技能性格改变颜色）
        let weaponColor = "#88ccff"; // 默认蓝色
        if (currentTemplate && currentTemplate._personality) {
          const personality = SKILL_PERSONALITIES[currentTemplate._personality];
          if (personality && personality.visualStyle) {
            weaponColor = personality.visualStyle.color || weaponColor;
          }
        } else if (currentAssembly && currentAssembly.templateId === "tpl_ranged_proj_v1") {
          weaponColor = "#88ccff";
        } else {
          weaponColor = "#ffaa88";
        }
        ctx2d.fillStyle = weaponColor;
        ctx2d.shadowBlur = 4 * devicePixelRatio;
        ctx2d.shadowColor = weaponColor;
        
        // 绘制武器（简单的矩形，可以扩展为更复杂的形状）
        ctx2d.fillRect(0, -weaponWidth / 2, weaponLength, weaponWidth);
        
        // 武器尖端
        ctx2d.beginPath();
        ctx2d.moveTo(weaponLength, 0);
        ctx2d.lineTo(weaponLength - weaponWidth * 1.5, -weaponWidth);
        ctx2d.lineTo(weaponLength - weaponWidth * 1.5, weaponWidth);
        ctx2d.closePath();
        ctx2d.fill();
        
        // 武器装饰（根据技能效果添加光效）
        ctx2d.fillStyle = "#ffffff";
        ctx2d.globalAlpha = 0.6;
        ctx2d.fillRect(weaponLength * 0.3, -weaponWidth / 3, weaponLength * 0.4, weaponWidth * 2 / 3);
        ctx2d.globalAlpha = 1.0;
        
        ctx2d.restore();
      }
      
      // Player HP bar (above character)
      const hpBarW = 60 * devicePixelRatio;
      const hpBarH = 8 * devicePixelRatio;
      const hpPct = Math.max(0, Math.min(1, (e.hp || 0) / (e.maxHp || e.hp || 1)));
      const hpBarX = p.x - hpBarW / 2;
      const hpBarY = p.y - playerR - 25 * devicePixelRatio;
      
      // Dark background with border for visibility
      ctx2d.fillStyle = "rgba(0,0,0,0.8)";
      ctx2d.fillRect(hpBarX - 2, hpBarY - 2, hpBarW + 4, hpBarH + 4);
      ctx2d.strokeStyle = "rgba(255,255,255,0.6)";
      ctx2d.lineWidth = 1.5 * devicePixelRatio;
      ctx2d.strokeRect(hpBarX - 2, hpBarY - 2, hpBarW + 4, hpBarH + 4);
      
      // Empty bar background
      ctx2d.fillStyle = "rgba(100,0,0,0.7)";
      ctx2d.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
      
      // HP fill (bright green for player)
      ctx2d.fillStyle = "#7bff8a";
      ctx2d.fillRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);
      
      // Bright border on HP portion
      if (hpPct > 0) {
        ctx2d.strokeStyle = "#9bffab";
        ctx2d.lineWidth = 1 * devicePixelRatio;
        ctx2d.strokeRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);
      }
      
      // Draw shield bar if active (above HP bar)
      if (e.debuffs?.shield && time < e.debuffs.shield.until) {
        const shieldAmount = e.debuffs.shield.power || 0;
        const maxShield = 200; // Default max shield for visualization
        const shieldPct = Math.max(0, Math.min(1, shieldAmount / maxShield));
        const shieldBarY = hpBarY - 10 * devicePixelRatio;
        
        // Shield bar background
        ctx2d.fillStyle = "rgba(0,0,0,0.6)";
        ctx2d.fillRect(hpBarX - 2, shieldBarY - 2, hpBarW + 4, hpBarH + 4);
        // Shield fill (cyan)
        ctx2d.fillStyle = "#3ce7ff";
        ctx2d.fillRect(hpBarX, shieldBarY, hpBarW * shieldPct, hpBarH);
        // Shield border
        ctx2d.strokeStyle = "#0066cc";
        ctx2d.lineWidth = 1.5 * devicePixelRatio;
        ctx2d.strokeRect(hpBarX - 2, shieldBarY - 2, hpBarW + 4, hpBarH + 4);
      }
      
      // Debug: draw position text (moved down)
      ctx2d.fillStyle = "#ffffff";
      ctx2d.font = `${12 * devicePixelRatio}px monospace`;
      ctx2d.textAlign = "center";
      ctx2d.fillText(`P(${Math.floor(e.position?.x || 0)},${Math.floor(e.position?.y || 0)})`, p.x, p.y - playerR - 50 * devicePixelRatio);
      
      // Restore alpha if stealthed
      if (isStealthed) {
        ctx2d.restore();
      }
    } else if (e.kind === "summon") {
      // Draw summon (smaller, different color)
      ctx2d.save();
      ctx2d.fillStyle = "#88ff88";
      ctx2d.strokeStyle = "#44aa44";
      ctx2d.lineWidth = 1.5 * devicePixelRatio;
      const summonR = 6 * devicePixelRatio;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, summonR, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.stroke();
      ctx2d.restore();
      
      // HP bar for summon
      const hpBarW = 40 * devicePixelRatio;
      const hpBarH = 4 * devicePixelRatio;
      const hpPct = Math.max(0, Math.min(1, (e.hp || 0) / (e.maxHp || e.hp || 1)));
      const hpBarX = p.x - hpBarW / 2;
      const hpBarY = p.y - summonR - 8 * devicePixelRatio;
      ctx2d.fillStyle = "rgba(0,0,0,0.6)";
      ctx2d.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
      ctx2d.fillStyle = "#88ff88";
      ctx2d.fillRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);
    } else if (e.kind === "monster") {
      // Monster visuals based on type
      const protoName = e.protoName || (e.id.includes("elite") ? "eliteBrute" : e.id.includes("ranged") ? "rangedShooter" : "meleeGrunt");
      
      // Check for banished (invisible)
      if (e.banishedUntil && time < e.banishedUntil) {
        // Draw subtle outline only
        ctx2d.save();
        ctx2d.globalAlpha = 0.2;
        ctx2d.strokeStyle = "#8888ff";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, 10 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.restore();
        continue; // Skip normal drawing when banished
      }
      
      // Check for stealth (enemies invisible to player)
      const isStealthed = e.stealthUntil && time < e.stealthUntil;
      if (isStealthed) {
        // If enemy is stealthed, player cannot see them (skip drawing)
        // Note: This is different from player stealth, where player is always visible but semi-transparent
        continue;
      }
      
      // Check for polymorph (transform visual)
      const isPolymorphed = e.polymorphUntil && time < e.polymorphUntil;
      const polymorphForm = e.polymorphForm || "sheep";
      
      ctx2d.save();
      if (isPolymorphed) {
        // Draw polymorph form (simplified: smaller, different color)
        ctx2d.globalAlpha = 0.7;
        ctx2d.fillStyle = polymorphForm === "sheep" ? "#ffffff" : polymorphForm === "frog" ? "#88ff88" : "#ffaa88";
        const polyR = 6 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, polyR, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.globalAlpha = 1.0;
        ctx2d.restore();
        continue; // Skip normal monster drawing when polymorphed
      }
      
      // Check for sleep (draw zzz)
      if (e.sleepUntil && time < e.sleepUntil) {
        ctx2d.save();
        ctx2d.globalAlpha = 0.8;
        ctx2d.fillStyle = "#ffff00";
        ctx2d.font = `${12 * devicePixelRatio}px monospace`;
        ctx2d.textAlign = "center";
        ctx2d.fillText("Zzz", p.x, p.y - 20 * devicePixelRatio);
        ctx2d.restore();
      }
      
      // Check for ground (draw on ground)
      if (e.groundUntil && time < e.groundUntil) {
        ctx2d.save();
        ctx2d.globalAlpha = 0.5;
        ctx2d.fillStyle = "#888888";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y + 5 * devicePixelRatio, 8 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.restore();
      }
      
      if (isFlashing) {
        ctx2d.globalAlpha = 0.3;
        ctx2d.fillStyle = "#ffffff";
        const flashR = (protoName === "eliteBrute" ? 14 : protoName === "rangedShooter" ? 8 : 10) * devicePixelRatio;
        if (protoName === "rangedShooter") {
          const w = 8 * devicePixelRatio;
          const h = 16 * devicePixelRatio;
          ctx2d.fillRect(p.x - w / 2, p.y - h / 2, w, h);
        } else {
          ctx2d.beginPath();
          ctx2d.arc(p.x, p.y, flashR, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.globalAlpha = 1.0;
      }
      
      // 根据怪物类型绘制不同的形象
      if (protoName === "meleeGrunt") {
        // 近战小怪：红色小恶魔
        const r = 10 * devicePixelRatio;
        ctx2d.save();
        
        // 身体（红色圆形）
        ctx2d.fillStyle = "#ff5a7a";
        ctx2d.strokeStyle = "#8b1a2a";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.stroke();
        
        // 眼睛（两个小点）
        ctx2d.fillStyle = "#ffffff";
        ctx2d.beginPath();
        ctx2d.arc(p.x - 3 * devicePixelRatio, p.y - 2 * devicePixelRatio, 2 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.beginPath();
        ctx2d.arc(p.x + 3 * devicePixelRatio, p.y - 2 * devicePixelRatio, 2 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        
        // 嘴巴（锯齿状）
        ctx2d.strokeStyle = "#8b1a2a";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.moveTo(p.x - 4 * devicePixelRatio, p.y + 3 * devicePixelRatio);
        ctx2d.lineTo(p.x - 2 * devicePixelRatio, p.y + 5 * devicePixelRatio);
        ctx2d.lineTo(p.x, p.y + 3 * devicePixelRatio);
        ctx2d.lineTo(p.x + 2 * devicePixelRatio, p.y + 5 * devicePixelRatio);
        ctx2d.lineTo(p.x + 4 * devicePixelRatio, p.y + 3 * devicePixelRatio);
        ctx2d.stroke();
        
        // 手臂（指向玩家）
        const player = world.entities.player;
        if (player && player.alive !== false) {
          const dx = (player.position.x || 0) - (e.position.x || 0);
          const dy = (player.position.y || 0) - (e.position.y || 0);
          const dist = Math.hypot(dx, dy) || 1;
          const angle = Math.atan2(dy, dx);
          ctx2d.strokeStyle = "#8b1a2a";
          ctx2d.lineWidth = 3 * devicePixelRatio;
          ctx2d.beginPath();
          ctx2d.moveTo(p.x + Math.cos(angle + Math.PI / 4) * r * 0.7, p.y + Math.sin(angle + Math.PI / 4) * r * 0.7);
          ctx2d.lineTo(p.x + Math.cos(angle) * r * 1.5, p.y + Math.sin(angle) * r * 1.5);
          ctx2d.stroke();
          ctx2d.beginPath();
          ctx2d.moveTo(p.x + Math.cos(angle - Math.PI / 4) * r * 0.7, p.y + Math.sin(angle - Math.PI / 4) * r * 0.7);
          ctx2d.lineTo(p.x + Math.cos(angle) * r * 1.5, p.y + Math.sin(angle) * r * 1.5);
          ctx2d.stroke();
        }
        
        ctx2d.restore();
      } else if (protoName === "rangedShooter") {
        // 远程射手：蓝色机器人
        const w = 10 * devicePixelRatio;
        const h = 18 * devicePixelRatio;
        ctx2d.save();
        
        // 身体（蓝色矩形）
        ctx2d.fillStyle = "#7a5aff";
        ctx2d.strokeStyle = "#4a2a8b";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        ctx2d.fillRect(p.x - w / 2, p.y - h / 2, w, h);
        ctx2d.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
        
        // 头部（较小的矩形）
        const headH = 6 * devicePixelRatio;
        ctx2d.fillStyle = "#5a3aff";
        ctx2d.fillRect(p.x - w / 2, p.y - h / 2, w, headH);
        
        // 眼睛（两个发光点）
        ctx2d.fillStyle = "#00ffff";
        ctx2d.shadowBlur = 3 * devicePixelRatio;
        ctx2d.shadowColor = "#00ffff";
        ctx2d.beginPath();
        ctx2d.arc(p.x - 2 * devicePixelRatio, p.y - h / 2 + headH / 2, 1.5 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.beginPath();
        ctx2d.arc(p.x + 2 * devicePixelRatio, p.y - h / 2 + headH / 2, 1.5 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.shadowBlur = 0;
        
        // 枪管（指向玩家）
        const player = world.entities.player;
        if (player && player.alive !== false) {
          const dx = (player.position.x || 0) - (e.position.x || 0);
          const dy = (player.position.y || 0) - (e.position.y || 0);
          const dist = Math.hypot(dx, dy) || 1;
          const angle = Math.atan2(dy, dx);
          const barrelLen = 12 * devicePixelRatio;
          ctx2d.strokeStyle = "#2a1a5a";
          ctx2d.lineWidth = 5 * devicePixelRatio;
          ctx2d.lineCap = "round";
          ctx2d.beginPath();
          ctx2d.moveTo(p.x + Math.cos(angle) * h / 2, p.y + Math.sin(angle) * h / 2);
          ctx2d.lineTo(p.x + Math.cos(angle) * (h / 2 + barrelLen), p.y + Math.sin(angle) * (h / 2 + barrelLen));
          ctx2d.stroke();
        }
        
        ctx2d.restore();
      } else if (protoName === "eliteBrute") {
        // 精英怪：大型装甲战士
        const r = 16 * devicePixelRatio;
        ctx2d.save();
        
        // 身体（深红色大圆）
        ctx2d.fillStyle = "#8b1a2a";
        ctx2d.strokeStyle = "#4a0a1a";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.stroke();
        
        // 装甲板（装饰性圆环）
        ctx2d.strokeStyle = "#2a0a0a";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2);
        ctx2d.stroke();
        
        // 眼睛（红色发光）
        ctx2d.fillStyle = "#ff0000";
        ctx2d.shadowBlur = 4 * devicePixelRatio;
        ctx2d.shadowColor = "#ff0000";
        ctx2d.beginPath();
        ctx2d.arc(p.x - 4 * devicePixelRatio, p.y - 4 * devicePixelRatio, 3 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.beginPath();
        ctx2d.arc(p.x + 4 * devicePixelRatio, p.y - 4 * devicePixelRatio, 3 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.shadowBlur = 0;
        
        // 嘴巴（愤怒的线条）
        ctx2d.strokeStyle = "#4a0a1a";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.moveTo(p.x - 6 * devicePixelRatio, p.y + 4 * devicePixelRatio);
        ctx2d.lineTo(p.x + 6 * devicePixelRatio, p.y + 4 * devicePixelRatio);
        ctx2d.stroke();
        
        // 肩膀装甲（两侧）
        ctx2d.fillStyle = "#4a0a1a";
        ctx2d.fillRect(p.x - r * 1.1, p.y - r * 0.3, r * 0.4, r * 0.6);
        ctx2d.fillRect(p.x + r * 0.7, p.y - r * 0.3, r * 0.4, r * 0.6);
        
        ctx2d.restore();
      }
      
      // HP bar for monsters (enhanced visibility on grass background)
      const w = e.id.includes("elite") ? 50 * devicePixelRatio : 40 * devicePixelRatio;
      const h = e.id.includes("elite") ? 8 * devicePixelRatio : 6 * devicePixelRatio;
      const hpPct = Math.max(0, Math.min(1, (e.hp || 0) / (e.maxHp || e.hp || 1)));
      const barX = p.x - w / 2;
      const barY = p.y - 28 * devicePixelRatio;
      
      // Dark background with border for visibility
      ctx2d.fillStyle = "rgba(0,0,0,0.8)";
      ctx2d.fillRect(barX - 2, barY - 2, w + 4, h + 4);
      ctx2d.strokeStyle = "rgba(255,255,255,0.6)";
      ctx2d.lineWidth = 1.5 * devicePixelRatio;
      ctx2d.strokeRect(barX - 2, barY - 2, w + 4, h + 4);
      
      // Empty bar background
      ctx2d.fillStyle = "rgba(100,0,0,0.7)";
      ctx2d.fillRect(barX, barY, w, h);
      
      // HP fill (bright colors for visibility)
      ctx2d.fillStyle = e.id.includes("elite") ? "#ffaa00" : "#7bff8a";
      ctx2d.fillRect(barX, barY, w * hpPct, h);
      
      // Bright border on HP portion
      if (hpPct > 0) {
        ctx2d.strokeStyle = e.id.includes("elite") ? "#ffcc44" : "#9bffab";
        ctx2d.lineWidth = 1 * devicePixelRatio;
        ctx2d.strokeRect(barX, barY, w * hpPct, h);
      }
      
      ctx2d.restore();
    }
  }

  // draw explosion effects (removed - now handled in hit effects section below)

  // draw projectiles
  if (world.projectiles && world.projectiles.length > 0) {
    for (const proj of world.projectiles) {
      if (!proj || !proj.position) continue;
      const p = worldToScreen(proj.position);
      
      // Draw hover effect if active
      if (proj.hover && proj.hover.active) {
        const hoverPos = proj.hover.hoverPosition || proj.position;
        const hoverScreen = worldToScreen(hoverPos);
        const hoverRadius = (proj.hover.hoverRadius || 2) * 45 * devicePixelRatio;
        const hoverDuration = proj.hover.hoverDuration || 2000;
        const hoverAge = time - proj.hover.hoverStartTime;
        const hoverProgress = Math.min(hoverAge / hoverDuration, 1);
        const remainingLife = 1 - hoverProgress;
        
        ctx2d.save();
        
        // Pulsing effect (more pronounced)
        const pulse = Math.sin((time - proj.hover.hoverStartTime) / 80) * 0.3 + 1;
        const drawRadius = hoverRadius * pulse;
        
        // Outer glow ring (largest, most transparent)
        ctx2d.globalAlpha = 0.3 * remainingLife;
        ctx2d.strokeStyle = "#ffaa00";
        ctx2d.lineWidth = 6 * devicePixelRatio;
        ctx2d.shadowBlur = 15 * devicePixelRatio;
        ctx2d.shadowColor = "#ffaa00";
        ctx2d.beginPath();
        ctx2d.arc(hoverScreen.x, hoverScreen.y, drawRadius, 0, Math.PI * 2);
        ctx2d.stroke();
        
        // Middle glow ring
        ctx2d.globalAlpha = 0.5 * remainingLife;
        ctx2d.strokeStyle = "#ffcc44";
        ctx2d.lineWidth = 4 * devicePixelRatio;
        ctx2d.shadowBlur = 10 * devicePixelRatio;
        ctx2d.shadowColor = "#ffcc44";
        ctx2d.beginPath();
        ctx2d.arc(hoverScreen.x, hoverScreen.y, drawRadius * 0.85, 0, Math.PI * 2);
        ctx2d.stroke();
        
        // Inner rotating particles (more visible)
        const particleCount = 12;
        const rotation = (time - proj.hover.hoverStartTime) / 40;
        ctx2d.shadowBlur = 5 * devicePixelRatio;
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2 + rotation;
          const px = hoverScreen.x + Math.cos(angle) * drawRadius * 0.75;
          const py = hoverScreen.y + Math.sin(angle) * drawRadius * 0.75;
          ctx2d.globalAlpha = 0.9 * remainingLife;
          ctx2d.fillStyle = "#ffff00";
          ctx2d.shadowColor = "#ffff00";
          ctx2d.beginPath();
          ctx2d.arc(px, py, 5 * devicePixelRatio, 0, Math.PI * 2);
          ctx2d.fill();
        }
        
        // Center core (brightest)
        ctx2d.globalAlpha = 0.8 * remainingLife * pulse;
        ctx2d.fillStyle = "#ffaa00";
        ctx2d.shadowBlur = 8 * devicePixelRatio;
        ctx2d.shadowColor = "#ffaa00";
        ctx2d.beginPath();
        ctx2d.arc(hoverScreen.x, hoverScreen.y, drawRadius * 0.25, 0, Math.PI * 2);
        ctx2d.fill();
        
        // Inner bright core
        ctx2d.globalAlpha = 1.0 * remainingLife;
        ctx2d.fillStyle = "#ffffff";
        ctx2d.shadowBlur = 4 * devicePixelRatio;
        ctx2d.shadowColor = "#ffffff";
        ctx2d.beginPath();
        ctx2d.arc(hoverScreen.x, hoverScreen.y, drawRadius * 0.15, 0, Math.PI * 2);
        ctx2d.fill();
        
        // Reset shadow
        ctx2d.shadowBlur = 0;
        ctx2d.restore();
      } else {
        // Normal projectile - 根据技能性格应用不同的视觉风格
        const r = Math.max(6, (proj.radius || 0.3) * 45) * devicePixelRatio; // Make projectiles more visible (min 6px)
        ctx2d.save();
        
        // 获取技能性格（从currentTemplate或currentAssembly）
        let personalityColor = "#ffd700"; // 默认金色
        let personalityGlow = "#ffd700";
        let personalityBorder = "#ff8800";
        
        if (currentTemplate && currentTemplate._personality) {
          const personality = SKILL_PERSONALITIES[currentTemplate._personality];
          if (personality && personality.visualStyle) {
            personalityColor = personality.visualStyle.color || personalityColor;
            personalityGlow = personality.visualStyle.color || personalityGlow;
            // 根据颜色调整边框颜色（稍微暗一点）
            const colorMatch = personalityColor.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
            if (colorMatch) {
              const r = parseInt(colorMatch[1], 16);
              const g = parseInt(colorMatch[2], 16);
              const b = parseInt(colorMatch[3], 16);
              personalityBorder = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`;
            }
          }
        }
        
        // Glow effect
        ctx2d.shadowBlur = 10 * devicePixelRatio;
        ctx2d.shadowColor = personalityGlow;
        ctx2d.fillStyle = personalityColor;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx2d.fill();
        // Border
        ctx2d.strokeStyle = personalityBorder;
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.stroke();
        // Inner highlight
        ctx2d.fillStyle = "#ffffff";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.restore();
      }
    }
  }

  // draw beams
  if (world.beams && world.beams.length > 0) {
    for (const beam of world.beams) {
      if (!beam || !beam.start || !beam.end) continue;
      const startScreen = worldToScreen(beam.start);
      const endScreen = worldToScreen(beam.end);
      // 确保光束宽度足够可见（至少8像素）
      const beamWidth = Math.max(beam.width * 45 * devicePixelRatio, 8 * devicePixelRatio);
      const beamAge = time - beam.createdAt;
      const beamProgress = Math.min(beamAge / beam.duration, 1);
      const remainingLife = 1 - beamProgress;
      
      ctx2d.save();
      
      // Outer glow (largest, most transparent) - 青色外圈
      ctx2d.globalAlpha = 0.5 * remainingLife;
      ctx2d.strokeStyle = "#3ce7ff";
      ctx2d.lineWidth = beamWidth * 4;
      ctx2d.shadowBlur = 40 * devicePixelRatio;
      ctx2d.shadowColor = "#3ce7ff";
      ctx2d.lineCap = "round";
      ctx2d.beginPath();
      ctx2d.moveTo(startScreen.x, startScreen.y);
      ctx2d.lineTo(endScreen.x, endScreen.y);
      ctx2d.stroke();
      
      // Middle glow - 亮青色中层
      ctx2d.globalAlpha = 0.8 * remainingLife;
      ctx2d.strokeStyle = "#5ddfff";
      ctx2d.lineWidth = beamWidth * 2.5;
      ctx2d.shadowBlur = 25 * devicePixelRatio;
      ctx2d.shadowColor = "#5ddfff";
      ctx2d.beginPath();
      ctx2d.moveTo(startScreen.x, startScreen.y);
      ctx2d.lineTo(endScreen.x, endScreen.y);
      ctx2d.stroke();
      
      // Beam core (brightest white) - 白色核心，带脉冲效果
      const pulse = Math.sin((time - beam.createdAt) / 100) * 0.15 + 1;
      ctx2d.globalAlpha = 1.0 * remainingLife * pulse;
      ctx2d.strokeStyle = "#ffffff";
      ctx2d.lineWidth = beamWidth * 1.5;
      ctx2d.shadowBlur = 20 * devicePixelRatio;
      ctx2d.shadowColor = "#ffffff";
      ctx2d.beginPath();
      ctx2d.moveTo(startScreen.x, startScreen.y);
      ctx2d.lineTo(endScreen.x, endScreen.y);
      ctx2d.stroke();
      
      // Inner bright line - 最亮的内部线条
      ctx2d.globalAlpha = 1.0 * remainingLife;
      ctx2d.strokeStyle = "#ffffff";
      ctx2d.lineWidth = beamWidth * 0.8;
      ctx2d.shadowBlur = 10 * devicePixelRatio;
      ctx2d.shadowColor = "#ffffff";
      ctx2d.beginPath();
      ctx2d.moveTo(startScreen.x, startScreen.y);
      ctx2d.lineTo(endScreen.x, endScreen.y);
      ctx2d.stroke();
      
      // Additional bright core line for maximum visibility - 最亮的核心线条
      ctx2d.globalAlpha = 1.0 * remainingLife;
      ctx2d.strokeStyle = "#ffffff";
      ctx2d.lineWidth = beamWidth * 0.6;
      ctx2d.shadowBlur = 15 * devicePixelRatio;
      ctx2d.shadowColor = "#ffffff";
      ctx2d.beginPath();
      ctx2d.moveTo(startScreen.x, startScreen.y);
      ctx2d.lineTo(endScreen.x, endScreen.y);
      ctx2d.stroke();
      
      // Reset shadow
      ctx2d.shadowBlur = 0;
      ctx2d.restore();
    }
  }
  
  // draw area effects (DoT zones)
  if (world.areaEffects && world.areaEffects.length > 0) {
    for (const area of world.areaEffects) {
      const p = worldToScreen(area.position);
      const radius = area.radius * 45 * devicePixelRatio;
      const age = time - area.createdAt;
      const remaining = area.expiresAt - time;
      const progress = 1 - remaining / (area.expiresAt - area.createdAt);
      
      ctx2d.save();
      // Pulsing effect
      const pulse = Math.sin((time - area.createdAt) / 200) * 0.1 + 1;
      const drawRadius = radius * pulse;
      
      // Outer glow
      ctx2d.globalAlpha = 0.3 * (1 - progress);
      ctx2d.fillStyle = "#ff5a7a";
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);
      ctx2d.fill();
      
      // Inner area
      ctx2d.globalAlpha = 0.2 * (1 - progress);
      ctx2d.fillStyle = "#ff5a7a";
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, drawRadius * 0.7, 0, Math.PI * 2);
      ctx2d.fill();
      
      // Border
      ctx2d.globalAlpha = 0.6 * (1 - progress);
      ctx2d.strokeStyle = "#ff5a7a";
      ctx2d.lineWidth = 2 * devicePixelRatio;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);
      ctx2d.stroke();
      
      ctx2d.restore();
    }
  }

  // draw hit effects (flash + damage numbers + explosions)
  if (world.hitEffects) {
    const toRemove = [];
    for (let i = 0; i < world.hitEffects.length; i++) {
      const effect = world.hitEffects[i];
      const age = time - effect.createdAt;
      if (age > effect.duration) {
        toRemove.push(i);
        continue;
      }
      const p = worldToScreen(effect.position);
      const alpha = 1 - age / effect.duration;
      
      // Explosion effect (enhanced visual)
      if (effect.type === "explosion") {
        const progress = age / effect.duration;
        const maxRadius = (effect.radius || 2.5) * 45 * devicePixelRatio;
        const radius = maxRadius * progress; // Expand from 0 to maxRadius
        
        ctx2d.save();
        
        // Outer expanding ring (bright orange/yellow)
        ctx2d.globalAlpha = alpha * 0.9;
        ctx2d.strokeStyle = "#ff6600";
        ctx2d.fillStyle = "rgba(255,100,0,0.4)";
        ctx2d.lineWidth = 5 * devicePixelRatio;
        ctx2d.shadowBlur = 15 * devicePixelRatio;
        ctx2d.shadowColor = "#ff6600";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.stroke();
        
        // Middle ring (yellow)
        ctx2d.globalAlpha = alpha * 0.7;
        ctx2d.strokeStyle = "#ffaa00";
        ctx2d.fillStyle = "rgba(255,170,0,0.3)";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.shadowBlur = 10 * devicePixelRatio;
        ctx2d.shadowColor = "#ffaa00";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius * 0.7, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.stroke();
        
        // Inner core (bright white)
        ctx2d.globalAlpha = alpha * 0.8;
        ctx2d.fillStyle = "rgba(255,255,255,0.8)";
        ctx2d.shadowBlur = 20 * devicePixelRatio;
        ctx2d.shadowColor = "#ffffff";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius * 0.3, 0, Math.PI * 2);
        ctx2d.fill();
        
        // Particles (small dots radiating outward)
        ctx2d.globalAlpha = alpha * 0.6;
        ctx2d.fillStyle = "#ffaa00";
        ctx2d.shadowBlur = 0;
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2;
          const particleDist = radius * 0.8;
          const particleX = p.x + Math.cos(angle) * particleDist;
          const particleY = p.y + Math.sin(angle) * particleDist;
          ctx2d.beginPath();
          ctx2d.arc(particleX, particleY, 3 * devicePixelRatio, 0, Math.PI * 2);
          ctx2d.fill();
        }
        
        ctx2d.restore();
        continue;
      }
      
      // Area tick effect (subtle flash)
      if (effect.type === "areaTick") {
        if (age < 50) {
          ctx2d.save();
          ctx2d.globalAlpha = alpha * 0.4;
          ctx2d.fillStyle = "#ff5a7a";
          ctx2d.beginPath();
          ctx2d.arc(p.x, p.y, 8 * devicePixelRatio, 0, Math.PI * 2);
          ctx2d.fill();
          ctx2d.restore();
        }
        continue;
      }
      
      // Heal effect (green, upward)
      if (effect.type === "heal") {
        const offsetY = -20 - (age / effect.duration) * 30;
        ctx2d.save();
        ctx2d.globalAlpha = alpha;
        ctx2d.fillStyle = "#7bff8a";
        ctx2d.font = `bold ${14 * devicePixelRatio}px monospace`;
        ctx2d.textAlign = "center";
        ctx2d.strokeStyle = "rgba(0,0,0,0.8)";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        const healText = `+${Math.floor(-effect.damage)}`; // damage is negative for heal
        ctx2d.strokeText(healText, p.x, p.y + offsetY);
        ctx2d.fillText(healText, p.x, p.y + offsetY);
        ctx2d.restore();
        continue;
      }
      
      // True damage effect (white/purple)
      if (effect.type === "trueDamage") {
        const offsetY = -20 - (age / effect.duration) * 30;
        ctx2d.save();
        ctx2d.globalAlpha = alpha;
        ctx2d.fillStyle = "#ffffff";
        ctx2d.font = `bold ${16 * devicePixelRatio}px monospace`;
        ctx2d.textAlign = "center";
        ctx2d.strokeStyle = "#9b00ff";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        const trueDmgText = Math.floor(effect.damage).toString();
        ctx2d.strokeText(trueDmgText, p.x, p.y + offsetY);
        ctx2d.fillText(trueDmgText, p.x, p.y + offsetY);
        ctx2d.restore();
        continue;
      }
      
      // Shield absorption effect (cyan/blue)
      if (effect.type === "shield") {
        const offsetY = -20 - (age / effect.duration) * 30;
        ctx2d.save();
        ctx2d.globalAlpha = alpha;
        ctx2d.fillStyle = "#3ce7ff";
        ctx2d.font = `bold ${14 * devicePixelRatio}px monospace`;
        ctx2d.textAlign = "center";
        ctx2d.strokeStyle = "#0066cc";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        const shieldText = `护盾-${Math.floor(-effect.damage)}`; // damage is negative for shield
        ctx2d.strokeText(shieldText, p.x, p.y + offsetY);
        ctx2d.fillText(shieldText, p.x, p.y + offsetY);
        ctx2d.restore();
        continue;
      }
      
      // Knockback effect (visual indicator)
      if (effect.type === "knockback") {
        ctx2d.save();
        ctx2d.globalAlpha = alpha * 0.8;
        ctx2d.strokeStyle = "#ffaa00";
        ctx2d.fillStyle = "#ffaa00";
        ctx2d.lineWidth = 4 * devicePixelRatio;
        // Draw expanding circles (outward push effect)
        const maxRadius = 20 * devicePixelRatio;
        const radius = maxRadius * (age / effect.duration);
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx2d.stroke();
        // Inner circle
        ctx2d.globalAlpha = alpha * 0.4;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2);
        ctx2d.fill();
        // Draw arrow pointing outward
        ctx2d.globalAlpha = alpha;
        ctx2d.strokeStyle = "#ff6600";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.moveTo(p.x, p.y);
        ctx2d.lineTo(p.x + radius * 0.8, p.y);
        ctx2d.lineTo(p.x + radius * 0.6, p.y - radius * 0.2);
        ctx2d.moveTo(p.x + radius * 0.8, p.y);
        ctx2d.lineTo(p.x + radius * 0.6, p.y + radius * 0.2);
        ctx2d.stroke();
        ctx2d.restore();
        continue;
      }
      
      // Pull effect (visual indicator)
      if (effect.type === "pull") {
        ctx2d.save();
        ctx2d.globalAlpha = alpha * 0.8;
        ctx2d.strokeStyle = "#3ce7ff";
        ctx2d.fillStyle = "#3ce7ff";
        ctx2d.lineWidth = 4 * devicePixelRatio;
        // Draw contracting circles (inward pull effect)
        const maxRadius = 20 * devicePixelRatio;
        const radius = maxRadius * (1 - age / effect.duration);
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx2d.stroke();
        // Inner circle
        ctx2d.globalAlpha = alpha * 0.4;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2);
        ctx2d.fill();
        // Draw arrow pointing inward
        ctx2d.globalAlpha = alpha;
        ctx2d.strokeStyle = "#00aaff";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        ctx2d.beginPath();
        ctx2d.moveTo(p.x + radius * 0.8, p.y);
        ctx2d.lineTo(p.x, p.y);
        ctx2d.lineTo(p.x + radius * 0.2, p.y - radius * 0.2);
        ctx2d.moveTo(p.x, p.y);
        ctx2d.lineTo(p.x + radius * 0.2, p.y + radius * 0.2);
        ctx2d.stroke();
        ctx2d.restore();
        continue;
      }
      
      // Execute effect (red flash)
      if (effect.type === "execute") {
        ctx2d.save();
        ctx2d.globalAlpha = alpha * 0.8;
        ctx2d.fillStyle = "#ff0000";
        ctx2d.strokeStyle = "#ffffff";
        ctx2d.lineWidth = 3 * devicePixelRatio;
        const size = 20 * devicePixelRatio * (1 - age / effect.duration);
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.stroke();
        ctx2d.restore();
        continue;
      }
      
      // Crit effect (golden flash)
      if (effect.type === "crit") {
        ctx2d.save();
        ctx2d.globalAlpha = alpha * 0.9;
        ctx2d.fillStyle = "#ffd700";
        ctx2d.strokeStyle = "#ff8800";
        ctx2d.lineWidth = 4 * devicePixelRatio;
        const size = 25 * devicePixelRatio * (1 - age / effect.duration);
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.stroke();
        ctx2d.restore();
        continue;
      }
      
      // Bleed effect (red particles)
      if (effect.type === "bleed") {
        ctx2d.save();
        ctx2d.globalAlpha = alpha * 0.6;
        ctx2d.fillStyle = "#ff0000";
        for (let i = 0; i < 3; i++) {
          const offsetX = (Math.random() - 0.5) * 10 * devicePixelRatio;
          const offsetY = (Math.random() - 0.5) * 10 * devicePixelRatio;
          ctx2d.beginPath();
          ctx2d.arc(p.x + offsetX, p.y + offsetY, 3 * devicePixelRatio, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.restore();
        continue;
      }
      
      // Flash
      if (age < 40) {
        ctx2d.save();
        ctx2d.globalAlpha = alpha * 0.6;
        ctx2d.fillStyle = "#ffffff";
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, 15 * devicePixelRatio, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.restore();
      }
      
      // Damage number (always show for non-explosion, non-areaTick effects)
      if (effect.damage !== undefined && effect.damage > 0 && effect.type !== "areaTick") {
        const offsetY = -20 - (age / effect.duration) * 30;
        ctx2d.save();
        ctx2d.globalAlpha = alpha;
        ctx2d.fillStyle = "#ff5a7a";
        ctx2d.font = `bold ${14 * devicePixelRatio}px monospace`;
        ctx2d.textAlign = "center";
        ctx2d.strokeStyle = "rgba(0,0,0,0.8)";
        ctx2d.lineWidth = 2 * devicePixelRatio;
        const damageText = Math.floor(effect.damage).toString();
        ctx2d.strokeText(damageText, p.x, p.y + offsetY);
        ctx2d.fillText(damageText, p.x, p.y + offsetY);
        ctx2d.restore();
      }
    }
    // Remove expired effects
    for (const idx of toRemove.reverse()) {
      world.hitEffects.splice(idx, 1);
    }
  }

  // draw chain damage lines
  if (world.chainEffects && world.chainEffects.length > 0) {
    const chainToRemove = [];
    for (let i = 0; i < world.chainEffects.length; i++) {
      const chain = world.chainEffects[i];
      const age = time - chain.createdAt;
      if (age > chain.duration) {
        chainToRemove.push(i);
        continue;
      }
      
      // Draw lines between chain targets
      if (chain.targets && chain.targets.length > 1) {
        ctx2d.save();
        const effectType = chain.type || "chain";
        let lineColor = "#ffaa00"; // Default orange for chain
        if (effectType === "bounce") {
          lineColor = "#ff00ff"; // Magenta for bounce
        } else if (effectType === "pierce") {
          lineColor = "#00ffff"; // Cyan for pierce
        }
        ctx2d.strokeStyle = lineColor;
        ctx2d.lineWidth = 2 * devicePixelRatio;
        ctx2d.globalAlpha = 0.6 * (1 - age / chain.duration);
        ctx2d.setLineDash([5 * devicePixelRatio, 5 * devicePixelRatio]);
        
        for (let j = 0; j < chain.targets.length - 1; j++) {
          const t1 = world.entities[chain.targets[j]];
          const t2 = world.entities[chain.targets[j + 1]];
          if (t1 && t2 && t1.position && t2.position) {
            const p1 = worldToScreen(t1.position);
            const p2 = worldToScreen(t2.position);
            ctx2d.beginPath();
            ctx2d.moveTo(p1.x, p1.y);
            ctx2d.lineTo(p2.x, p2.y);
            ctx2d.stroke();
          }
        }
        
        ctx2d.restore();
      }
    }
    
    for (const idx of chainToRemove.reverse()) {
      world.chainEffects.splice(idx, 1);
    }
  }

  // draw telegraphs (monster attack warnings)
  drawTelegraphs();
  
  // draw indicators (during windup)
  const player = world.entities.player;
  if (player?.alive !== false) {
    drawIndicators(player, currentAssembly);
  }

  // draw aim line (always visible when alive)
  if (player?.alive !== false && player.state !== PlayerState.CastWindup) {
    const p = worldToScreen(player.position || { x: 0, y: 0 });
    const end = {
      x: p.x + (player.aimDir?.x || 1) * 80 * devicePixelRatio,
      y: p.y + (player.aimDir?.y || 0) * 80 * devicePixelRatio,
    };
    ctx2d.strokeStyle = "rgba(60,231,255,0.35)";
    ctx2d.lineWidth = 1.5 * devicePixelRatio;
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
  elMaxHp.textContent = Math.floor(player.maxHp || 600);
  elMana.textContent = Math.floor(player.mana || 0);
  elMaxMana.textContent = Math.floor(player.maxMana || 200);
  elPlayerState.textContent = player.state || "Idle";
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
  // apply to combat - include ALL templates for OnDamaged events
  const allAssemblies = [currentAssembly];
  // Also include counter template if it exists
  const counterTemplate = templates.find((t) => t.id === "tpl_counter_v1");
  if (counterTemplate) {
    const counterAssembly = compileAssembly(counterTemplate, counterTemplate.slots.map((s) => s.id), Object.fromEntries(counterTemplate.slots.map((s) => [s.id, s.defaultOption])));
    allAssemblies.push(counterAssembly);
  }
  bus = buildEventBusWithAssemblies(allAssemblies, world);
};

btnSpawn.onclick = () => {
  // 只刷新世界（怪物），不生成随机武器
  // 刷新世界
  world = newWorld();
  world.presentationBus = new (class {
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
  })();
  time = 0;
  // Include counter template for OnDamaged events
  const allAssemblies = [currentAssembly];
  const counterTemplate = templates.find((t) => t.id === "tpl_counter_v1");
  if (counterTemplate) {
    const counterAssembly = compileAssembly(counterTemplate, counterTemplate.slots.map((s) => s.id), Object.fromEntries(counterTemplate.slots.map((s) => [s.id, s.defaultOption])));
    allAssemblies.push(counterAssembly);
  }
  bus = buildEventBusWithAssemblies(allAssemblies, world);
  // Reset player state
  if (world.entities.player) {
    world.entities.player.state = PlayerState.Idle;
    world.entities.player.stateTime = 0;
    world.entities.player.position = { x: 0, y: 0 }; // Ensure position is set
    world.entities.player.alive = true;
  }
  console.log("World reset:", world.entities);
};

if (btnRandomWeapon) {
  btnRandomWeapon.onclick = () => {
    // 只刷新武器，不刷新怪物
    try {
      // 使用更好的随机种子：时间戳 + 随机数
      const seed = Date.now() + Math.floor(Math.random() * 1000000);
      const randomWeapon = generateRandomWeapon(templates, seed);
      currentTemplate = randomWeapon.template || templates.find((t) => t.id === randomWeapon.templateId) || templates[0];
      order = randomWeapon.order;
      slotOptions = randomWeapon.slotOptions;
      isRandomWeapon = true;
      
      // 更新模板选择器显示
      elTemplate.value = currentTemplate.id;
      
      // 重新渲染和编译
      renderSlots();
      rebuildAssembly();
      
      // 立即更新事件总线，使新技能能力生效
      const allAssemblies = [currentAssembly];
      const counterTemplate = templates.find((t) => t.id === "tpl_counter_v1");
      if (counterTemplate) {
        const counterAssembly = compileAssembly(counterTemplate, counterTemplate.slots.map((s) => s.id), Object.fromEntries(counterTemplate.slots.map((s) => [s.id, s.defaultOption])));
        allAssemblies.push(counterAssembly);
      }
      bus = buildEventBusWithAssemblies(allAssemblies, world);
      
      console.log("Random weapon generated:", randomWeapon);
    } catch (e) {
      console.error("Failed to generate random weapon:", e);
    }
  };
}

btnPause.onclick = () => {
  paused = !paused;
  btnPause.textContent = paused ? "继续" : "暂停";
};

// 初始化时生成随机武器
try {
  // 使用更好的随机种子：时间戳 + 随机数
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const randomWeapon = generateRandomWeapon(templates, seed);
  currentTemplate = randomWeapon.template || templates.find((t) => t.id === randomWeapon.templateId) || templates[0];
  order = randomWeapon.order;
  slotOptions = randomWeapon.slotOptions;
  isRandomWeapon = true;
  elTemplate.value = currentTemplate.id;
} catch (e) {
  console.error("Failed to generate initial random weapon:", e);
}

renderSlots();
rebuildAssembly();
updatePreview();
updateBudgetDisplay();

// Ensure canvas is properly initialized before starting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    resize();
    loop();
  });
} else {
  resize();
  loop();
}

