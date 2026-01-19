/**
 * 动作组合系统
 * 将动作拆分成基础类型和修饰符，实现自由组合
 */

/**
 * 基础动作类型（Base Action Types）
 * 定义动作的核心行为
 */
export const BASE_ACTION_TYPES = {
  // 投射物类
  SpawnProjectile: {
    id: "SpawnProjectile",
    label: "投射物",
    kind: "SpawnProjectile",
    baseBudget: { damage: 20, perf: 5 },
    baseFormula: { scale: 0.6, flat: 20 },
    basePresentation: { windupMs: 150, projectileSpeed: 12 },
    compatibleModifiers: [
      "projectileModifier", // 投射物修饰符
      "damageModifier",     // 伤害修饰符
      "quantityModifier",   // 数量修饰符
    ],
  },
  
  // 直接伤害类
  Damage: {
    id: "Damage",
    label: "直接伤害",
    kind: "Damage",
    baseBudget: { damage: 25 },
    baseFormula: { scale: 0.7, flat: 25 },
    compatibleModifiers: [
      "damageModifier",     // 伤害修饰符
      "areaModifier",       // 范围修饰符
    ],
  },
  
  // 光束类
  Beam: {
    id: "Beam",
    label: "光束",
    kind: "Beam",
    baseBudget: { damage: 45, perf: 20 },
    baseBeamLength: 12,
    baseBeamWidth: 1,
    baseBeamDuration: 1500,
    baseTickInterval: 100,
    baseTickFormula: { scale: 0.35, flat: 12 },
    basePresentation: { windupMs: 200 },
    compatibleModifiers: [
      "beamModifier",       // 光束修饰符
      "damageModifier",     // 伤害修饰符
    ],
  },
  
  // 区域持续伤害类
  SpawnAreaDoT: {
    id: "SpawnAreaDoT",
    label: "区域持续伤害",
    kind: "SpawnAreaDoT",
    baseBudget: { damage: 28, perf: 10 },
    baseRadius: 3,
    baseDurationMs: 4000,
    baseTickIntervalMs: 500,
    baseTickFormula: { scale: 0.2, flat: 7 },
    compatibleModifiers: [
      "areaModifier",       // 范围修饰符
      "damageModifier",     // 伤害修饰符
      "durationModifier",   // 持续时间修饰符
    ],
  },
  
  // 控制类（Debuff）
  Debuff: {
    id: "Debuff",
    label: "控制效果",
    kind: "Debuff",
    baseBudget: { cc: 15 },
    compatibleModifiers: [
      "debuffModifier",     // 控制修饰符
      "durationModifier",   // 持续时间修饰符
    ],
  },
  
  // 增益类（Buff/Heal）
  Heal: {
    id: "Heal",
    label: "治疗",
    kind: "Heal",
    baseBudget: { cc: 15 },
    baseFormula: { scale: 0.3, flat: 50 },
    compatibleModifiers: [
      "healModifier",       // 治疗修饰符
    ],
  },
  
  Buff: {
    id: "Buff",
    label: "增益",
    kind: "Buff",
    baseBudget: { cc: 12 },
    compatibleModifiers: [
      "buffModifier",       // 增益修饰符
      "durationModifier",   // 持续时间修饰符
    ],
  },
  
  // 移动类
  Dash: {
    id: "Dash",
    label: "突进",
    kind: "Dash",
    baseBudget: { mobility: 20 },
    baseDistance: 5,
    baseSpeed: 15,
    compatibleModifiers: [
      "mobilityModifier",   // 移动修饰符
    ],
  },
  
  Blink: {
    id: "Blink",
    label: "闪现",
    kind: "Blink",
    baseBudget: { mobility: 25 },
    baseDistance: 5,
    compatibleModifiers: [
      "mobilityModifier",   // 移动修饰符
    ],
  },
  
  // 特殊机制类
  Charge: {
    id: "Charge",
    label: "蓄力",
    kind: "Charge",
    baseBudget: { damage: 35, perf: 10 },
    baseMaxChargeTime: 2000,
    baseMinEffect: { scale: 0.5, flat: 20 },
    baseMaxEffect: { scale: 1.5, flat: 60 },
    compatibleModifiers: [
      "chargeModifier",     // 蓄力修饰符
    ],
  },
  
  Summon: {
    id: "Summon",
    label: "召唤",
    kind: "Summon",
    baseBudget: { damage: 40, perf: 20 },
    baseHp: 100,
    baseAtk: 20,
    baseDefense: 5,
    baseMoveSpeed: 2,
    baseAttackRange: 3,
    baseAttackSpeed: 1000,
    baseDurationMs: 10000,
    compatibleModifiers: [
      "summonModifier",     // 召唤修饰符
    ],
  },
  
  Mark: {
    id: "Mark",
    label: "标记",
    kind: "Mark",
    baseBudget: {},
    compatibleModifiers: [
      "markModifier",       // 标记修饰符
    ],
  },
};

/**
 * 投射物修饰符（Projectile Modifiers）
 */
export const PROJECTILE_MODIFIERS = {
  homing: {
    id: "homing",
    label: "追踪",
    weight: 1.0,
    budget: { perf: 8 },
    data: {
      homing: { turnRate: 0.15, loseTargetRange: 10 },
    },
    presentation: { projectileSpeed: 8 },
    formulaMultiplier: 0.9, // 追踪降低伤害
  },
  
  ricochet: {
    id: "ricochet",
    label: "弹跳",
    weight: 1.0,
    budget: { perf: 12 },
    data: {
      ricochet: { bounceCount: 3, bounceRange: 4, damageDecay: 0.8 },
    },
    presentation: { projectileSpeed: 12 },
    formulaMultiplier: 0.95,
  },
  
  spiral: {
    id: "spiral",
    label: "螺旋",
    weight: 1.0,
    budget: { perf: 10 },
    data: {
      spiral: { spiralRadius: 0.5, spiralSpeed: 5, turns: 2 },
    },
    presentation: { projectileSpeed: 10 },
    formulaMultiplier: 1.0,
  },
  
  orbit: {
    id: "orbit",
    label: "环绕",
    weight: 0.8,
    budget: { perf: 15 },
    data: {
      orbit: { orbitRadius: 3, orbitSpeed: 2, orbitCount: 3, durationMs: 5000 },
    },
    presentation: { projectileSpeed: 0 },
    formulaMultiplier: 0.85,
  },
  
  return: {
    id: "return",
    label: "回旋",
    weight: 1.0,
    budget: { perf: 8 },
    data: {
      return: { maxDistance: 8, returnSpeed: 8, returnDamage: true },
    },
    presentation: { projectileSpeed: 10 },
    formulaMultiplier: 0.9,
  },
  
  hover: {
    id: "hover",
    label: "悬停",
    weight: 0.8,
    budget: { perf: 15 },
    data: {
      hover: { hoverDuration: 2000, hoverRadius: 2, tickInterval: 200, tickFormula: { scale: 0.3, flat: 10 }, hoverType: "position" },
    },
    presentation: { projectileSpeed: 12 },
    formulaMultiplier: 0.8,
  },
  
  pierce: {
    id: "pierce",
    label: "穿透",
    weight: 1.2,
    budget: { perf: 8 },
    data: {
      pierce: { pierceCount: 3, damageDecay: 0.9, pierceWidth: 0.5 },
    },
    presentation: { projectileSpeed: 14 },
    formulaMultiplier: 0.95,
  },
  
  explosive: {
    id: "explosive",
    label: "爆炸",
    weight: 1.0,
    budget: { perf: 18 },
    data: {
      explosionFormula: { scale: 1.5, flat: 55 },
      explosionRadius: 2.5,
      explosionDelay: 1000,
      explosionType: "time",
    },
    presentation: { projectileSpeed: 10 },
    formulaMultiplier: 0.7, // 基础伤害降低，爆炸伤害高
  },
};

/**
 * 伤害修饰符（Damage Modifiers）
 */
export const DAMAGE_MODIFIERS = {
  crit: {
    id: "crit",
    label: "暴击",
    weight: 1.0,
    budget: { proc: 15 },
    data: {
      critChance: 0.25,
      critMultiplier: 2.0,
    },
    formulaMultiplier: 0.9, // 基础伤害略降，暴击补偿
  },
  
  execute: {
    id: "execute",
    label: "处决",
    weight: 0.8,
    budget: { damage: 5 },
    data: {
      executeThreshold: 0.3,
      executeMultiplier: 2.0,
    },
    formulaMultiplier: 0.95,
  },
  
  percent: {
    id: "percent",
    label: "百分比伤害",
    weight: 0.7,
    budget: { damage: 10 },
    data: {
      percent: 0.05,
    },
    formulaMultiplier: 0.0, // 百分比伤害不使用基础公式
  },
  
  trueDamage: {
    id: "trueDamage",
    label: "真实伤害",
    weight: 0.6,
    budget: { damage: 10 },
    data: {
      ignoreDefense: true,
    },
    formulaMultiplier: 0.7, // 真实伤害基础值较低
  },
  
  bleed: {
    id: "bleed",
    label: "流血",
    weight: 1.0,
    budget: { perf: 8 },
    data: {
      tickFormula: { scale: 0.2, flat: 8 },
      durationMs: 3000,
      tickIntervalMs: 500,
      maxStacks: 3,
    },
    formulaMultiplier: 0.85,
  },
  
  chain: {
    id: "chain",
    label: "连锁",
    weight: 1.0,
    budget: { perf: 10 },
    data: {
      chainCount: 3,
      chainRange: 4,
      damageDecay: 0.8,
    },
    formulaMultiplier: 0.9,
  },
  
  bounce: {
    id: "bounce",
    label: "弹射",
    weight: 1.0,
    budget: { perf: 12 },
    data: {
      bounceCount: 3,
      bounceRange: 4,
      damageDecay: 0.8,
      canBounceSelf: false,
    },
    formulaMultiplier: 0.95,
  },
  
  split: {
    id: "split",
    label: "分裂",
    weight: 1.0,
    budget: { perf: 15 },
    data: {
      splitCount: 3,
      splitAngle: 60,
      damageDecay: 0.7,
      projectileSpeed: 10,
    },
    formulaMultiplier: 0.85,
  },
};

/**
 * 数量修饰符（Quantity Modifiers）
 */
export const QUANTITY_MODIFIERS = {
  scatter3: {
    id: "scatter3",
    label: "3弹散射",
    weight: 1.0,
    budget: { perf: 12 },
    data: {
      count: 3,
      spreadAngle: 45,
      spreadType: "fan",
    },
    formulaMultiplier: 0.65, // 每个子弹伤害降低
  },
  
  scatter5: {
    id: "scatter5",
    label: "5弹散射",
    weight: 0.8,
    budget: { perf: 18 },
    data: {
      count: 5,
      spreadAngle: 60,
      spreadType: "fan",
    },
    formulaMultiplier: 0.55,
  },
  
  burst3: {
    id: "burst3",
    label: "3连发",
    weight: 1.0,
    budget: { perf: 15 },
    data: {
      count: 3,
      burstDelay: 150,
    },
    formulaMultiplier: 0.7,
  },
  
  burst5: {
    id: "burst5",
    label: "5连发",
    weight: 0.7,
    budget: { perf: 22 },
    data: {
      count: 5,
      burstDelay: 120,
    },
    formulaMultiplier: 0.6,
  },
};

/**
 * 范围修饰符（Area Modifiers）
 */
export const AREA_MODIFIERS = {
  cone: {
    id: "cone",
    label: "扇形",
    weight: 1.0,
    budget: { damage: 5 },
    data: {
      shape: "cone",
      angle: 60,
      range: 5,
    },
    formulaMultiplier: 1.1,
  },
  
  line: {
    id: "line",
    label: "直线",
    weight: 1.0,
    budget: { damage: 3 },
    data: {
      shape: "line",
      width: 0.5,
      range: 8,
    },
    formulaMultiplier: 1.0,
  },
  
  circle: {
    id: "circle",
    label: "圆形",
    weight: 1.0,
    budget: { damage: 8 },
    data: {
      shape: "circle",
      radius: 3,
    },
    formulaMultiplier: 0.9,
  },
};

/**
 * 控制修饰符（Debuff Modifiers）
 */
export const DEBUFF_MODIFIERS = {
  slow: {
    id: "slow",
    label: "减速",
    weight: 1.0,
    budget: { cc: 12 },
    data: {
      kind: "slow",
      power: 0.4,
      durationMs: 1500,
    },
  },
  
  root: {
    id: "root",
    label: "定身",
    weight: 0.9,
    budget: { cc: 18 },
    data: {
      kind: "root",
      power: 1.0,
      durationMs: 1000,
    },
  },
  
  stun: {
    id: "stun",
    label: "眩晕",
    weight: 0.8,
    budget: { cc: 22 },
    data: {
      kind: "stun",
      power: 1.0,
      durationMs: 800,
    },
  },
  
  silence: {
    id: "silence",
    label: "沉默",
    weight: 0.8,
    budget: { cc: 22 },
    data: {
      kind: "silence",
      power: 1,
      durationMs: 600,
    },
  },
  
  disarm: {
    id: "disarm",
    label: "缴械",
    weight: 0.8,
    budget: { cc: 20 },
    data: {
      kind: "disarm",
      power: 1.0,
      durationMs: 1200,
    },
  },
  
  fear: {
    id: "fear",
    label: "恐惧",
    weight: 0.7,
    budget: { cc: 28 },
    data: {
      kind: "fear",
      power: 1.0,
      durationMs: 1500,
      moveSpeed: 2,
    },
  },
  
  charm: {
    id: "charm",
    label: "魅惑",
    weight: 0.7,
    budget: { cc: 30 },
    data: {
      kind: "charm",
      power: 1.0,
      durationMs: 1200,
      moveSpeed: 2,
    },
  },
  
  vulnerable: {
    id: "vulnerable",
    label: "易伤",
    weight: 1.0,
    budget: { damage: 8 },
    data: {
      kind: "vulnerable",
      power: 0.1,
      durationMs: 2000,
    },
  },
  
  knockback: {
    id: "knockback",
    label: "击退",
    weight: 1.0,
    budget: { cc: 15 },
    data: {
      kind: "knockback",
      power: 1.5,
      durationMs: 300,
      moveSpeed: 5,
    },
  },
  
  pull: {
    id: "pull",
    label: "拉回",
    weight: 0.9,
    budget: { cc: 20, mobility: 15 },
    data: {
      kind: "pull",
      distance: 3,
      speed: 10,
    },
  },
};

/**
 * 增益修饰符（Buff Modifiers）
 */
export const BUFF_MODIFIERS = {
  atkBoost: {
    id: "atkBoost",
    label: "攻击提升",
    weight: 1.0,
    budget: { cc: 12 },
    data: {
      kind: "atkBoost",
      power: 0.2,
      durationMs: 5000,
    },
  },
  
  speedBoost: {
    id: "speedBoost",
    label: "速度提升",
    weight: 1.0,
    budget: { cc: 10 },
    data: {
      kind: "speedBoost",
      power: 0.15,
      durationMs: 4000,
    },
  },
  
  defBoost: {
    id: "defBoost",
    label: "防御提升",
    weight: 0.9,
    budget: { cc: 12 },
    data: {
      kind: "defBoost",
      power: 10,
      durationMs: 5000,
    },
  },
  
  shield: {
    id: "shield",
    label: "护盾",
    weight: 1.0,
    budget: { cc: 5 },
    data: {
      kind: "shield",
      power: 200,
      durationMs: 3000,
    },
  },
  
  stealth: {
    id: "stealth",
    label: "隐身",
    weight: 0.8,
    budget: { cc: 30 },
    data: {
      kind: "stealth",
      power: 1.0,
      durationMs: 3000,
      revealOnAttack: true,
      revealOnDamage: true,
      revealRange: 3,
    },
  },
  
  haste: {
    id: "haste",
    label: "急速",
    weight: 0.9,
    budget: { cc: 20 },
    data: {
      kind: "haste",
      power: 1.0,
      durationMs: 3000,
      speedBoost: 0.5,
      attackSpeedBoost: 0.3,
    },
  },
};

/**
 * 组合规则：定义哪些修饰符可以组合
 */
export const COMPOSITION_RULES = {
  // 投射物可以组合的修饰符
  SpawnProjectile: {
    maxModifiers: 2, // 最多2个修饰符
    allowedCombinations: [
      ["projectileModifier", "damageModifier"],
      ["projectileModifier", "quantityModifier"],
      ["damageModifier", "quantityModifier"],
      ["projectileModifier"], // 单个修饰符
      ["damageModifier"],
      ["quantityModifier"],
    ],
    // 互斥组合（不能同时存在）
    exclusivePairs: [
      ["orbit", "return"], // 环绕和回旋互斥
      ["scatter3", "scatter5"], // 不同散射数量互斥
      ["burst3", "burst5"], // 不同连发数量互斥
    ],
  },
  
  Damage: {
    maxModifiers: 2,
    allowedCombinations: [
      ["damageModifier", "areaModifier"],
      ["damageModifier"],
      ["areaModifier"],
    ],
    exclusivePairs: [
      ["crit", "execute"], // 暴击和处决互斥（可以放宽）
      ["percent", "trueDamage"], // 百分比和真实伤害互斥
    ],
  },
  
  Beam: {
    maxModifiers: 1,
    allowedCombinations: [
      ["beamModifier"],
      ["damageModifier"],
    ],
    exclusivePairs: [],
  },
  
  SpawnAreaDoT: {
    maxModifiers: 2,
    allowedCombinations: [
      ["areaModifier", "damageModifier"],
      ["areaModifier", "durationModifier"],
      ["damageModifier", "durationModifier"],
      ["areaModifier"],
      ["damageModifier"],
      ["durationModifier"],
    ],
    exclusivePairs: [],
  },
  
  Debuff: {
    maxModifiers: 1,
    allowedCombinations: [
      ["debuffModifier"],
      ["durationModifier"],
    ],
    exclusivePairs: [],
  },
};

/**
 * 根据基础类型和修饰符组合生成完整的动作规则
 * @param {Object} baseType - 基础动作类型
 * @param {Array} modifiers - 修饰符数组
 * @param {Function} rng - 随机数生成器
 * @returns {Object} 组合后的动作规则
 */
export function composeAction(baseType, modifiers, rng) {
  const action = {
    id: `${baseType.id}_${modifiers.map(m => m.id).join('_')}_${Math.random().toString(36).substr(2, 6)}`,
    kind: baseType.kind,
    budget: { ...baseType.baseBudget },
    ...baseType,
  };
  
  // 检查是否有数量修饰符（scatter/burst），这些会改变动作类型
  const quantityModifier = modifiers.find(m => 
    m.id.startsWith('scatter') || m.id.startsWith('burst')
  );
  
  // 如果有数量修饰符且基础类型是SpawnProjectile，改变动作类型
  if (quantityModifier && baseType.kind === "SpawnProjectile") {
    if (quantityModifier.id.startsWith('scatter')) {
      action.kind = "SpawnMultipleProjectiles";
    } else if (quantityModifier.id.startsWith('burst')) {
      action.kind = "SpawnBurstProjectiles";
    }
  }
  
  // 应用修饰符
  let formulaMultiplier = 1.0;
  
  for (const modifier of modifiers) {
    // 合并预算
    if (modifier.budget) {
      for (const [key, value] of Object.entries(modifier.budget)) {
        action.budget[key] = (action.budget[key] || 0) + value;
      }
    }
    
    // 合并数据
    if (modifier.data) {
      Object.assign(action, modifier.data);
    }
    
    // 合并表现参数
    if (modifier.presentation) {
      action.presentation = { ...action.presentation, ...modifier.presentation };
    }
    
    // 累积公式倍数
    if (modifier.formulaMultiplier !== undefined) {
      formulaMultiplier *= modifier.formulaMultiplier;
    }
  }
  
  // 应用公式倍数
  if (action.baseFormula) {
    action.formula = {
      scale: action.baseFormula.scale * formulaMultiplier,
      flat: action.baseFormula.flat * formulaMultiplier,
    };
  }
  
  // Beam特殊处理：将baseBeam*属性转换为beam*属性
  if (baseType.kind === "Beam") {
    if (action.baseBeamLength !== undefined) action.beamLength = action.baseBeamLength;
    if (action.baseBeamWidth !== undefined) action.beamWidth = action.baseBeamWidth;
    if (action.baseBeamDuration !== undefined) action.beamDuration = action.baseBeamDuration;
    if (action.baseTickInterval !== undefined) action.tickInterval = action.baseTickInterval;
    if (action.baseTickFormula !== undefined) action.tickFormula = action.baseTickFormula;
    // 设置默认值
    if (!action.beamLength) action.beamLength = 12;
    if (!action.beamWidth) action.beamWidth = 1;
    if (!action.beamDuration) action.beamDuration = 1500;
    if (!action.tickInterval) action.tickInterval = 100;
    if (!action.tickFormula) action.tickFormula = { scale: 0.35, flat: 12 };
    if (action.pierceCount === undefined) action.pierceCount = -1;
  }
  
  // SpawnAreaDoT特殊处理：将base*属性转换为实际属性
  if (baseType.kind === "SpawnAreaDoT") {
    if (action.baseRadius !== undefined) action.radius = action.baseRadius;
    if (action.baseDurationMs !== undefined) action.durationMs = action.baseDurationMs;
    if (action.baseTickIntervalMs !== undefined) action.tickIntervalMs = action.baseTickIntervalMs;
    if (action.baseTickFormula !== undefined) action.tickFormula = action.baseTickFormula;
    // 设置默认值（确保所有必需属性都存在）
    if (action.radius === undefined) action.radius = 3;
    if (action.durationMs === undefined) action.durationMs = 4000;
    if (action.tickIntervalMs === undefined) action.tickIntervalMs = 500;
    if (!action.tickFormula) action.tickFormula = { scale: 0.2, flat: 7 };
  }
  
  // 生成标签（用于描述）
  const modifierLabels = modifiers.map(m => m.label).join('+');
  action.label = `${baseType.label}${modifierLabels ? `(${modifierLabels})` : ''}`;
  
  return action;
}

/**
 * 从修饰符池中随机选择修饰符
 * @param {Array} modifierPool - 修饰符池
 * @param {Number} count - 选择数量
 * @param {Function} rng - 随机数生成器
 * @param {Array} excludeIds - 排除的ID列表
 * @returns {Array} 选中的修饰符
 */
export function selectModifiers(modifierPool, count, rng, excludeIds = []) {
  const available = modifierPool.filter(m => !excludeIds.includes(m.id));
  if (available.length === 0) return [];
  
  const selected = [];
  const weights = available.map(m => m.weight || 1.0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  for (let i = 0; i < count && available.length > 0; i++) {
    let random = rng() * totalWeight;
    let index = 0;
    
    for (let j = 0; j < weights.length; j++) {
      random -= weights[j];
      if (random <= 0) {
        index = j;
        break;
      }
    }
    
    const selectedModifier = available[index];
    selected.push(selectedModifier);
    
    // 移除已选中的修饰符（避免重复）
    available.splice(index, 1);
    weights.splice(index, 1);
    const newTotalWeight = weights.reduce((a, b) => a + b, 0);
    if (newTotalWeight > 0) {
      // 重新归一化权重
      for (let j = 0; j < weights.length; j++) {
        weights[j] = (weights[j] / newTotalWeight) * totalWeight;
      }
    }
  }
  
  return selected;
}
