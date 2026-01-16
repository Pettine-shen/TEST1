/**
 * ECA规则池系统
 * 替代固定模板，提供动态技能结构生成的基础
 */

/**
 * 判断动作是否有实际伤害
 * @param {Object} actionRule - 动作规则对象
 * @returns {boolean} 是否有伤害
 */
export function hasDamageTag(actionRule) {
  if (!actionRule) return false;
  
  const kind = actionRule.kind || "";
  
  // 直接伤害类型
  const damageKinds = [
    "Damage",
    "PercentDamage",
    "TrueDamage",
    "ChainDamage",
    "BounceDamage",
    "PierceDamage",
    "SplitDamage",
    "ExecuteDamage",
    "BleedDamage",
    "CritDamage",
    "ReflectDamage",
    "AreaDamage",
  ];
  
  if (damageKinds.includes(kind)) {
    return true;
  }
  
  // 投射物类型（有formula表示有伤害）
  const projectileKinds = [
    "SpawnProjectile",
    "SpawnMultipleProjectiles",
    "SpawnBurstProjectiles",
    "SpawnProjectileWithExplosion",
  ];
  
  if (projectileKinds.includes(kind) && actionRule.formula) {
    return true;
  }
  
  // 光束类型（有tickFormula表示有伤害）
  if (kind === "Beam" && actionRule.tickFormula) {
    return true;
  }
  
  // 区域DoT类型（有tickFormula表示有伤害）
  if (kind === "SpawnAreaDoT" && actionRule.tickFormula) {
    return true;
  }
  
  // Mark动作如果有damageOnHit也算伤害
  if (kind === "Mark" && actionRule.damageOnHit) {
    return true;
  }
  
  return false;
}

/**
 * 复杂度控制系统
 * 通过调整这些系数来控制随机生成技能的复杂度
 */
export const COMPLEXITY_CONFIG = {
  // 整体复杂度系数（0.0 - 1.0）
  // 0.0 = 最简单（最少槽位、最简单动作、最少副效果）
  // 1.0 = 最复杂（最多槽位、最复杂动作、最多副效果）
  overall: 0.75, // 提高复杂度：默认中高复杂度（从0.6提升到0.75）
  
  // 槽位数量系数（影响 minSlots 和 maxSlots）
  slotCount: {
    min: 0.6,  // 提高最小槽位数（从0.5提升到0.6）
    max: 0.85, // 提高最大槽位数（从0.7提升到0.85）
  },
  
  // 动作数量系数（主效果+副效果架构下，主效果已确定，这里主要影响额外动作）
  actionCount: {
    min: 1.0,  // 确保至少1个动作（主效果）
    max: 0.8,  // 提高最大额外动作数（从0.6提升到0.8，允许更多额外动作）
  },
  
  // 条件数量系数
  conditionCount: {
    max: 0.7,  // 提高最大条件数（从0.5提升到0.7，允许更多条件）
  },
  
  // 目标数量系数
  targetCount: {
    max: 0.9,  // 提高最大目标数（从0.7提升到0.9，允许更多目标选择）
  },
  
  // 时间线数量系数
  timelineCount: {
    max: 0.7,  // 提高最大时间线数（从0.5提升到0.7，允许更多时间延迟）
  },
  
  // 副效果数量系数（新增：控制副效果的数量）
  supportModifierCount: {
    min: 0.3,  // 最小副效果数系数（30%概率至少有1个副效果）
    max: 0.9,  // 最大副效果数系数（90%概率最多3个副效果）
  },
  
  // 高风险高回报副效果权重（新增：控制高风险高回报副效果的出现概率）
  highRiskHighRewardWeight: {
    enabled: true,      // 是否启用高风险高回报副效果
    weightMultiplier: 0.8, // 权重倍数（从0.6提升到0.8，提高高风险高回报副效果的出现概率）
  },
  
  // 复杂动作权重（降低复杂动作的出现概率，但在主效果+副效果架构下主要用于额外动作）
  complexActionWeight: {
    beam: 0.5,        // 提高光束权重（从0.3提升到0.5）
    hover: 0.6,       // 提高悬停权重（从0.4提升到0.6）
    chain: 0.7,       // 提高连锁权重（从0.5提升到0.7）
    areaDot: 0.75,    // 提高区域DoT权重（从0.6提升到0.75）
    summon: 0.5,      // 提高召唤权重（从0.3提升到0.5）
    charge: 0.7,      // 提高蓄力权重（从0.5提升到0.7）
    multiProjectile: 0.8, // 提高多投射物权重（从0.7提升到0.8）
  },
};

/**
 * 事件规则池
 * 每个事件定义：id, guards, budgetCap
 */
export const EVENT_RULES = [
  {
    id: "CastConfirm",
    label: "主动释放",
    guards: {},
    budgetCap: { damage: 140, cc: 60, mobility: 0, proc: 40, perf: 50 },
    weight: 0.8, // 80%概率选择主动释放
  },
  {
    id: "OnDamaged",
    label: "受击触发",
    guards: { icdMs: 800, capPerSecond: 2 },
    budgetCap: { damage: 100, cc: 80, mobility: 0, proc: 40, perf: 30 },
    weight: 0.2, // 20%概率选择受击触发
  },
];

/**
 * 条件规则池
 * 从现有模板中提取所有条件选项
 */
export const CONDITION_RULES = [
  // 资源条件
  { id: "mana30", label: "Mana≥30", kind: "HasResource", resource: "mana", amount: 30, budget: {} },
  { id: "mana25", label: "Mana≥25", kind: "HasResource", resource: "mana", amount: 25, budget: {} },
  { id: "mana20", label: "Mana≥20", kind: "HasResource", resource: "mana", amount: 20, budget: {} },
  { id: "mana30_plus", label: "Mana≥30+", kind: "HasResource", resource: "mana", amount: 30, budget: { damage: 3 } },
  { id: "ammo1", label: "Ammo≥1", kind: "HasResource", resource: "ammo", amount: 1, budget: {} },
  { id: "hp80", label: "HP≥80%", kind: "HasResource", resource: "hp", amount: 0.8, budget: {} },
  
  // 距离条件
  { id: "range12", label: "≤12m", kind: "InRange", max: 12, budget: {} },
  { id: "range18", label: "≤18m", kind: "InRange", max: 18, budget: { damage: 5 } },
  { id: "range4", label: "近战≤4m", kind: "InRange", max: 4, budget: {} },
  { id: "range3", label: "近战≤3m", kind: "InRange", max: 3, budget: {} },
  { id: "range5", label: "近战≤5m", kind: "InRange", max: 5, budget: { damage: 3 } },
  
  // 目标类型条件
  { id: "monsterOnly", label: "仅怪物", kind: "TargetType", allow: ["monster"], budget: {} },
  { id: "anyTarget", label: "任意目标", kind: "TargetType", allow: ["monster", "player"], budget: {} },
  
  // 触发概率条件（主要用于OnDamaged事件）
  { id: "proc20", label: "触发20%", kind: "ProcChance", chance: 0.2, budget: { proc: 10 } },
  { id: "proc35", label: "触发35%", kind: "ProcChance", chance: 0.35, budget: { proc: 20 } },
];

/**
 * 目标规则池
 */
export const TARGET_RULES = [
  { id: "single", label: "单体", kind: "singleNearest", budget: {}, presentation: { indicatorShape: "line", indicatorSize: { range: 12 } } },
  { id: "line", label: "直线", kind: "singleNearest", budget: {}, presentation: { indicatorShape: "line", indicatorSize: { range: 12 } } },
  { id: "coneS", label: "小扇", kind: "cone", range: 10, max: 3, budget: { perf: 4 }, presentation: { indicatorShape: "cone", indicatorSize: { range: 10, angle: 60 } } },
  { id: "coneW", label: "大扇", kind: "cone", range: 12, max: 5, budget: { perf: 8 }, presentation: { indicatorShape: "cone", indicatorSize: { range: 12, angle: 90 } } },
  { id: "allRange", label: "范围内所有", kind: "allInRange", range: 8, maxCount: 10, budget: { perf: 8 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 8 } } },
  { id: "lowestHp", label: "最低生命", kind: "lowestHealth", range: 12, count: 1, budget: { perf: 6 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 12 } } },
  { id: "nearest3", label: "最近3个", kind: "allInRange", range: 8, maxCount: 3, budget: { perf: 6 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 8 } } },
  { id: "r3", label: "半径3", kind: "circle", radius: 3, budget: { perf: 8 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 3 } } },
  { id: "r4", label: "半径4", kind: "circle", radius: 4, budget: { perf: 12 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 4 } } },
];

/**
 * 动作规则池
 * 从现有模板中提取所有动作选项
 */
export const ACTION_RULES = [
  // 投射物动作
  {
    id: "proj_fast",
    label: "快弹",
    kind: "SpawnProjectile",
    formula: { scale: 0.45, flat: 16 },
    budget: { damage: 18, perf: 6 },
    presentation: { windupMs: 100, projectileSpeed: 20 },
  },
  {
    id: "proj_pierce",
    label: "穿1",
    kind: "SpawnProjectile",
    formula: { scale: 0.6, flat: 20 },
    budget: { damage: 24, perf: 10 },
    presentation: { windupMs: 150, projectileSpeed: 14 },
  },
  {
    id: "proj_slow",
    label: "慢弹",
    kind: "SpawnProjectile",
    formula: { scale: 1.3, flat: 46 },
    budget: { damage: 45, perf: 6 },
    presentation: { windupMs: 400, projectileSpeed: 8 },
  },
  {
    id: "proj_scatter3",
    label: "3弹散射",
    kind: "SpawnMultipleProjectiles",
    count: 3,
    spreadAngle: 45,
    spreadType: "fan",
    formula: { scale: 0.4, flat: 14 },
    budget: { damage: 42, perf: 12 },
    presentation: { windupMs: 200, projectileSpeed: 12 },
  },
  {
    id: "proj_scatter5",
    label: "5弹散射",
    kind: "SpawnMultipleProjectiles",
    count: 5,
    spreadAngle: 60,
    spreadType: "fan",
    formula: { scale: 0.35, flat: 12 },
    budget: { damage: 60, perf: 18 },
    presentation: { windupMs: 200, projectileSpeed: 12 },
  },
  {
    id: "proj_burst3",
    label: "3连发",
    kind: "SpawnBurstProjectiles",
    count: 3,
    burstDelay: 150,
    formula: { scale: 0.5, flat: 18 },
    budget: { damage: 54, perf: 15 },
    presentation: { windupMs: 200, projectileSpeed: 14 },
  },
  {
    id: "proj_explosive",
    label: "爆炸弹",
    kind: "SpawnProjectileWithExplosion",
    formula: { scale: 0.4, flat: 12 },
    explosionFormula: { scale: 1.5, flat: 55 },
    explosionRadius: 2.5,
    explosionDelay: 1000,
    explosionType: "time",
    budget: { damage: 85, perf: 18 },
    presentation: { windupMs: 250, projectileSpeed: 10 },
  },
  {
    id: "proj_hover",
    label: "悬停弹",
    kind: "SpawnProjectile",
    formula: { scale: 0.5, flat: 15 },
    hover: { hoverDuration: 2000, hoverRadius: 2, tickInterval: 200, tickFormula: { scale: 0.3, flat: 10 }, hoverType: "position" },
    budget: { damage: 45, perf: 15 },
    presentation: { windupMs: 200, projectileSpeed: 12 },
  },
  {
    id: "proj_hover_long",
    label: "长悬停弹",
    kind: "SpawnProjectile",
    formula: { scale: 0.4, flat: 12 },
    hover: { hoverDuration: 3000, hoverRadius: 2.5, tickInterval: 150, tickFormula: { scale: 0.25, flat: 8 }, hoverType: "position" },
    budget: { damage: 50, perf: 18 },
    presentation: { windupMs: 250, projectileSpeed: 10 },
  },
  {
    id: "beam_short",
    label: "短光束",
    kind: "Beam",
    beamLength: 12,
    beamWidth: 1,
    beamDuration: 1500,
    tickInterval: 100,
    tickFormula: { scale: 0.35, flat: 12 },
    pierceCount: -1,
    canRotate: false,
    budget: { damage: 45, perf: 20 },
    presentation: { windupMs: 200 },
  },
  {
    id: "beam_long",
    label: "长光束",
    kind: "Beam",
    beamLength: 18,
    beamWidth: 1.5,
    beamDuration: 2500,
    tickInterval: 80,
    tickFormula: { scale: 0.4, flat: 15 },
    pierceCount: -1,
    canRotate: false,
    budget: { damage: 60, perf: 25 },
    presentation: { windupMs: 300 },
  },
  
  // 直接伤害动作
  { id: "dmg_mid", label: "中伤", kind: "Damage", formula: { scale: 0.7, flat: 25 }, budget: { damage: 25 } },
  { id: "dmg_high", label: "高伤", kind: "Damage", formula: { scale: 0.9, flat: 35 }, budget: { damage: 35 } },
  { id: "dmg_light", label: "轻伤", kind: "Damage", formula: { scale: 0.4, flat: 10 }, budget: { damage: 12 } },
  { id: "cone_hit", label: "扇形高伤", kind: "Damage", formula: { scale: 1.1, flat: 25 }, budget: { damage: 40 } },
  { id: "line_thrust", label: "直线穿1", kind: "Damage", formula: { scale: 1.0, flat: 22 }, budget: { damage: 36 } },
  
  // 特殊伤害类型
  { id: "percent5", label: "5%最大生命", kind: "PercentDamage", percent: 0.05, flat: 0, budget: { damage: 30 } },
  { id: "percent8", label: "8%最大生命", kind: "PercentDamage", percent: 0.08, flat: 0, budget: { damage: 40 } },
  { id: "percent6", label: "6%最大生命", kind: "PercentDamage", percent: 0.06, flat: 0, budget: { damage: 35 } },
  { id: "true_dmg", label: "真实伤害", kind: "TrueDamage", formula: { scale: 0.5, flat: 30 }, budget: { damage: 35 } },
  { id: "chain3", label: "3次连锁", kind: "ChainDamage", formula: { scale: 0.6, flat: 20 }, chainCount: 3, chainRange: 4, damageDecay: 0.8, budget: { damage: 40, perf: 10 } },
  { id: "chain2", label: "2次连锁", kind: "ChainDamage", formula: { scale: 0.5, flat: 15 }, chainCount: 2, chainRange: 3, damageDecay: 0.85, budget: { damage: 30, perf: 8 } },
  { id: "bounce3", label: "3次弹射", kind: "BounceDamage", formula: { scale: 0.7, flat: 25 }, bounceCount: 3, bounceRange: 4, damageDecay: 0.8, canBounceSelf: false, budget: { damage: 45, perf: 12 } },
  { id: "pierce3", label: "穿透3个", kind: "PierceDamage", formula: { scale: 0.65, flat: 22 }, pierceCount: 3, damageDecay: 0.9, pierceWidth: 0.5, budget: { damage: 35, perf: 8 } },
  { id: "reflect20", label: "反弹20%", kind: "ReflectDamage", reflectPercent: 0.2, durationMs: 3000, maxReflect: 500, budget: { damage: 30, cc: 15 } },
  { id: "split3", label: "分裂3弹", kind: "SplitDamage", formula: { scale: 0.6, flat: 20 }, splitCount: 3, splitAngle: 60, damageDecay: 0.7, projectileSpeed: 10, budget: { damage: 50, perf: 15 } },
  { id: "execute", label: "处决伤害", kind: "ExecuteDamage", baseFormula: { scale: 0.8, flat: 30 }, executeThreshold: 0.3, executeMultiplier: 2.0, budget: { damage: 40 } },
  { id: "bleed", label: "流血3s", kind: "BleedDamage", tickFormula: { scale: 0.2, flat: 8 }, durationMs: 3000, tickIntervalMs: 500, maxStacks: 3, budget: { damage: 30, perf: 8 } },
  { id: "crit25", label: "25%暴击", kind: "CritDamage", formula: { scale: 0.7, flat: 25 }, critChance: 0.25, critMultiplier: 2.0, budget: { damage: 35, proc: 15 } },
  
  // 投射物修饰动作
  { id: "homing", label: "追踪弹", kind: "SpawnProjectile", formula: { scale: 0.6, flat: 22 }, homing: { turnRate: 0.15, loseTargetRange: 10 }, budget: { damage: 30, perf: 8 }, presentation: { projectileSpeed: 8 } },
  { id: "ricochet3", label: "弹跳3次", kind: "SpawnProjectile", formula: { scale: 0.65, flat: 24 }, ricochet: { bounceCount: 3, bounceRange: 4, damageDecay: 0.8 }, budget: { damage: 40, perf: 12 }, presentation: { projectileSpeed: 12 } },
  { id: "spiral", label: "螺旋弹", kind: "SpawnProjectile", formula: { scale: 0.7, flat: 26 }, spiral: { spiralRadius: 0.5, spiralSpeed: 5, turns: 2 }, budget: { damage: 32, perf: 10 }, presentation: { projectileSpeed: 10 } },
  { id: "orbit3", label: "环绕3弹", kind: "SpawnProjectile", formula: { scale: 0.5, flat: 18 }, orbit: { orbitRadius: 3, orbitSpeed: 2, orbitCount: 3, durationMs: 5000 }, budget: { damage: 35, perf: 15 }, presentation: { projectileSpeed: 0 } },
  { id: "return", label: "回旋弹", kind: "SpawnProjectile", formula: { scale: 0.6, flat: 20 }, return: { maxDistance: 8, returnSpeed: 8, returnDamage: true }, budget: { damage: 30, perf: 8 }, presentation: { projectileSpeed: 10 } },
  
  // 移动动作
  { id: "dash_none", label: "无位移", kind: "Dash", distance: 0, speed: 15, budget: {} },
  { id: "dash5", label: "突进5m", kind: "Dash", distance: 5, speed: 15, budget: { mobility: 20 }, presentation: { indicatorShape: "dash", indicatorSize: { distance: 5 } } },
  { id: "blink5", label: "闪现5m", kind: "Blink", distance: 5, canPassWall: false, budget: { mobility: 25 }, presentation: { indicatorShape: "dash", indicatorSize: { distance: 5 } } },
  { id: "jump5", label: "跳跃5m", kind: "Jump", distance: 5, height: 2, duration: 500, landDamage: null, budget: { mobility: 30 }, presentation: { indicatorShape: "dash", indicatorSize: { distance: 5 } } },
  { id: "pull3", label: "拉回3m", kind: "Pull", distance: 3, speed: 10, budget: { cc: 20, mobility: 15 } },
  
  // 区域效果动作
  { id: "area4s", label: "4s DoT", kind: "SpawnAreaDoT", tickFormula: { scale: 0.2, flat: 7 }, radius: 3, durationMs: 4000, tickIntervalMs: 500, budget: { damage: 28, perf: 10 } },
  { id: "area6s", label: "6s DoT", kind: "SpawnAreaDoT", tickFormula: { scale: 0.3, flat: 9 }, radius: 3, durationMs: 6000, tickIntervalMs: 500, budget: { damage: 35, perf: 14 } },
  { id: "pulse", label: "3m脉冲", kind: "SpawnAreaDoT", tickFormula: { scale: 0.4, flat: 10 }, radius: 3, durationMs: 2000, tickIntervalMs: 500, budget: { damage: 18, perf: 6 } },
  { id: "pulse_small", label: "2m脉冲", kind: "SpawnAreaDoT", tickFormula: { scale: 0.5, flat: 12 }, radius: 2, durationMs: 1500, tickIntervalMs: 400, budget: { damage: 15, perf: 5 } },
  { id: "pulse_large", label: "4m脉冲", kind: "SpawnAreaDoT", tickFormula: { scale: 0.35, flat: 8 }, radius: 4, durationMs: 2500, tickIntervalMs: 600, budget: { damage: 22, perf: 8 } },
  { id: "knockback_pulse", label: "击退脉冲", kind: "SpawnAreaDoT", tickFormula: { scale: 0.3, flat: 8 }, radius: 3, durationMs: 2000, tickIntervalMs: 500, budget: { damage: 16, perf: 6 }, debuff: { kind: "knockback", power: 1.0, durationMs: 200, moveSpeed: 4 } },
  
  // 控制动作（Debuff）
  { id: "slow_light", label: "减速20% 1.2s", kind: "Debuff", debuff: { kind: "slow", power: 0.2, durationMs: 1200 }, budget: { cc: 8 } },
  { id: "slow15", label: "减速15%", kind: "Debuff", debuff: { kind: "slow", power: 0.15, durationMs: 4000 }, budget: { cc: 8 } },
  { id: "slow", label: "减速40% 1.5s", kind: "Debuff", debuff: { kind: "slow", power: 0.4, durationMs: 1500 }, budget: { cc: 12 } },
  { id: "vuln10", label: "易伤10% 2s", kind: "Debuff", debuff: { kind: "vulnerable", power: 0.1, durationMs: 2000 }, budget: { damage: 8 } },
  { id: "root_short", label: "定身0.8s", kind: "Debuff", debuff: { kind: "root", power: 1.0, durationMs: 800 }, budget: { cc: 18 } },
  { id: "root", label: "定身1s", kind: "Debuff", debuff: { kind: "root", power: 1.0, durationMs: 1000 }, budget: { cc: 18 } },
  { id: "disarm_short", label: "缴械1s", kind: "Debuff", debuff: { kind: "disarm", power: 1.0, durationMs: 1000 }, budget: { cc: 20 } },
  { id: "disarm", label: "缴械1.2s", kind: "Debuff", debuff: { kind: "disarm", power: 1.0, durationMs: 1200 }, budget: { cc: 20 } },
  { id: "silence", label: "沉默0.6s", kind: "Debuff", debuff: { kind: "silence", power: 1, durationMs: 600 }, budget: { cc: 22 } },
  { id: "fear_short", label: "恐惧1.5s", kind: "Debuff", debuff: { kind: "fear", power: 1.0, durationMs: 1500, moveSpeed: 2 }, budget: { cc: 28 } },
  { id: "charm_short", label: "魅惑1.2s", kind: "Debuff", debuff: { kind: "charm", power: 1.0, durationMs: 1200, moveSpeed: 2 }, budget: { cc: 30 } },
  { id: "polymorph", label: "变形2s", kind: "Debuff", debuff: { kind: "polymorph", power: 1.0, durationMs: 2000, form: "sheep" }, budget: { cc: 35 } },
  { id: "taunt", label: "嘲讽2s", kind: "Debuff", debuff: { kind: "taunt", power: 1.0, durationMs: 2000 }, budget: { cc: 25 } },
  { id: "blind", label: "致盲1.5s", kind: "Debuff", debuff: { kind: "blind", power: 1.0, durationMs: 1500, missChance: 0.5 }, budget: { cc: 20 } },
  { id: "suppress", label: "压制1s", kind: "Debuff", debuff: { kind: "suppress", power: 1.0, durationMs: 1000 }, budget: { cc: 40 } },
  { id: "sleep", label: "睡眠2s", kind: "Debuff", debuff: { kind: "sleep", power: 1.0, durationMs: 2000, wakeOnDamage: true, healRate: 5 }, budget: { cc: 25 } },
  { id: "ground", label: "击倒1.5s", kind: "Debuff", debuff: { kind: "ground", power: 1.0, durationMs: 1500 }, budget: { cc: 30 } },
  { id: "banished", label: "放逐2s", kind: "Debuff", debuff: { kind: "banished", power: 1.0, durationMs: 2000 }, budget: { cc: 35 } },
  { id: "immunity", label: "免疫3s", kind: "Debuff", debuff: { kind: "immunity", power: 1.0, durationMs: 3000, immunityType: "all" }, budget: { cc: 30 } },
  { id: "invulnerable", label: "无敌1s", kind: "Debuff", debuff: { kind: "invulnerable", power: 1.0, durationMs: 1000 }, budget: { cc: 40 } },
  { id: "cleanse", label: "净化", kind: "Debuff", debuff: { kind: "cleanse", power: 1.0, durationMs: 0, removeTypes: ["slow", "stun", "root", "disarm"], immunityDuration: 1000 }, budget: { cc: 25 } },
  { id: "stealth", label: "隐身3s", kind: "Debuff", debuff: { kind: "stealth", power: 1.0, durationMs: 3000, revealOnAttack: true, revealOnDamage: true, revealRange: 3 }, budget: { cc: 30 } },
  { id: "haste", label: "急速3s", kind: "Debuff", debuff: { kind: "haste", power: 1.0, durationMs: 3000, speedBoost: 0.5, attackSpeedBoost: 0.3 }, budget: { cc: 20 } },
  { id: "knockback", label: "击退1.5m", kind: "Debuff", debuff: { kind: "knockback", power: 1.5, durationMs: 300, moveSpeed: 5 }, budget: { cc: 15 } },
  { id: "ministun", label: "小眩0.4s", kind: "Debuff", debuff: { kind: "stun", power: 0.4, durationMs: 400 }, budget: { cc: 22 } },
  { id: "healcut", label: "治疗-10%", kind: "Debuff", debuff: { kind: "antiHeal", power: 0.1, durationMs: 4000 }, budget: { cc: 6 } },
  { id: "berserk", label: "狂暴自易伤", kind: "Debuff", debuff: { kind: "selfVuln", power: 0.1, durationMs: 4000 }, budget: { damage: 10 } },
  { id: "shield", label: "护盾200", kind: "Debuff", debuff: { kind: "shield", power: 200, durationMs: 3000 }, budget: { cc: 5 } },
  { id: "overheat", label: "自减速20% 1.2s", kind: "Debuff", debuff: { kind: "selfSlow", power: 0.2, durationMs: 1200 }, budget: { mobility: -5 } },
  { id: "selfroot", label: "自定身0.5s", kind: "Debuff", debuff: { kind: "selfRoot", power: 1, durationMs: 500 }, budget: { mobility: -8 } },
  
  // 增益动作（Buff/Heal）
  { id: "heal_light", label: "轻治疗", kind: "Heal", formula: { scale: 0.3, flat: 50 }, isPercent: false, budget: { cc: 15 } },
  { id: "atk_boost20", label: "攻击+20% 5s", kind: "Buff", buff: { kind: "atkBoost", power: 0.2, durationMs: 5000 }, budget: { cc: 12 } },
  { id: "speed_boost15", label: "速度+15% 4s", kind: "Buff", buff: { kind: "speedBoost", power: 0.15, durationMs: 4000 }, budget: { cc: 10 } },
  
  // 特殊机制动作
  { id: "charge", label: "蓄力2s", kind: "Charge", maxChargeTime: 2000, minEffect: { scale: 0.5, flat: 20 }, maxEffect: { scale: 1.5, flat: 60 }, budget: { damage: 35, perf: 10 } },
  { id: "stack3", label: "充能3层", kind: "Stack", stackId: "default", maxStacks: 3, stackCooldown: 5000, budget: { proc: 15 } },
  { id: "summon_minion", label: "召唤仆从", kind: "Summon", hp: 100, atk: 20, defense: 5, moveSpeed: 2, attackRange: 3, attackSpeed: 1000, durationMs: 10000, summonType: "minion", ai: "attack", budget: { damage: 40, perf: 20 } },
  { id: "mark", label: "印记20s", kind: "Mark", tag: "hunt_mark", budget: {} },
  { id: "mark_vuln", label: "易伤印记15s", kind: "Mark", tag: "vuln_mark", debuff: { kind: "vulnerable", power: 0.15, durationMs: 15000 }, budget: { cc: 10 } },
  { id: "mark_damage", label: "伤害印记10s", kind: "Mark", tag: "dmg_mark", damageOnHit: { scale: 0.3, flat: 10 }, budget: { damage: 15 } },
  { id: "bonus", label: "击杀掉落加成", kind: "MarkReward", requiredTag: "hunt_mark", reward: { type: "dropBonus", table: "pve_bonus" }, budget: {} },
  { id: "bonus_exp", label: "击杀经验加成", kind: "MarkReward", requiredTag: "hunt_mark", reward: { type: "expBonus", multiplier: 1.5 }, budget: {} },
  { id: "bonus_heal", label: "击杀恢复生命", kind: "MarkReward", requiredTag: "hunt_mark", reward: { type: "healOnKill", amount: 50 }, budget: {} },
];

/**
 * 时间线规则池
 */
export const TIMELINE_RULES = [
  { id: "no_delay", label: "无延迟", delayMs: 0, budget: {} },
  { id: "noDelay", label: "无延迟", delayMs: 0, budget: {} },
  { id: "windup", label: "0.25s延迟", delayMs: 250, budget: { damage: 5 } },
  { id: "windup_long", label: "0.5s延迟", delayMs: 500, budget: { damage: 12 } },
  { id: "delay150", label: "延迟0.15s", delayMs: 150, budget: {} },
  { id: "delay200", label: "0.2s延迟", delayMs: 200, budget: { damage: 3 } },
  { id: "delay300", label: "0.3s延迟", delayMs: 300, budget: {} },
  { id: "delay400", label: "0.4s延迟", delayMs: 400, budget: { damage: 3 } },
  { id: "root05", label: "硬直0.5s", delayMs: 0, budget: {} },
  { id: "slow1", label: "自减速1s", delayMs: 0, budget: {} },
  { id: "recovery02", label: "后摇0.2s", delayMs: 200, budget: {} },
  { id: "recovery04", label: "后摇0.4s", delayMs: 400, budget: { damage: 3 } },
];

/**
 * 结构生成规则（基础值，会被复杂度系数调整）
 */
export const STRUCTURE_RULES = {
  // 槽位数量范围（基础值）
  baseMinSlots: 4,
  baseMaxSlots: 8,
  
  // 必需元素（基础值）
  required: {
    event: 1,        // 必须有1个事件
    action: [1, 4],  // 基础：1-4个动作
  },
  
  // 可选元素（数量范围，基础值）
  optional: {
    condition: [0, 3],  // 基础：0-3个条件
    target: [0, 2],     // 基础：0-2个目标选择
    timeline: [0, 3],   // 基础：0-3个时间线
  },
  
  /**
   * 根据复杂度配置计算实际的槽位数量范围
   */
  getSlotRange(complexity) {
    const config = complexity || COMPLEXITY_CONFIG;
    const minSlots = Math.max(3, Math.floor(STRUCTURE_RULES.baseMinSlots * config.slotCount.min));
    const maxSlots = Math.max(minSlots, Math.floor(STRUCTURE_RULES.baseMaxSlots * config.slotCount.max));
    return { minSlots, maxSlots };
  },
  
  /**
   * 根据复杂度配置计算实际的动作数量范围
   */
  getActionRange(complexity) {
    const config = complexity || COMPLEXITY_CONFIG;
    const [baseMin, baseMax] = STRUCTURE_RULES.required.action;
    const min = Math.max(1, Math.floor(baseMin * config.actionCount.min));
    const max = Math.max(min, Math.floor(baseMax * config.actionCount.max));
    return [min, max];
  },
  
  /**
   * 根据复杂度配置计算实际的条件数量范围
   */
  getConditionRange(complexity) {
    const config = complexity || COMPLEXITY_CONFIG;
    const [baseMin, baseMax] = STRUCTURE_RULES.optional.condition;
    const max = Math.max(0, Math.floor(baseMax * config.conditionCount.max));
    return [baseMin, max];
  },
  
  /**
   * 根据复杂度配置计算实际的目标数量范围
   */
  getTargetRange(complexity) {
    const config = complexity || COMPLEXITY_CONFIG;
    const [baseMin, baseMax] = STRUCTURE_RULES.optional.target;
    const max = Math.max(0, Math.floor(baseMax * config.targetCount.max));
    return [baseMin, max];
  },
  
  /**
   * 根据复杂度配置计算实际的时间线数量范围
   */
  getTimelineRange(complexity) {
    const config = complexity || COMPLEXITY_CONFIG;
    const [baseMin, baseMax] = STRUCTURE_RULES.optional.timeline;
    const max = Math.max(0, Math.floor(baseMax * config.timelineCount.max));
    return [baseMin, max];
  },
  
  // 约束规则
  constraints: [
    // 如果有投射物动作，建议有目标选择
    {
      if: { action: { kinds: ["SpawnProjectile", "SpawnMultipleProjectiles", "SpawnBurstProjectiles", "SpawnProjectileWithExplosion"] } },
      then: { target: { min: 1, weight: 0.7 } }, // 70%概率添加目标选择
    },
    // 如果有OnDamaged事件，必须有触发概率条件
    {
      if: { event: "OnDamaged" },
      then: { condition: { kind: "ProcChance", min: 1, required: true } }, // 必须添加
    },
    // 如果有区域DoT，建议有目标选择
    {
      if: { action: { kind: "SpawnAreaDoT" } },
      then: { target: { min: 1, weight: 0.8 } }, // 80%概率添加目标选择
    },
    // 如果有标记动作，建议有标记奖励动作
    {
      if: { action: { kind: "Mark" } },
      then: { action: { kind: "MarkReward", min: 1, weight: 0.6 } }, // 60%概率添加标记奖励
    },
  ],
};
