/**
 * 技能原型系统（参考流放之路2的BD设计）
 * 主效果（Core）+ 副效果（Support）架构
 */

/**
 * 主效果类型（Core Skills）
 * 每个主效果是一个完整的技能核心，提供基础功能和差异化体验
 */
export const CORE_SKILLS = [
  // === 投射类主效果 ===
  {
    id: "core_projectile_basic",
    label: "基础投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectile",
      formula: { scale: 0.6, flat: 20 },
      budget: { damage: 30, perf: 8 },
      presentation: { windupMs: 150, projectileSpeed: 14, recoveryMs: 300 },
    },
    baseBudget: { damage: 30, cc: 0, mobility: 0, proc: 0, perf: 8 },
    weight: 1.0,
  },
  {
    id: "core_projectile_multi",
    label: "多弹投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnMultipleProjectiles",
      count: 3,
      spreadAngle: 45,
      spreadType: "fan",
      formula: { scale: 0.4, flat: 14 },
      budget: { damage: 42, perf: 12 },
      presentation: { windupMs: 200, projectileSpeed: 12, recoveryMs: 400 },
    },
    baseBudget: { damage: 42, cc: 0, mobility: 0, proc: 0, perf: 12 },
    weight: 0.8,
  },
  {
    id: "core_projectile_burst",
    label: "连发投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnBurstProjectiles",
      count: 3,
      burstDelay: 150,
      formula: { scale: 0.5, flat: 18 },
      budget: { damage: 54, perf: 15 },
      presentation: { windupMs: 200, projectileSpeed: 14, recoveryMs: 500 },
    },
    baseBudget: { damage: 54, cc: 0, mobility: 0, proc: 0, perf: 15 },
    weight: 0.7,
  },
  {
    id: "core_projectile_explosive",
    label: "爆炸投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectileWithExplosion",
      formula: { scale: 0.4, flat: 12 },
      explosionFormula: { scale: 1.5, flat: 55 },
      explosionRadius: 2.5,
      explosionDelay: 1000,
      explosionType: "time",
      budget: { damage: 85, perf: 18 },
      presentation: { windupMs: 250, projectileSpeed: 10, recoveryMs: 400 },
    },
    baseBudget: { damage: 85, cc: 0, mobility: 0, proc: 0, perf: 18 },
    weight: 0.6,
  },
  {
    id: "core_projectile_scatter5",
    label: "5弹散射",
    category: "projectile",
    baseAction: {
      kind: "SpawnMultipleProjectiles",
      count: 5,
      spreadAngle: 60,
      spreadType: "fan",
      formula: { scale: 0.35, flat: 12 },
      budget: { damage: 52, perf: 15 },
      presentation: { windupMs: 220, projectileSpeed: 11, recoveryMs: 450 },
    },
    baseBudget: { damage: 52, cc: 0, mobility: 0, proc: 0, perf: 15 },
    weight: 0.5,
  },
  {
    id: "core_projectile_scatter_circle",
    label: "圆形散射",
    category: "projectile",
    baseAction: {
      kind: "SpawnMultipleProjectiles",
      count: 8,
      spreadAngle: 360,
      spreadType: "circle",
      formula: { scale: 0.3, flat: 10 },
      budget: { damage: 48, perf: 18 },
      presentation: { windupMs: 250, projectileSpeed: 10, recoveryMs: 500 },
    },
    baseBudget: { damage: 48, cc: 0, mobility: 0, proc: 0, perf: 18 },
    weight: 0.4,
  },
  {
    id: "core_projectile_burst5",
    label: "5连发",
    category: "projectile",
    baseAction: {
      kind: "SpawnBurstProjectiles",
      count: 5,
      burstDelay: 120,
      formula: { scale: 0.45, flat: 16 },
      budget: { damage: 72, perf: 20 },
      presentation: { windupMs: 250, projectileSpeed: 13, recoveryMs: 600 },
    },
    baseBudget: { damage: 72, cc: 0, mobility: 0, proc: 0, perf: 20 },
    weight: 0.5,
  },
  {
    id: "core_projectile_ricochet",
    label: "弹跳投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectile",
      formula: { scale: 0.55, flat: 18 },
      ricochet: { bounceCount: 3, bounceRange: 4, damageDecay: 0.8 },
      budget: { damage: 50, perf: 12 },
      presentation: { windupMs: 180, projectileSpeed: 13, recoveryMs: 350 },
    },
    baseBudget: { damage: 50, cc: 0, mobility: 0, proc: 0, perf: 12 },
    weight: 0.6,
  },
  {
    id: "core_projectile_spiral",
    label: "螺旋投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectile",
      formula: { scale: 0.6, flat: 20 },
      spiral: { spiralRadius: 1.5, spiralSpeed: 2.0, turns: 2 },
      budget: { damage: 35, perf: 10 },
      presentation: { windupMs: 170, projectileSpeed: 12, recoveryMs: 320 },
    },
    baseBudget: { damage: 35, cc: 0, mobility: 0, proc: 0, perf: 10 },
    weight: 0.7,
  },
  {
    id: "core_projectile_orbit",
    label: "环绕投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectile",
      formula: { scale: 0.4, flat: 12 },
      orbit: { orbitRadius: 3, orbitSpeed: 2.5, orbitCount: 3, durationMs: 5000 },
      budget: { damage: 42, perf: 15 },
      presentation: { windupMs: 200, recoveryMs: 300 },
    },
    baseBudget: { damage: 42, cc: 0, mobility: 0, proc: 0, perf: 15 },
    weight: 0.5,
  },
  {
    id: "core_projectile_return",
    label: "回旋投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectile",
      formula: { scale: 0.65, flat: 22 },
      return: { maxDistance: 12, returnSpeed: 1.2, returnDamage: true },
      budget: { damage: 45, perf: 8 },
      presentation: { windupMs: 160, projectileSpeed: 14, recoveryMs: 300 },
    },
    baseBudget: { damage: 45, cc: 0, mobility: 0, proc: 0, perf: 8 },
    weight: 0.6,
  },
  {
    id: "core_projectile_hover",
    label: "悬停投射",
    category: "projectile",
    baseAction: {
      kind: "SpawnProjectile",
      formula: { scale: 0.5, flat: 15 },
      hover: { hoverDuration: 2000, hoverRadius: 2, tickInterval: 200, tickFormula: { scale: 0.3, flat: 10 }, hoverType: "position" },
      budget: { damage: 45, perf: 15 },
      presentation: { windupMs: 180, projectileSpeed: 11, recoveryMs: 350 },
    },
    baseBudget: { damage: 45, cc: 0, mobility: 0, proc: 0, perf: 15 },
    weight: 0.5,
  },
  
  // === 光束类主效果 ===
  {
    id: "core_beam_short",
    label: "短光束",
    category: "beam",
    baseAction: {
      kind: "Beam",
      beamLength: 12,
      beamWidth: 1,
      beamDuration: 1500,
      tickInterval: 100,
      tickFormula: { scale: 0.35, flat: 12 },
      pierceCount: -1,
      canRotate: false,
      budget: { damage: 45, perf: 20 },
      presentation: { windupMs: 200, recoveryMs: 300 },
    },
    baseBudget: { damage: 45, cc: 0, mobility: 0, proc: 0, perf: 20 },
    weight: 0.5,
  },
  {
    id: "core_beam_long",
    label: "长光束",
    category: "beam",
    baseAction: {
      kind: "Beam",
      beamLength: 18,
      beamWidth: 1.5,
      beamDuration: 2500,
      tickInterval: 80,
      tickFormula: { scale: 0.4, flat: 15 },
      pierceCount: -1,
      canRotate: false,
      budget: { damage: 60, perf: 25 },
      presentation: { windupMs: 300, recoveryMs: 400 },
    },
    baseBudget: { damage: 60, cc: 0, mobility: 0, proc: 0, perf: 25 },
    weight: 0.4,
  },
  {
    id: "core_beam_wide",
    label: "宽光束",
    category: "beam",
    baseAction: {
      kind: "Beam",
      beamLength: 14,
      beamWidth: 2.5,
      beamDuration: 2000,
      tickInterval: 90,
      tickFormula: { scale: 0.38, flat: 14 },
      pierceCount: -1,
      canRotate: false,
      budget: { damage: 55, perf: 22 },
      presentation: { windupMs: 250, recoveryMs: 350 },
    },
    baseBudget: { damage: 55, cc: 0, mobility: 0, proc: 0, perf: 22 },
    weight: 0.5,
  },
  {
    id: "core_beam_rotating",
    label: "旋转光束",
    category: "beam",
    baseAction: {
      kind: "Beam",
      beamLength: 10,
      beamWidth: 1.2,
      beamDuration: 3000,
      tickInterval: 100,
      tickFormula: { scale: 0.35, flat: 12 },
      pierceCount: -1,
      canRotate: true,
      budget: { damage: 50, perf: 23 },
      presentation: { windupMs: 220, recoveryMs: 380 },
    },
    baseBudget: { damage: 50, cc: 0, mobility: 0, proc: 0, perf: 23 },
    weight: 0.4,
  },
  {
    id: "core_beam_sustained",
    label: "持续光束",
    category: "beam",
    baseAction: {
      kind: "Beam",
      beamLength: 15,
      beamWidth: 1.3,
      beamDuration: 4000,
      tickInterval: 70,
      tickFormula: { scale: 0.33, flat: 11 },
      pierceCount: -1,
      canRotate: false,
      budget: { damage: 65, perf: 28 },
      presentation: { windupMs: 280, recoveryMs: 450 },
    },
    baseBudget: { damage: 65, cc: 0, mobility: 0, proc: 0, perf: 28 },
    weight: 0.3,
  },
  
  // === 近战类主效果 ===
  {
    id: "core_melee_single",
    label: "单体近战",
    category: "melee",
    baseAction: {
      kind: "Damage",
      formula: { scale: 1.0, flat: 30 },
      budget: { damage: 40 },
      presentation: { windupMs: 200, recoveryMs: 400 },
    },
    baseBudget: { damage: 40, cc: 0, mobility: 0, proc: 0, perf: 5 },
    weight: 0.9,
  },
  {
    id: "core_melee_cone",
    label: "扇形近战",
    category: "melee",
    baseAction: {
      kind: "Damage",
      formula: { scale: 1.1, flat: 25 },
      budget: { damage: 40 },
      presentation: { windupMs: 250, recoveryMs: 500 },
    },
    baseBudget: { damage: 40, cc: 0, mobility: 0, proc: 0, perf: 8 },
    weight: 0.7,
  },
  {
    id: "core_melee_circle",
    label: "范围近战",
    category: "melee",
    baseAction: {
      kind: "Damage",
      formula: { scale: 1.0, flat: 22 },
      budget: { damage: 38 },
      presentation: { windupMs: 230, recoveryMs: 480 },
    },
    baseBudget: { damage: 38, cc: 0, mobility: 0, proc: 0, perf: 10 },
    weight: 0.6,
  },
  {
    id: "core_melee_combo",
    label: "连击近战",
    category: "melee",
    baseAction: {
      kind: "Damage",
      formula: { scale: 0.9, flat: 20 },
      budget: { damage: 35 },
      presentation: { windupMs: 150, recoveryMs: 300 },
    },
    baseBudget: { damage: 35, cc: 0, mobility: 0, proc: 0, perf: 6 },
    weight: 0.7,
  },
  {
    id: "core_melee_dash",
    label: "突进近战",
    category: "melee",
    baseAction: {
      kind: "Dash",
      distance: 5,
      speed: 12,
      formula: { scale: 1.2, flat: 28 },
      budget: { damage: 42, mobility: 20 },
      presentation: { windupMs: 200, recoveryMs: 400 },
    },
    baseBudget: { damage: 42, cc: 0, mobility: 20, proc: 0, perf: 8 },
    weight: 0.6,
  },
  
  // === 区域类主效果 ===
  {
    id: "core_area_dot",
    label: "区域持续",
    category: "area",
    baseAction: {
      kind: "SpawnAreaDoT",
      tickFormula: { scale: 0.3, flat: 9 },
      radius: 3,
      durationMs: 4000,
      tickIntervalMs: 500,
      budget: { damage: 28, perf: 10 },
      presentation: { windupMs: 300, recoveryMs: 400 },
    },
    baseBudget: { damage: 28, cc: 0, mobility: 0, proc: 0, perf: 10 },
    weight: 0.6,
  },
  {
    id: "core_area_large",
    label: "大范围持续",
    category: "area",
    baseAction: {
      kind: "SpawnAreaDoT",
      tickFormula: { scale: 0.25, flat: 7 },
      radius: 5,
      durationMs: 5000,
      tickIntervalMs: 600,
      budget: { damage: 30, perf: 14 },
      presentation: { windupMs: 350, recoveryMs: 450 },
    },
    baseBudget: { damage: 30, cc: 0, mobility: 0, proc: 0, perf: 14 },
    weight: 0.5,
  },
  {
    id: "core_area_heal",
    label: "治疗区域",
    category: "area",
    baseAction: {
      kind: "SpawnAreaHeal",
      tickFormula: { scale: 0.2, flat: 8 },
      radius: 4,
      durationMs: 4000,
      tickIntervalMs: 500,
      budget: { cc: 20, perf: 10 },
      presentation: { windupMs: 280, recoveryMs: 380 },
    },
    baseBudget: { damage: 0, cc: 20, mobility: 0, proc: 0, perf: 10 },
    weight: 0.5,
  },
  {
    id: "core_area_slow",
    label: "减速区域",
    category: "area",
    baseAction: {
      kind: "SpawnAreaSlow",
      slowPower: 0.4,
      radius: 4,
      durationMs: 5000,
      budget: { cc: 15, perf: 8 },
      presentation: { windupMs: 250, recoveryMs: 350 },
    },
    baseBudget: { damage: 0, cc: 15, mobility: 0, proc: 0, perf: 8 },
    weight: 0.6,
  },
  {
    id: "core_area_buff",
    label: "增益区域",
    category: "area",
    baseAction: {
      kind: "SpawnAreaBuff",
      buff: { kind: "atkBoost", power: 0.2, durationMs: 4000 },
      radius: 4,
      durationMs: 4000,
      budget: { cc: 20, perf: 8 },
      presentation: { windupMs: 270, recoveryMs: 370 },
    },
    baseBudget: { damage: 0, cc: 20, mobility: 0, proc: 0, perf: 8 },
    weight: 0.5,
  },
  
  // === 特殊类主效果 ===
  {
    id: "core_summon",
    label: "召唤",
    category: "summon",
    baseAction: {
      kind: "Summon",
      hp: 100,
      atk: 20,
      defense: 5,
      moveSpeed: 2,
      attackRange: 3,
      attackSpeed: 1000,
      durationMs: 10000,
      summonType: "minion",
      ai: "attack",
      budget: { damage: 40, perf: 20 },
      presentation: { windupMs: 500, recoveryMs: 600 },
    },
    baseBudget: { damage: 40, cc: 0, mobility: 0, proc: 0, perf: 20 },
    weight: 0.3,
  },
  {
    id: "core_summon_trap",
    label: "陷阱",
    category: "summon",
    baseAction: {
      kind: "SummonTrap",
      triggerRadius: 2,
      triggerCondition: "step",
      effect: { kind: "Damage", formula: { scale: 0.8, flat: 30 } },
      durationMs: 15000,
      maxTraps: 3,
      budget: { damage: 30, perf: 12 },
      presentation: { windupMs: 300, recoveryMs: 400 },
    },
    baseBudget: { damage: 30, cc: 0, mobility: 0, proc: 0, perf: 12 },
    weight: 0.4,
  },
  {
    id: "core_summon_turret",
    label: "炮塔",
    category: "summon",
    baseAction: {
      kind: "SummonTurret",
      hp: 80,
      atk: 25,
      attackRange: 8,
      attackSpeed: 800,
      durationMs: 12000,
      budget: { damage: 45, perf: 15 },
      presentation: { windupMs: 450, recoveryMs: 550 },
    },
    baseBudget: { damage: 45, cc: 0, mobility: 0, proc: 0, perf: 15 },
    weight: 0.3,
  },
  {
    id: "core_summon_multiple",
    label: "多重召唤",
    category: "summon",
    baseAction: {
      kind: "SummonMultiple",
      count: 2,
      hp: 80,
      atk: 18,
      defense: 4,
      moveSpeed: 2.2,
      attackRange: 3,
      attackSpeed: 1100,
      durationMs: 9000,
      summonType: "minion",
      ai: "attack",
      budget: { damage: 50, perf: 25 },
      presentation: { windupMs: 600, recoveryMs: 700 },
    },
    baseBudget: { damage: 50, cc: 0, mobility: 0, proc: 0, perf: 25 },
    weight: 0.2,
  },
  
  // === 特殊伤害类主效果 ===
  {
    id: "core_damage_bounce",
    label: "弹射伤害",
    category: "damage_special",
    baseAction: {
      kind: "BounceDamage",
      formula: { scale: 0.7, flat: 25 },
      bounceCount: 3,
      bounceRange: 4,
      damageDecay: 0.8,
      canBounceSelf: false,
      budget: { damage: 45, perf: 12 },
      presentation: { windupMs: 200, recoveryMs: 350 },
    },
    baseBudget: { damage: 45, cc: 0, mobility: 0, proc: 0, perf: 12 },
    weight: 0.6,
  },
  {
    id: "core_damage_pierce",
    label: "穿透伤害",
    category: "damage_special",
    baseAction: {
      kind: "PierceDamage",
      formula: { scale: 0.65, flat: 22 },
      pierceCount: 3,
      damageDecay: 0.85,
      pierceWidth: 1.5,
      budget: { damage: 35, perf: 8 },
      presentation: { windupMs: 180, recoveryMs: 320 },
    },
    baseBudget: { damage: 35, cc: 0, mobility: 0, proc: 0, perf: 8 },
    weight: 0.7,
  },
  {
    id: "core_damage_execute",
    label: "处决伤害",
    category: "damage_special",
    baseAction: {
      kind: "ExecuteDamage",
      baseFormula: { scale: 0.6, flat: 20 },
      executeThreshold: 0.3,
      executeMultiplier: 2.0,
      budget: { damage: 40 },
      presentation: { windupMs: 220, recoveryMs: 400 },
    },
    baseBudget: { damage: 40, cc: 0, mobility: 0, proc: 0, perf: 5 },
    weight: 0.6,
  },
  {
    id: "core_damage_bleed",
    label: "流血伤害",
    category: "damage_special",
    baseAction: {
      kind: "BleedDamage",
      tickFormula: { scale: 0.25, flat: 8 },
      durationMs: 4000,
      tickIntervalMs: 500,
      maxStacks: 3,
      budget: { damage: 30, perf: 8 },
      presentation: { windupMs: 190, recoveryMs: 330 },
    },
    baseBudget: { damage: 30, cc: 0, mobility: 0, proc: 0, perf: 8 },
    weight: 0.6,
  },
  {
    id: "core_damage_crit",
    label: "暴击伤害",
    category: "damage_special",
    baseAction: {
      kind: "CritDamage",
      formula: { scale: 0.7, flat: 24 },
      critChance: 0.25,
      critMultiplier: 2.0,
      budget: { damage: 35, proc: 15 },
      presentation: { windupMs: 200, recoveryMs: 360 },
    },
    baseBudget: { damage: 35, cc: 0, mobility: 0, proc: 15, perf: 5 },
    weight: 0.7,
  },
];

/**
 * 副效果类型（Support Modifiers）
 * 对主效果产生加成，可能带来负面效果
 */
export const SUPPORT_MODIFIERS = [
  // === 伤害加成类 ===
  {
    id: "support_more_damage",
    label: "更多伤害",
    category: "damage_boost",
    effects: {
      // 对主效果的伤害公式进行加成
      damageMultiplier: 1.5, // 50%更多伤害
    },
    budget: { damage: 20 },
    weight: 1.0,
    negativeEffects: [], // 无负面效果
  },
  {
    id: "support_increased_damage",
    label: "增加伤害",
    category: "damage_boost",
    effects: {
      damageMultiplier: 1.3, // 30%更多伤害
    },
    budget: { damage: 15 },
    weight: 1.2,
    negativeEffects: [],
  },
  {
    id: "support_brutal_damage",
    label: "残暴伤害",
    category: "damage_boost",
    effects: {
      damageMultiplier: 2.0, // 100%更多伤害
    },
    budget: { damage: 40 },
    weight: 0.5,
    negativeEffects: [
      {
        kind: "selfSlow",
        power: 0.3, // 30%减速
        durationMs: 2000,
      },
    ],
  },
  
  // === 投射物修饰类 ===
  {
    id: "support_homing",
    label: "追踪",
    category: "projectile_mod",
    effects: {
      // 为投射物添加追踪效果
      projectileModifier: {
        homing: { turnRate: 0.15, loseTargetRange: 10 },
      },
      projectileSpeedMultiplier: 0.7, // 速度降低30%
    },
    budget: { perf: 8 },
    weight: 0.8,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  {
    id: "support_pierce",
    label: "穿透",
    category: "projectile_mod",
    effects: {
      projectileModifier: {
        pierceCount: 3,
      },
    },
    budget: { damage: 10, perf: 8 },
    weight: 0.9,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  {
    id: "support_split",
    label: "分裂",
    category: "projectile_mod",
    effects: {
      projectileModifier: {
        splitOnHit: true,
        splitCount: 3,
        splitAngle: 60,
      },
      damageMultiplier: 0.8, // 主投射物伤害降低20%
    },
    budget: { damage: 15, perf: 12 },
    weight: 0.7,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  {
    id: "support_chain",
    label: "连锁",
    category: "projectile_mod",
    effects: {
      projectileModifier: {
        chainOnHit: true,
        chainCount: 3,
        chainRange: 4,
      },
      damageMultiplier: 0.85, // 主投射物伤害降低15%
    },
    budget: { damage: 20, perf: 10 },
    weight: 0.6,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  {
    id: "support_explosive",
    label: "爆炸",
    category: "projectile_mod",
    effects: {
      projectileModifier: {
        explosionOnHit: true,
        explosionRadius: 2.5,
        explosionFormula: { scale: 0.8, flat: 30 },
      },
      damageMultiplier: 0.7, // 主投射物伤害降低30%
    },
    budget: { damage: 25, perf: 15 },
    weight: 0.5,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  
  // === 控制效果类 ===
  {
    id: "support_slow",
    label: "减速",
    category: "control",
    effects: {
      // 添加减速debuff
      additionalDebuff: {
        kind: "slow",
        power: 0.3,
        durationMs: 2000,
      },
    },
    budget: { cc: 12 },
    weight: 1.0,
    negativeEffects: [],
  },
  {
    id: "support_stun",
    label: "眩晕",
    category: "control",
    effects: {
      additionalDebuff: {
        kind: "stun",
        power: 1.0,
        durationMs: 800,
      },
    },
    budget: { cc: 22 },
    weight: 0.7,
    negativeEffects: [],
  },
  {
    id: "support_vulnerable",
    label: "易伤",
    category: "control",
    effects: {
      additionalDebuff: {
        kind: "vulnerable",
        power: 0.15,
        durationMs: 3000,
      },
    },
    budget: { cc: 10 },
    weight: 1.1,
    negativeEffects: [],
  },
  
  // === 范围扩展类 ===
  {
    id: "support_area_expand",
    label: "范围扩大",
    category: "area_mod",
    effects: {
      areaRadiusMultiplier: 1.5, // 范围扩大50%
    },
    budget: { perf: 8 },
    weight: 0.8,
    negativeEffects: [],
    compatibleCategories: ["area", "projectile"],
  },
  {
    id: "support_area_massive",
    label: "巨大范围",
    category: "area_mod",
    effects: {
      areaRadiusMultiplier: 2.0, // 范围扩大100%
      damageMultiplier: 0.8, // 伤害降低20%
    },
    budget: { perf: 15 },
    weight: 0.6, // 提高权重（从0.4提升到0.6）
    negativeEffects: [
      {
        kind: "selfSlow",
        power: 0.2,
        durationMs: 1500,
      },
    ],
    compatibleCategories: ["area", "projectile"],
  },
  
  // === 速度/手感类 ===
  {
    id: "support_faster_cast",
    label: "快速施法",
    category: "cast_speed",
    effects: {
      windupMultiplier: 0.7, // 前摇减少30%
      recoveryMultiplier: 0.7, // 后摇减少30%
    },
    budget: { perf: 5 },
    weight: 1.1,
    negativeEffects: [],
  },
  {
    id: "support_faster_projectile",
    label: "快速投射",
    category: "projectile_speed",
    effects: {
      projectileSpeedMultiplier: 1.5, // 速度提升50%
    },
    budget: { perf: 6 },
    weight: 1.0,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  {
    id: "support_slower_stronger",
    label: "慢速强击",
    category: "projectile_speed",
    effects: {
      projectileSpeedMultiplier: 0.6, // 速度降低40%
      damageMultiplier: 1.8, // 伤害提升80%
      windupMultiplier: 1.5, // 前摇增加50%
    },
    budget: { damage: 30 },
    weight: 0.6,
    negativeEffects: [],
    compatibleCategories: ["projectile"],
  },
  
  // === 特殊机制类 ===
  {
    id: "support_charge",
    label: "蓄力",
    category: "special",
    effects: {
      enableCharge: true,
      maxChargeTime: 2000,
      chargeDamageMultiplier: 2.0, // 蓄满伤害翻倍
    },
    budget: { damage: 25, perf: 10 },
    weight: 0.5,
    negativeEffects: [],
  },
  {
    id: "support_multicast",
    label: "多重施法",
    category: "special",
    effects: {
      castCount: 2, // 施法2次
      castDelay: 200, // 每次间隔200ms
    },
    budget: { damage: 30, perf: 15 },
    weight: 0.6, // 提高权重（从0.4提升到0.6）
    negativeEffects: [
      {
        kind: "selfSlow",
        power: 0.25,
        durationMs: 1000,
      },
    ],
  },
  
  // === 增益类 ===
  {
    id: "support_lifesteal",
    label: "生命偷取",
    category: "sustain",
    effects: {
      lifestealPercent: 0.2, // 20%伤害转化为生命
    },
    budget: { cc: 15 },
    weight: 0.8,
    negativeEffects: [],
  },
  {
    id: "support_shield_on_hit",
    label: "命中护盾",
    category: "sustain",
    effects: {
      shieldOnHit: 30, // 每次命中获得30护盾
      shieldDuration: 3000,
    },
    budget: { cc: 12 },
    weight: 0.7,
    negativeEffects: [],
  },
  
  // === 高风险高回报类 ===
  {
    id: "support_berserker",
    label: "狂暴",
    category: "high_risk",
    effects: {
      damageMultiplier: 2.5, // 150%更多伤害
      attackSpeedMultiplier: 1.5, // 50%更快攻击速度
    },
    budget: { damage: 50 },
    weight: 0.5, // 提高权重（从0.3提升到0.5）
    negativeEffects: [
      {
        kind: "selfVuln",
        power: 0.2, // 20%易伤
        durationMs: 5000,
      },
      {
        kind: "selfSlow",
        power: 0.15, // 15%减速
        durationMs: 3000,
      },
    ],
  },
  {
    id: "support_overpower",
    label: "过载",
    category: "high_risk",
    effects: {
      damageMultiplier: 3.0, // 200%更多伤害
      areaRadiusMultiplier: 1.8, // 范围扩大80%
    },
    budget: { damage: 60, perf: 20 },
    weight: 0.4, // 提高权重（从0.2提升到0.4）
    negativeEffects: [
      {
        kind: "selfRoot",
        power: 1.0,
        durationMs: 1000, // 定身1秒
      },
      {
        kind: "selfVuln",
        power: 0.3, // 30%易伤
        durationMs: 4000,
      },
    ],
  },
];

/**
 * 主效果与副效果的兼容性规则
 */
export const COMPATIBILITY_RULES = {
  // 投射物修饰类只能用于投射类主效果
  projectile_mod: ["projectile"],
  // 区域修饰类可用于区域和投射类
  area_mod: ["area", "projectile"],
  // 投射物速度类只能用于投射类
  projectile_speed: ["projectile"],
  // 特殊伤害类可以用于所有类别（因为它们本身就是伤害动作）
  damage_special: ["projectile", "melee", "beam", "area", "summon"],
  // 其他类别通常通用
  default: ["projectile", "melee", "beam", "area", "summon", "damage_special"],
};

/**
 * 检查副效果是否与主效果兼容
 */
export function isCompatible(supportModifier, coreSkill) {
  const compatCategories = supportModifier.compatibleCategories;
  if (!compatCategories || compatCategories.length === 0) {
    return true; // 没有限制，通用兼容
  }
  return compatCategories.includes(coreSkill.category);
}

/**
 * 应用副效果到主效果
 */
export function applySupportModifier(coreAction, supportModifier) {
  const modified = JSON.parse(JSON.stringify(coreAction)); // 深拷贝
  
  // 应用伤害倍数
  if (supportModifier.effects.damageMultiplier) {
    if (modified.formula) {
      modified.formula.scale = (modified.formula.scale || 0) * supportModifier.effects.damageMultiplier;
      modified.formula.flat = (modified.formula.flat || 0) * supportModifier.effects.damageMultiplier;
    }
    if (modified.tickFormula) {
      modified.tickFormula.scale = (modified.tickFormula.scale || 0) * supportModifier.effects.damageMultiplier;
      modified.tickFormula.flat = (modified.tickFormula.flat || 0) * supportModifier.effects.damageMultiplier;
    }
    if (modified.explosionFormula) {
      modified.explosionFormula.scale = (modified.explosionFormula.scale || 0) * supportModifier.effects.damageMultiplier;
      modified.explosionFormula.flat = (modified.explosionFormula.flat || 0) * supportModifier.effects.damageMultiplier;
    }
  }
  
  // 应用投射物修饰
  if (supportModifier.effects.projectileModifier) {
    modified.homing = supportModifier.effects.projectileModifier.homing || modified.homing;
    modified.ricochet = supportModifier.effects.projectileModifier.ricochet || modified.ricochet;
    modified.spiral = supportModifier.effects.projectileModifier.spiral || modified.spiral;
    modified.orbit = supportModifier.effects.projectileModifier.orbit || modified.orbit;
    modified.return = supportModifier.effects.projectileModifier.return || modified.return;
    modified.hover = supportModifier.effects.projectileModifier.hover || modified.hover;
    modified.pierceCount = supportModifier.effects.projectileModifier.pierceCount || modified.pierceCount;
    modified.splitOnHit = supportModifier.effects.projectileModifier.splitOnHit || modified.splitOnHit;
    modified.splitCount = supportModifier.effects.projectileModifier.splitCount || modified.splitCount;
    modified.splitAngle = supportModifier.effects.projectileModifier.splitAngle || modified.splitAngle;
    modified.chainOnHit = supportModifier.effects.projectileModifier.chainOnHit || modified.chainOnHit;
    modified.chainCount = supportModifier.effects.projectileModifier.chainCount || modified.chainCount;
    modified.chainRange = supportModifier.effects.projectileModifier.chainRange || modified.chainRange;
    modified.explosionOnHit = supportModifier.effects.projectileModifier.explosionOnHit || modified.explosionOnHit;
    modified.explosionRadius = supportModifier.effects.projectileModifier.explosionRadius || modified.explosionRadius;
    modified.explosionFormula = supportModifier.effects.projectileModifier.explosionFormula || modified.explosionFormula;
  }
  
  // 应用速度倍数
  if (supportModifier.effects.projectileSpeedMultiplier && modified.presentation) {
    modified.presentation.projectileSpeed = (modified.presentation.projectileSpeed || 12) * supportModifier.effects.projectileSpeedMultiplier;
  }
  
  // 应用前摇/后摇倍数
  if (supportModifier.effects.windupMultiplier && modified.presentation) {
    modified.presentation.windupMs = (modified.presentation.windupMs || 200) * supportModifier.effects.windupMultiplier;
  }
  if (supportModifier.effects.recoveryMultiplier && modified.presentation) {
    modified.presentation.recoveryMs = (modified.presentation.recoveryMs || 300) * supportModifier.effects.recoveryMultiplier;
  }
  
  // 应用范围倍数
  if (supportModifier.effects.areaRadiusMultiplier) {
    if (modified.radius) {
      modified.radius = modified.radius * supportModifier.effects.areaRadiusMultiplier;
    }
    if (modified.explosionRadius) {
      modified.explosionRadius = modified.explosionRadius * supportModifier.effects.areaRadiusMultiplier;
    }
    if (modified.beamLength) {
      modified.beamLength = modified.beamLength * supportModifier.effects.areaRadiusMultiplier;
    }
  }
  
  // 应用特殊机制
  if (supportModifier.effects.enableCharge) {
    modified.charge = {
      maxChargeTime: supportModifier.effects.maxChargeTime || 2000,
      chargeDamageMultiplier: supportModifier.effects.chargeDamageMultiplier || 2.0,
    };
  }
  if (supportModifier.effects.castCount) {
    modified.multicast = {
      count: supportModifier.effects.castCount,
      delay: supportModifier.effects.castDelay || 200,
    };
  }
  
  // 应用生命偷取
  if (supportModifier.effects.lifestealPercent) {
    modified.lifesteal = supportModifier.effects.lifestealPercent;
  }
  
  // 应用命中护盾
  if (supportModifier.effects.shieldOnHit) {
    modified.shieldOnHit = {
      amount: supportModifier.effects.shieldOnHit,
      duration: supportModifier.effects.shieldDuration || 3000,
    };
  }
  
  return modified;
}
