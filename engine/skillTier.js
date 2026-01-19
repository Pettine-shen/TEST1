/**
 * 技能强度分级系统
 * 根据技能复杂度和效果强度计算技能等级
 */

import { SKILL_TIERS } from "../configs/skillPersonalities.js";

/**
 * 计算技能复杂度
 * @param {Object} template - 技能模板
 * @param {Object} slotOptions - 槽位选项映射
 * @returns {number} 复杂度分数
 */
export function calculateSkillComplexity(template, slotOptions) {
  if (!template || !slotOptions) return 0;
  
  let complexity = 0;
  
  // 1. 基础复杂度：槽位数量
  complexity += template.slots.length * 2;
  
  // 2. 动作复杂度：动作数量和类型
  const actionSlots = template.slots.filter(s => s.type === "Action");
  complexity += actionSlots.length * 3;
  
  for (const actionSlot of actionSlots) {
    const optionId = slotOptions[actionSlot.id] || actionSlot.defaultOption;
    const option = actionSlot.options.find(o => o.id === optionId);
    if (!option) continue;
    
    const kind = option.kind || "";
    const optionIdStr = optionId || "";
    
    // 复杂动作类型加分
    if (kind === "Beam" || optionIdStr.includes("beam")) {
      complexity += 3;
    } else if (kind === "SpawnAreaDoT" || optionIdStr.includes("area")) {
      complexity += 2;
    } else if (kind === "ChainDamage" || kind === "ChainTrigger" || optionIdStr.includes("chain")) {
      complexity += 2;
    } else if (kind === "Summon" || optionIdStr.includes("summon")) {
      complexity += 3;
    } else if (kind === "Charge" || optionIdStr.includes("charge")) {
      complexity += 2;
    } else if (kind === "SpawnMultipleProjectiles" || kind === "SpawnBurstProjectiles" || optionIdStr.includes("scatter") || optionIdStr.includes("burst")) {
      complexity += 2;
    }
    
    // 投射物修饰符加分
    if (option.homing) complexity += 1;
    if (option.pierceCount > 0) complexity += 1;
    if (option.splitOnHit) complexity += 1;
    if (option.chainOnHit) complexity += 1;
    if (option.explosionOnHit) complexity += 1;
    if (option.hover) complexity += 2;
    if (option.orbit) complexity += 1;
    if (option.return) complexity += 1;
    if (option.spiral) complexity += 1;
  }
  
  // 3. 条件复杂度
  const conditionSlots = template.slots.filter(s => s.type === "Condition");
  complexity += conditionSlots.length;
  
  // 4. 时间线复杂度
  const timelineSlots = template.slots.filter(s => s.type === "Timeline");
  complexity += timelineSlots.length * 2;
  
  return complexity;
}

/**
 * 计算技能强度（伤害/效果强度）
 * @param {Object} template - 技能模板
 * @param {Object} slotOptions - 槽位选项映射
 * @returns {number} 强度分数
 */
export function calculateSkillPower(template, slotOptions) {
  if (!template || !slotOptions) return 0;
  
  let power = 0;
  
  const actionSlots = template.slots.filter(s => s.type === "Action");
  
  for (const actionSlot of actionSlots) {
    const optionId = slotOptions[actionSlot.id] || actionSlot.defaultOption;
    const option = actionSlot.options.find(o => o.id === optionId);
    if (!option) continue;
    
    const kind = option.kind || "";
    const formula = option.formula || {};
    
    // 伤害强度计算
    if (formula.scale || formula.flat) {
      // 基础伤害：scale * 100 + flat（假设基础攻击力为100）
      const baseDamage = (formula.scale || 0) * 100 + (formula.flat || 0);
      power += baseDamage;
    }
    
    // 特殊伤害类型加分
    if (kind === "CritDamage" || optionId.includes("crit")) {
      power += 50; // 暴击额外伤害
    }
    if (kind === "ExecuteDamage" || optionId.includes("execute")) {
      power += 80; // 处决额外伤害
    }
    if (kind === "ChainDamage" || optionId.includes("chain")) {
      power += 30 * (option.chainCount || 3); // 连锁伤害
    }
    if (kind === "BounceDamage" || optionId.includes("bounce")) {
      power += 25 * (option.bounceCount || 3); // 弹跳伤害
    }
    if (kind === "PierceDamage" || optionId.includes("pierce")) {
      power += 20 * (option.pierceCount || 2); // 穿透伤害
    }
    if (kind === "BleedDamage" || optionId.includes("bleed")) {
      power += 40; // 持续伤害
    }
    if (kind === "SpawnAreaDoT" || optionId.includes("area")) {
      power += 60; // 区域持续伤害
    }
    if (kind === "Beam" || optionId.includes("beam")) {
      power += 80; // 光束持续伤害
    }
    
    // 多投射物加分
    if (kind === "SpawnMultipleProjectiles" || optionId.includes("scatter")) {
      power += 30 * (option.count || 3);
    }
    if (kind === "SpawnBurstProjectiles" || optionId.includes("burst")) {
      power += 25 * (option.count || 3);
    }
    
    // 控制效果加分
    if (option.debuff) {
      const debuffKind = option.debuff.kind || "";
      if (debuffKind === "stun") power += 40;
      else if (debuffKind === "root") power += 30;
      else if (debuffKind === "slow") power += 20;
      else if (debuffKind === "silence") power += 35;
      else if (debuffKind === "vulnerable") power += 30;
    }
    
    // 增益效果加分
    if (option.buff) {
      const buffKind = option.buff.kind || "";
      if (buffKind === "atkBoost") power += 30;
      else if (buffKind === "speedBoost") power += 20;
      else if (buffKind === "defBoost") power += 25;
    }
    
    // 恢复/护盾加分
    if (kind === "Heal" || optionId.includes("heal")) {
      power += 40;
    }
    if (option.buff?.kind === "shield") {
      power += 35;
    }
    
    // 召唤加分
    if (kind === "Summon" || optionId.includes("summon")) {
      power += 50;
    }
  }
  
  return power;
}

/**
 * 计算技能等级
 * @param {Object} template - 技能模板
 * @param {Object} slotOptions - 槽位选项映射
 * @returns {Object} 等级信息 { tier: "common"|"rare"|"epic"|"legendary", label: string, color: string }
 */
export function calculateSkillTier(template, slotOptions) {
  const complexity = calculateSkillComplexity(template, slotOptions);
  const power = calculateSkillPower(template, slotOptions);
  
  // 根据复杂度和强度确定等级
  for (const [tierKey, tierConfig] of Object.entries(SKILL_TIERS)) {
    if (complexity >= tierConfig.minComplexity && 
        complexity <= tierConfig.maxComplexity &&
        power >= tierConfig.minPower && 
        power <= tierConfig.maxPower) {
      return {
        tier: tierKey,
        label: tierConfig.label,
        color: tierConfig.color,
        complexity,
        power,
      };
    }
  }
  
  // 如果超出最高等级，返回传说级
  const legendary = SKILL_TIERS.legendary;
  return {
    tier: "legendary",
    label: legendary.label,
    color: legendary.color,
    complexity,
    power,
  };
}
