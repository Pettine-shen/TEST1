/**
 * 效果组合协同系统
 * 定义哪些效果组合在一起会有叠加收益（synergy）
 */

/**
 * 效果组合定义
 * 格式：{ effects: [效果ID数组], bonus: { 预算类型: 加成值 }, description: "描述" }
 */
export const SYNERGY_COMBOS = [
  // 投射物 + 穿透/弹跳类效果
  {
    effects: ["proj_pierce", "proj_ricochet"],
    bonus: { damage: 10, perf: 5 },
    description: "穿透+弹跳：穿透后弹跳，增加命中机会",
  },
  {
    effects: ["proj_pierce", "proj_split"],
    bonus: { damage: 15, perf: 8 },
    description: "穿透+分裂：穿透后分裂，范围伤害提升",
  },
  {
    effects: ["proj_homing", "proj_spiral"],
    bonus: { damage: 12, perf: 6 },
    description: "追踪+螺旋：追踪目标的同时螺旋飞行，难以躲避",
  },
  
  // 控制效果组合
  {
    effects: ["slow", "root"],
    bonus: { cc: 15 },
    description: "减速+定身：双重控制，敌人难以移动",
  },
  {
    effects: ["stun", "silence"],
    bonus: { cc: 20 },
    description: "眩晕+沉默：完全控制，敌人无法行动和施法",
  },
  {
    effects: ["fear", "charm"],
    bonus: { cc: 18 },
    description: "恐惧+魅惑：混乱控制，敌人行为不可预测",
  },
  
  // 伤害类型组合
  {
    effects: ["bleed", "execute"],
    bonus: { damage: 20 },
    description: "流血+处决：流血降低血量，处决更容易触发",
  },
  {
    effects: ["crit", "execute"],
    bonus: { damage: 25 },
    description: "暴击+处决：高伤害组合，快速击杀低血敌人",
  },
  {
    effects: ["chain", "bounce"],
    bonus: { damage: 18, perf: 10 },
    description: "连锁+弹跳：多重弹跳，范围伤害最大化",
  },
  
  // 特殊机制组合
  {
    effects: ["hover", "beam"],
    bonus: { damage: 15, perf: 12 },
    description: "悬停+光束：持续伤害组合，高DPS",
  },
  {
    effects: ["charge", "beam"],
    bonus: { damage: 20, perf: 8 },
    description: "蓄力+光束：蓄力后持续光束，爆发+持续",
  },
  {
    effects: ["chainTrigger", "split"],
    bonus: { proc: 15, perf: 10 },
    description: "连锁触发+分裂：触发后分裂，效果扩散",
  },
  
  // 移动+控制组合
  {
    effects: ["dash", "stun"],
    bonus: { mobility: 10, cc: 10 },
    description: "突进+眩晕：突进后眩晕，近身控制",
  },
  {
    effects: ["pull", "stun"],
    bonus: { cc: 15 },
    description: "拉回+眩晕：拉回后眩晕，控制链",
  },
  {
    effects: ["knockback", "slow"],
    bonus: { cc: 12 },
    description: "击退+减速：击退后减速，拉开距离",
  },
  
  // 增益+伤害组合
  {
    effects: ["berserk", "crit"],
    bonus: { damage: 22 },
    description: "狂暴+暴击：攻击速度+暴击率，高DPS",
  },
  {
    effects: ["shield", "reflect"],
    bonus: { damage: 15 },
    description: "护盾+反射：防御+反击，攻防一体",
  },
];

/**
 * 检查效果组合是否有协同收益
 * @param {Array} effectIds - 效果ID数组
 * @returns {Object|null} 协同收益对象，如果没有则返回null
 */
export function checkSynergy(effectIds) {
  if (!effectIds || effectIds.length < 2) return null;
  
  // 将效果ID转换为小写并标准化，便于匹配
  const normalizedIds = effectIds.map(id => (id || "").toLowerCase());
  
  for (const combo of SYNERGY_COMBOS) {
    // 检查是否包含组合中的所有效果
    const hasAllEffects = combo.effects.every(comboEffectId => {
      const normalizedComboId = comboEffectId.toLowerCase();
      return normalizedIds.some(id => 
        id === normalizedComboId || 
        id.includes(normalizedComboId) || 
        normalizedComboId.includes(id)
      );
    });
    
    if (hasAllEffects) {
      return combo;
    }
  }
  
  return null;
}

/**
 * 检查多个效果组合，返回所有匹配的协同收益
 * @param {Array} effectIds - 效果ID数组
 * @returns {Array} 所有匹配的协同收益对象数组
 */
export function checkAllSynergies(effectIds) {
  if (!effectIds || effectIds.length < 2) return [];
  
  const synergies = [];
  const normalizedIds = effectIds.map(id => (id || "").toLowerCase());
  
  for (const combo of SYNERGY_COMBOS) {
    const hasAllEffects = combo.effects.every(comboEffectId => {
      const normalizedComboId = comboEffectId.toLowerCase();
      return normalizedIds.some(id => 
        id === normalizedComboId || 
        id.includes(normalizedComboId) || 
        normalizedComboId.includes(id)
      );
    });
    
    if (hasAllEffects) {
      synergies.push(combo);
    }
  }
  
  return synergies;
}

/**
 * 从选项ID中提取效果ID
 * @param {Object} option - 选项对象
 * @returns {Array} 效果ID数组
 */
export function extractEffectIds(option) {
  const effectIds = [];
  
  // 从选项ID中提取（更精确的匹配，避免重复）
  const optId = (option.id || "").toLowerCase();
  
  // 投射物特殊效果（优先检查，避免被通用匹配覆盖）
  if (optId.includes("proj_pierce") || optId.includes("pierce")) effectIds.push("pierce");
  if (optId.includes("proj_ricochet") || optId.includes("ricochet")) effectIds.push("ricochet");
  if (optId.includes("proj_homing") || optId.includes("homing")) effectIds.push("homing");
  if (optId.includes("proj_spiral") || optId.includes("spiral")) effectIds.push("spiral");
  if (optId.includes("proj_orbit") || optId.includes("orbit")) effectIds.push("orbit");
  if (optId.includes("proj_return") || optId.includes("return")) effectIds.push("return");
  if (optId.includes("proj_hover") || optId.includes("hover")) effectIds.push("hover");
  if (optId.includes("proj_beam") || optId.includes("beam")) effectIds.push("beam");
  
  // 控制效果
  if (optId.includes("slow")) effectIds.push("slow");
  if (optId.includes("stun") || optId.includes("ministun")) effectIds.push("stun");
  if (optId.includes("root")) effectIds.push("root");
  if (optId.includes("silence")) effectIds.push("silence");
  if (optId.includes("fear")) effectIds.push("fear");
  if (optId.includes("charm")) effectIds.push("charm");
  if (optId.includes("knockback")) effectIds.push("knockback");
  if (optId.includes("pull")) effectIds.push("pull");
  
  // 移动效果
  if (optId.includes("dash")) effectIds.push("dash");
  if (optId.includes("blink")) effectIds.push("blink");
  if (optId.includes("jump")) effectIds.push("jump");
  
  // 伤害机制
  if (optId.includes("bleed")) effectIds.push("bleed");
  if (optId.includes("execute")) effectIds.push("execute");
  if (optId.includes("crit")) effectIds.push("crit");
  if ((optId.includes("chain") || optId.includes("chain")) && !optId.includes("chaintrigger") && !optId.includes("chain_trigger")) effectIds.push("chain");
  if (optId.includes("bounce")) effectIds.push("bounce");
  if (optId.includes("split")) effectIds.push("split");
  
  // 特殊机制
  if (optId.includes("chaintrigger") || optId.includes("chain_trigger") || optId.includes("chain_onhit") || optId.includes("chain_onkill")) effectIds.push("chainTrigger");
  if (optId.includes("charge")) effectIds.push("charge");
  if (optId.includes("berserk")) effectIds.push("berserk");
  if (optId.includes("shield")) effectIds.push("shield");
  if (optId.includes("reflect")) effectIds.push("reflect");
  
  // 从kind中提取
  if (option.kind === "SpawnProjectile") {
    if (option.homing) effectIds.push("homing");
    if (option.ricochet) effectIds.push("ricochet");
    if (option.spiral) effectIds.push("spiral");
    if (option.orbit) effectIds.push("orbit");
    if (option.return) effectIds.push("return");
    if (option.hover) effectIds.push("hover");
  }
  if (option.kind === "Beam") effectIds.push("beam");
  if (option.kind === "ChainTrigger") effectIds.push("chainTrigger");
  if (option.kind === "Charge") effectIds.push("charge");
  if (option.kind === "Dash") effectIds.push("dash");
  if (option.kind === "Blink") effectIds.push("blink");
  if (option.kind === "Jump") effectIds.push("jump");
  if (option.kind === "Pull") effectIds.push("pull");
  
  if (option.kind === "Debuff") {
    const debuffKind = option.debuff?.kind || "";
    if (debuffKind === "slow") effectIds.push("slow");
    if (debuffKind === "root") effectIds.push("root");
    if (debuffKind === "stun") effectIds.push("stun");
    if (debuffKind === "silence") effectIds.push("silence");
    if (debuffKind === "fear") effectIds.push("fear");
    if (debuffKind === "charm") effectIds.push("charm");
    if (debuffKind === "knockback") effectIds.push("knockback");
    if (debuffKind === "pull") effectIds.push("pull");
    if (debuffKind === "bleed") effectIds.push("bleed");
  }
  
  if (option.kind === "BleedDamage") effectIds.push("bleed");
  if (option.kind === "ExecuteDamage") effectIds.push("execute");
  if (option.kind === "CritDamage") effectIds.push("crit");
  if (option.kind === "ChainDamage") effectIds.push("chain");
  if (option.kind === "BounceDamage") effectIds.push("bounce");
  if (option.kind === "PierceDamage") effectIds.push("pierce");
  if (option.kind === "SplitDamage") effectIds.push("split");
  
  if (option.kind === "Buff") {
    const buffKind = option.buff?.kind || "";
    if (buffKind === "berserk") effectIds.push("berserk");
    if (buffKind === "shield") effectIds.push("shield");
    if (buffKind === "reflect") effectIds.push("reflect");
  }
  
  return effectIds;
}
