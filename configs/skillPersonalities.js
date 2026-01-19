/**
 * 技能性格系统
 * 为每个技能定义明确的"性格标签"，确保生成的技能有明显的特色
 */

/**
 * 技能性格定义
 * 每个性格包含：
 * - label: 性格名称
 * - actionWeights: 动作权重调整（相对于基础权重）
 * - visualStyle: 视觉风格
 * - description: 性格描述
 */
export const SKILL_PERSONALITIES = {
  aggressive: {
    label: "激进型",
    description: "高伤害、高风险，追求极致输出",
    actionWeights: {
      // 高伤害动作权重提升
      "dmg_high": 2.0,
      "crit": 1.8,
      "execute": 1.6,
      "chain": 1.5,
      "bounce": 1.4,
      // 允许负面效果换取高伤害
      "selfDebuff": 1.3,
      // 降低防御性动作权重
      "heal": 0.3,
      "shield": 0.3,
      "slow": 0.5,
      "root": 0.4,
    },
    visualStyle: {
      color: "#ff4444",
      particle: "fire",
      glow: true,
    },
    strategyFocus: "damage",
  },
  
  defensive: {
    label: "防御型",
    description: "护盾、恢复、控制，注重生存",
    actionWeights: {
      // 防御性动作权重提升
      "shield": 2.0,
      "heal": 1.8,
      "invulnerable": 1.6,
      "slow": 1.5,
      "root": 1.4,
      "stun": 1.3,
      // 降低攻击性动作权重
      "dmg_high": 0.5,
      "crit": 0.4,
      "execute": 0.3,
    },
    visualStyle: {
      color: "#44ff44",
      particle: "shield",
      glow: false,
    },
    strategyFocus: "defense",
  },
  
  tactical: {
    label: "战术型",
    description: "控制、标记、处决，注重策略",
    actionWeights: {
      // 战术性动作权重提升
      "mark": 2.0,
      "execute": 1.8,
      "slow": 1.6,
      "root": 1.5,
      "stun": 1.4,
      "silence": 1.3,
      "vulnerable": 1.5,
      // 平衡伤害
      "dmg_high": 0.8,
      "crit": 0.7,
    },
    visualStyle: {
      color: "#4444ff",
      particle: "ice",
      glow: true,
    },
    strategyFocus: "control",
  },
  
  mobile: {
    label: "机动型",
    description: "位移、快速、灵活，注重机动性",
    actionWeights: {
      // 机动性动作权重提升
      "dash": 2.0,
      "blink": 1.8,
      "jump": 1.6,
      "roll": 1.5,
      // 快速投射物
      "proj_fast": 1.8,
      // 降低慢速动作权重
      "charge": 0.3,
      "beam": 0.4,
      "areaDoT": 0.3,
    },
    visualStyle: {
      color: "#ffaa44",
      particle: "wind",
      glow: false,
    },
    strategyFocus: "mobility",
  },
  
  area: {
    label: "范围型",
    description: "大范围、持续伤害，注重范围控制",
    actionWeights: {
      // 范围性动作权重提升
      "areaDoT": 2.0,
      "beam": 1.8,
      "chain": 1.6,
      "bounce": 1.5,
      "pierce": 1.4,
      "scatter": 1.7,
      "burst": 1.6,
      // 降低单体动作权重
      "execute": 0.4,
      "single": 0.5,
    },
    visualStyle: {
      color: "#ff44ff",
      particle: "explosion",
      glow: true,
    },
    strategyFocus: "area",
  },
  
  single: {
    label: "单体型",
    description: "高单体伤害、穿透，注重单体爆发",
    actionWeights: {
      // 单体高伤害动作权重提升
      "dmg_high": 1.8,
      "crit": 1.7,
      "execute": 1.6,
      "pierce": 1.5,
      "homing": 1.4,
      // 降低范围动作权重
      "areaDoT": 0.3,
      "chain": 0.4,
      "bounce": 0.4,
      "scatter": 0.3,
    },
    visualStyle: {
      color: "#44ffff",
      particle: "laser",
      glow: true,
    },
    strategyFocus: "single",
  },
  
  support: {
    label: "辅助型",
    description: "增益、减益、召唤，注重团队支持",
    actionWeights: {
      // 辅助性动作权重提升
      "buff": 2.0,
      "debuff": 1.8,
      "summon": 1.6,
      "heal": 1.5,
      "shield": 1.4,
      "mark": 1.3,
      // 降低伤害动作权重
      "dmg_high": 0.4,
      "crit": 0.3,
      "execute": 0.3,
    },
    visualStyle: {
      color: "#ffff44",
      particle: "magic",
      glow: true,
    },
    strategyFocus: "support",
  },
  
  hybrid: {
    label: "混合型",
    description: "多种效果组合，平衡发展",
    actionWeights: {
      // 所有动作权重保持平衡
      "dmg_high": 1.0,
      "crit": 1.0,
      "execute": 1.0,
      "chain": 1.0,
      "bounce": 1.0,
      "heal": 1.0,
      "shield": 1.0,
      "slow": 1.0,
      "root": 1.0,
      "stun": 1.0,
    },
    visualStyle: {
      color: "#ffffff",
      particle: "spark",
      glow: true,
    },
    strategyFocus: "hybrid",
  },
};

/**
 * 策略维度定义
 */
export const STRATEGY_DIMENSIONS = {
  damageVsControl: {
    damage: {
      label: "纯输出",
      description: "高伤害，无控制",
      actionWeights: {
        "dmg_high": 1.8,
        "crit": 1.6,
        "execute": 1.5,
        "slow": 0.3,
        "root": 0.2,
        "stun": 0.2,
      },
    },
    control: {
      label: "纯控制",
      description: "强控制，低伤害",
      actionWeights: {
        "slow": 1.8,
        "root": 1.7,
        "stun": 1.6,
        "silence": 1.5,
        "dmg_high": 0.4,
        "crit": 0.3,
      },
    },
    hybrid: {
      label: "混合",
      description: "平衡伤害和控制",
      actionWeights: {
        "dmg_high": 1.0,
        "slow": 1.0,
        "root": 1.0,
        "stun": 1.0,
      },
    },
  },
  
  safetyVsRisk: {
    safe: {
      label: "安全型",
      description: "稳定输出，低风险",
      actionWeights: {
        "shield": 1.5,
        "heal": 1.4,
        "invulnerable": 1.3,
        "selfDebuff": 0.2,
      },
    },
    risky: {
      label: "风险型",
      description: "高伤害，但有负面效果",
      actionWeights: {
        "selfDebuff": 1.8,
        "dmg_high": 1.6,
        "crit": 1.5,
        "shield": 0.3,
        "heal": 0.3,
      },
    },
  },
  
  singleVsArea: {
    single: {
      label: "单体",
      description: "高单体伤害",
      actionWeights: {
        "execute": 1.7,
        "crit": 1.6,
        "pierce": 1.4,
        "areaDoT": 0.2,
        "chain": 0.3,
        "bounce": 0.3,
      },
    },
    area: {
      label: "范围",
      description: "大范围伤害",
      actionWeights: {
        "areaDoT": 1.8,
        "chain": 1.6,
        "bounce": 1.5,
        "scatter": 1.7,
        "execute": 0.3,
        "single": 0.4,
      },
    },
  },
  
  burstVsSustain: {
    burst: {
      label: "爆发型",
      description: "高瞬时伤害",
      actionWeights: {
        "crit": 1.7,
        "execute": 1.6,
        "dmg_high": 1.5,
        "areaDoT": 0.3,
        "bleed": 0.4,
      },
    },
    sustain: {
      label: "持续型",
      description: "持续伤害/效果",
      actionWeights: {
        "areaDoT": 1.8,
        "bleed": 1.6,
        "beam": 1.5,
        "hover": 1.4,
        "crit": 0.4,
        "execute": 0.3,
      },
    },
  },
};

/**
 * 技能强度分级
 */
export const SKILL_TIERS = {
  common: {
    label: "普通",
    color: "#ffffff",
    minComplexity: 0,
    maxComplexity: 3,
    minPower: 0,
    maxPower: 100,
  },
  rare: {
    label: "稀有",
    color: "#44ff44",
    minComplexity: 3,
    maxComplexity: 5,
    minPower: 100,
    maxPower: 200,
  },
  epic: {
    label: "史诗",
    color: "#4444ff",
    minComplexity: 5,
    maxComplexity: 8,
    minPower: 200,
    maxPower: 400,
  },
  legendary: {
    label: "传说",
    color: "#ffaa44",
    minComplexity: 8,
    maxComplexity: Infinity,
    minPower: 400,
    maxPower: Infinity,
  },
};

/**
 * 高风险高回报机制
 */
export const HIGH_RISK_HIGH_REWARD = {
  selfDebuff: {
    selfSlow: {
      damageMultiplier: 1.5,
      description: "自身减速 +50%伤害",
    },
    selfVuln: {
      damageMultiplier: 2.0,
      description: "自身易伤 +100%伤害",
    },
    selfRoot: {
      damageMultiplier: 2.5,
      description: "自身定身 +150%伤害",
    },
  },
  resourceCost: {
    highMana: {
      cost: 50,
      damageMultiplier: 1.8,
      description: "高蓝耗 +80%伤害",
    },
    hpCost: {
      cost: 100,
      damageMultiplier: 2.2,
      description: "消耗HP +120%伤害",
    },
  },
};
