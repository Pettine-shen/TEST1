/**
 * 技能描述生成器
 * 根据 Assembly 的 order 和 slotOptions 生成一句话技能描述
 */

import { CORE_SKILLS, SUPPORT_MODIFIERS } from "../configs/skillArchetypes.js";

/**
 * 生成技能描述
 * @param {Object} template - 技能模板
 * @param {string[]} order - 槽位顺序
 * @param {Object} slotOptions - 槽位选项映射
 * @returns {string} 一句话技能描述
 */
export function generateSkillDescription(template, order, slotOptions) {
  if (!template || !order || !slotOptions) {
    return "未知技能";
  }

  // 获取有序的槽位和选项
  const orderedSlots = order.map((slotId) => {
    const slot = template.slots.find((s) => s.id === slotId);
    const optionId = slotOptions[slotId] || slot?.defaultOption;
    const option = slot?.options.find((o) => o.id === optionId);
    return { slot, option, slotId };
  });

  // 识别关键组件
  const actionSlots = orderedSlots.filter((s) => s.slot?.type === "Action");
  const conditionSlots = orderedSlots.filter((s) => s.slot?.type === "Condition");
  const timelineSlots = orderedSlots.filter((s) => s.slot?.type === "Timeline");
  
  // 找到 Target 槽位，但只在它在第一个 Action 之前时才使用（因为只有这样才能影响 Action 的执行）
  const firstActionIndex = orderedSlots.findIndex((s) => s.slot?.type === "Action");
  const targetSlot = firstActionIndex >= 0 
    ? orderedSlots.slice(0, firstActionIndex).find((s) => s.slot?.type === "Target")
    : orderedSlots.find((s) => s.slot?.type === "Target");

  // 根据模板类型生成描述
  const templateId = template.id;

  // 动态生成的模板使用通用描述生成器
  if (templateId && templateId.startsWith("dynamic_")) {
    return generateGenericDescription(template, orderedSlots, targetSlot, actionSlots, conditionSlots);
  }

  if (templateId === "tpl_ranged_proj_v1") {
    return generateRangedProjDescription(orderedSlots, targetSlot, actionSlots, conditionSlots);
  } else if (templateId === "tpl_melee_burst_v1") {
    return generateMeleeBurstDescription(orderedSlots, actionSlots);
  } else if (templateId === "tpl_counter_v1") {
    return generateCounterDescription(orderedSlots, conditionSlots, actionSlots);
  } else if (templateId === "tpl_ground_dot_v1") {
    return generateGroundDotDescription(orderedSlots, targetSlot, actionSlots);
  } else if (templateId === "tpl_mark_exec_v1") {
    return generateMarkExecDescription(orderedSlots, actionSlots);
  }

  // 默认描述
  return generateGenericDescription(template, orderedSlots, targetSlot, actionSlots, conditionSlots);
}

/**
 * 远程投射类技能描述
 * 按照ECA执行顺序生成描述，确保包含所有效果
 */
function generateRangedProjDescription(orderedSlots, targetSlot, actionSlots, conditionSlots) {
  let desc = "";
  const parts = []; // 按顺序收集描述片段
  
  // 找到Timeline延迟信息
  const timelineSlot = orderedSlots.find((s) => s.slot?.type === "Timeline");
  const hasDelay = timelineSlot && timelineSlot.option?.delayMs > 0;
  const delayMs = timelineSlot?.option?.delayMs || 0;
  
  // 按照执行顺序遍历orderedSlots，收集所有Action
  const projectileActions = []; // 所有投射物Action（按顺序）
  const otherActions = []; // 其他Action（按顺序）
  const debuffActions = []; // Debuff Action（按顺序）
  
  for (const slotItem of orderedSlots) {
    if (slotItem.slot?.type === "Action") {
      const kind = slotItem.option?.kind;
      const optionId = slotItem.option?.id;
      
      // 投射物类型
      if (kind === "SpawnProjectile" || 
          kind === "SpawnMultipleProjectiles" || 
          kind === "SpawnBurstProjectiles" || 
          kind === "SpawnProjectileWithExplosion") {
        projectileActions.push(slotItem);
      } 
      // 光束类型
      else if (kind === "Beam") {
        projectileActions.push(slotItem); // Treat beam as projectile-like for description
      }
      // Debuff类型
      else if (kind === "Debuff") {
        debuffActions.push(slotItem);
      }
      // 其他Action
      else {
        otherActions.push(slotItem);
      }
    }
  }
  
  // 1. 目标类型（从targetSlot获取，只在Target在Action之前时显示）
  // 检查Target是否在第一个Action之前
  const firstProjActionIndex = orderedSlots.findIndex((s) => 
    s.slot?.type === "Action" && 
    (s.option?.kind === "SpawnProjectile" || 
     s.option?.kind === "SpawnMultipleProjectiles" || 
     s.option?.kind === "SpawnBurstProjectiles" || 
     s.option?.kind === "SpawnProjectileWithExplosion")
  );
  const effectiveTargetSlot = firstProjActionIndex >= 0 && targetSlot
    ? (orderedSlots.findIndex((s) => s === targetSlot) < firstProjActionIndex ? targetSlot : null)
    : targetSlot;
  
  if (effectiveTargetSlot) {
    const targetKind = effectiveTargetSlot.option?.kind;
    if (targetKind === "singleNearest" || effectiveTargetSlot.option?.id === "line") {
      parts.push("向最近敌人");
    } else if (targetKind === "cone") {
      const label = effectiveTargetSlot.option?.label || "";
      if (label.includes("大扇")) {
        parts.push("扇形范围");
      } else {
        parts.push("小扇形范围");
      }
    } else if (targetKind === "allInRange" || effectiveTargetSlot.option?.id === "allRange") {
      parts.push("范围内所有敌人");
    } else if (targetKind === "lowestHealth" || effectiveTargetSlot.option?.id === "lowestHp") {
      parts.push("向生命值最低的敌人");
    } else if (targetKind === "circle") {
      parts.push("圆形范围");
    }
  } else {
    parts.push("向目标");
  }
  
  // 2. 按照执行顺序描述所有投射物Action
  for (const projAction of projectileActions) {
    const kind = projAction.option?.kind;
    const optionId = projAction.option?.id;
    
    if (kind === "SpawnMultipleProjectiles") {
      const count = projAction.option?.count || 3;
      parts.push(`发射${count}弹散射`);
    } else if (kind === "SpawnBurstProjectiles") {
      const count = projAction.option?.count || 3;
      parts.push(`${count}连发`);
    } else if (kind === "SpawnProjectileWithExplosion") {
      parts.push("发射爆炸弹");
    } else if (kind === "SpawnProjectile") {
      // Check for hover effect first
      if (projAction.option?.hover) {
        const hoverDuration = (projAction.option.hover.hoverDuration || 2000) / 1000;
        parts.push(`发射悬停${hoverDuration}s弹`);
      } else if (optionId === "proj_fast") {
        parts.push("发射快速");
      } else if (optionId === "proj_pierce") {
        parts.push("发射穿透");
      } else if (optionId === "homing") {
        parts.push("发射追踪");
      } else if (optionId === "ricochet3") {
        parts.push("发射弹跳");
      } else if (optionId === "spiral") {
        parts.push("发射螺旋");
      } else if (optionId === "orbit3") {
        const count = projAction.option?.count || 3;
        parts.push(`发射${count}弹环绕`);
      } else if (optionId === "return") {
        parts.push("发射回旋");
      } else if (optionId === "proj_hover" || optionId === "proj_hover_long") {
        const hoverDuration = (projAction.option?.hover?.hoverDuration || 2000) / 1000;
        parts.push(`发射悬停${hoverDuration}s弹`);
      } else {
        parts.push("发射");
      }
    } else if (kind === "Beam") {
      const beamDuration = (projAction.option?.beamDuration || 2000) / 1000;
      parts.push(`发射${beamDuration}s光束`);
    } else if (kind === "ChainTrigger") {
      const triggerEvent = projAction.option?.triggerEvent || "onHit";
      if (triggerEvent === "onHit") {
        parts.push("命中触发");
      } else if (triggerEvent === "onKill") {
        parts.push("击杀触发");
      } else {
        parts.push("连携触发");
      }
    }
  }
  
  // 3. 按照执行顺序描述所有Debuff Action（在投射物之前执行的）
  // 找到在第一个投射物之前执行的Debuff
  const firstProjIndex = orderedSlots.findIndex((s) => 
    s.slot?.type === "Action" && 
    (s.option?.kind === "SpawnProjectile" || 
     s.option?.kind === "SpawnMultipleProjectiles" || 
     s.option?.kind === "SpawnBurstProjectiles" || 
     s.option?.kind === "SpawnProjectileWithExplosion")
  );
  
  for (let i = 0; i < orderedSlots.length; i++) {
    const slotItem = orderedSlots[i];
    if (slotItem.slot?.type === "Action" && slotItem.option?.kind === "Debuff") {
      // 如果这个Debuff在第一个投射物之前，插入到描述前面
      if (firstProjIndex === -1 || i < firstProjIndex) {
        const debuffKind = slotItem.option?.debuff?.kind;
        const debuffDesc = getDebuffDescription(slotItem);
        if (debuffDesc) {
          // 插入到parts的开头（在目标之后，投射物之前）
          const insertIndex = Math.min(1, parts.length);
          parts.splice(insertIndex, 0, debuffDesc);
        }
      }
    }
  }
  
  // 4. 描述伤害类型（SplitDamage等，这些是命中后的效果）
  for (const action of actionSlots) {
    const kind = action.option?.kind;
    if (kind === "SplitDamage") {
      const splitCount = action.option?.splitCount || 3;
      parts.push(`命中后分裂${splitCount}弹`);
    } else if (kind === "ExecuteDamage") {
      parts.push("低生命值时造成处决伤害");
    } else if (kind === "BleedDamage") {
      const bleedDuration = (action.option?.durationMs || 3000) / 1000;
      parts.push(`造成${bleedDuration}秒流血伤害`);
    } else if (kind === "CritDamage") {
      const critChance = Math.round((action.option?.critChance || 0.25) * 100);
      parts.push(`${critChance}%概率暴击`);
    } else if (kind === "BounceDamage") {
      const bounceCount = action.option?.bounceCount || 3;
      parts.push(`弹射伤害${bounceCount}次`);
    } else if (kind === "PierceDamage") {
      const pierceCount = action.option?.pierceCount || 3;
      parts.push(`穿透${pierceCount}个目标`);
    } else if (kind === "ChainDamage") {
      const chainCount = action.option?.chainCount || 3;
      parts.push(`连锁伤害最多${chainCount}次`);
    } else if (kind === "PercentDamage") {
      const percent = (action.option?.percent || 0.05) * 100;
      parts.push(`造成${percent}%最大生命值伤害`);
    } else if (kind === "TrueDamage") {
      parts.push("造成真实伤害");
    } else if (kind === "ReflectDamage") {
      const reflectPercent = Math.round((action.option?.reflectPercent || 0.2) * 100);
      parts.push(`反弹${reflectPercent}%伤害`);
    } else if (kind === "Heal") {
      // 治疗效果也应该在这里处理，确保被包含在描述中
      const healFormula = action.option?.formula;
      if (healFormula) {
        const healAmount = healFormula.flat || 0;
        if (healAmount > 0) {
          parts.push(`恢复${healAmount}生命值`);
        } else {
          parts.push("恢复生命值");
        }
      } else {
        parts.push("恢复生命值");
      }
    }
  }
  
  // 5. 描述其他效果（在投射物之后执行的Debuff等）
  for (let i = 0; i < orderedSlots.length; i++) {
    const slotItem = orderedSlots[i];
    if (slotItem.slot?.type === "Action" && slotItem.option?.kind === "Debuff") {
      // 如果这个Debuff在第一个投射物之后，添加到描述后面
      if (firstProjIndex !== -1 && i > firstProjIndex) {
        const debuffDesc = getDebuffDescription(slotItem);
        if (debuffDesc) {
          parts.push(debuffDesc);
        }
      }
    }
  }
  
  // 6. 其他Action效果
  for (const action of otherActions) {
    const kind = action.option?.kind;
    if (kind === "Blink") {
      const blinkDist = action.option?.distance || 5;
      parts.push(`闪现${blinkDist}m`);
    } else if (kind === "Jump") {
      const jumpDist = action.option?.distance || 5;
      parts.push(`跳跃${jumpDist}m`);
    } else if (kind === "Pull") {
      const pullDist = action.option?.distance || 3;
      parts.push(`拉回${pullDist}m`);
    } else if (kind === "Charge") {
      const maxCharge = (action.option?.maxChargeTime || 2000) / 1000;
      parts.push(`蓄力${maxCharge}s`);
    } else if (kind === "Stack") {
      const maxStacks = action.option?.maxStacks || 3;
      parts.push(`充能${maxStacks}层`);
    } else if (kind === "Summon") {
      const summonType = action.option?.summonType || "minion";
      parts.push(`召唤${summonType === "minion" ? "仆从" : summonType === "pet" ? "宠物" : "分身"}`);
    } else if (kind === "Heal") {
      parts.push("恢复生命值");
    } else if (kind === "Buff") {
      const buffKind = action.option?.buff?.kind;
      if (buffKind === "atkBoost") {
        const boostPower = Math.round((action.option?.buff?.power || 0.2) * 100);
        parts.push(`攻击+${boostPower}%`);
      } else if (buffKind === "speedBoost") {
        const boostPower = Math.round((action.option?.buff?.power || 0.15) * 100);
        parts.push(`速度+${boostPower}%`);
      } else if (buffKind === "defBoost") {
        const boostPower = action.option?.buff?.power || 0;
        parts.push(`防御+${boostPower}`);
      }
    }
  }
  
  // 7. 爆炸效果说明
  const explosiveAction = projectileActions.find((a) => a.option?.kind === "SpawnProjectileWithExplosion");
  if (explosiveAction) {
    parts.push("延迟爆炸");
  }
  
  // 8. Timeline延迟说明
  if (hasDelay && delayMs > 0) {
    const delaySec = (delayMs / 1000).toFixed(1);
    parts.push(`${delaySec}s延迟`);
  }
  
  // 9. 范围信息
  const rangeCond = conditionSlots.find((s) => s.option?.kind === "InRange");
  if (rangeCond && rangeCond.option?.id === "range18") {
    parts.push("（远距离）");
  }
  
  // 组合所有描述片段
  desc = parts.join("，");
  
  return desc || "远程投射攻击";
}

/**
 * 获取Debuff的描述文本
 */
function getDebuffDescription(debuffAction) {
  const debuffKind = debuffAction.option?.debuff?.kind;
  
  if (debuffKind === "slow") {
    const slowPower = Math.round((debuffAction.option?.debuff?.power || 0.2) * 100);
    return `减速${slowPower}%`;
  } else if (debuffKind === "vulnerable") {
    const vulnPower = Math.round((debuffAction.option?.debuff?.power || 0.1) * 100);
    return `易伤${vulnPower}%`;
  } else if (debuffKind === "root") {
    return "定身";
  } else if (debuffKind === "disarm") {
    const disarmDuration = (debuffAction.option?.debuff?.durationMs || 1000) / 1000;
    return `缴械${disarmDuration}s`;
  } else if (debuffKind === "shield") {
    const shieldAmount = debuffAction.option?.debuff?.power || 200;
    return `获得${shieldAmount}护盾`;
  } else if (debuffKind === "knockback") {
    const knockbackDist = debuffAction.option?.debuff?.power || 1.5;
    return `击退${knockbackDist}m`;
  } else if (debuffKind === "stun") {
    const stunDuration = (debuffAction.option?.debuff?.durationMs || 400) / 1000;
    return `眩晕${stunDuration}s`;
  } else if (debuffKind === "fear") {
    const fearDuration = (debuffAction.option?.debuff?.durationMs || 1500) / 1000;
    return `恐惧${fearDuration}s`;
  } else if (debuffKind === "charm") {
    const charmDuration = (debuffAction.option?.debuff?.durationMs || 1200) / 1000;
    return `魅惑${charmDuration}s`;
  } else if (debuffKind === "polymorph") {
    const polyDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
    const polyForm = debuffAction.option?.debuff?.form || "sheep";
    return `变形[${polyForm === "sheep" ? "羊" : polyForm === "frog" ? "蛙" : "其他"}]${polyDuration}s`;
  } else if (debuffKind === "taunt") {
    const tauntDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
    return `嘲讽${tauntDuration}s`;
  } else if (debuffKind === "blind") {
    const blindDuration = (debuffAction.option?.debuff?.durationMs || 1500) / 1000;
    return `致盲${blindDuration}s`;
  } else if (debuffKind === "suppress") {
    const suppressDuration = (debuffAction.option?.debuff?.durationMs || 1000) / 1000;
    return `压制${suppressDuration}s`;
  } else if (debuffKind === "sleep") {
    const sleepDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
    return `睡眠${sleepDuration}s`;
  } else if (debuffKind === "ground") {
    const groundDuration = (debuffAction.option?.debuff?.durationMs || 1500) / 1000;
    return `击倒${groundDuration}s`;
  } else if (debuffKind === "banished") {
    const banishedDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
    return `放逐${banishedDuration}s`;
  } else if (debuffKind === "immunity") {
    const immunityDuration = (debuffAction.option?.debuff?.durationMs || 3000) / 1000;
    return `免疫${immunityDuration}s`;
  } else if (debuffKind === "invulnerable") {
    const invulnDuration = (debuffAction.option?.debuff?.durationMs || 1000) / 1000;
    return `无敌${invulnDuration}s`;
  } else if (debuffKind === "cleanse") {
    return "净化";
  } else if (debuffKind === "stealth") {
    const stealthDuration = (debuffAction.option?.debuff?.durationMs || 3000) / 1000;
    return `隐身${stealthDuration}s`;
  } else if (debuffKind === "haste") {
    const hasteDuration = (debuffAction.option?.debuff?.durationMs || 3000) / 1000;
    return `急速${hasteDuration}s`;
  }
  
  return null;
}

/**
 * 获取负面效果的中文标签
 */
function getNegativeEffectLabel(kind) {
  const labelMap = {
    selfSlow: "自身减速",
    selfVuln: "自身易伤",
    selfRoot: "自身定身",
  };
  return labelMap[kind] || kind;
}

/**
 * 近战爆发类技能描述
 */
function generateMeleeBurstDescription(orderedSlots, actionSlots) {
  // 按照执行顺序找到第一个有效的Action（忽略Timeline和Condition）
  // orderedSlots 已经按照执行顺序排列
  let firstDashAction = null;
  let firstDmgAction = null;
  let firstActionIndex = -1;
  
  // 找到第一个Action（按执行顺序）
  for (let i = 0; i < orderedSlots.length; i++) {
    const slot = orderedSlots[i];
    if (slot.slot?.type === "Action") {
      if (firstActionIndex === -1) {
        firstActionIndex = i;
      }
      if (!firstDashAction && slot.option?.kind === "Dash" && slot.option?.id !== "dash_none") {
        firstDashAction = slot;
      }
      if (!firstDmgAction && slot.option?.kind === "Damage") {
        firstDmgAction = slot;
      }
      // 如果找到了Dash和Damage，可以提前退出（但继续找第一个Action的位置）
    }
  }
  
  // 判断第一个Action是什么类型
  const firstAction = firstActionIndex >= 0 ? orderedSlots[firstActionIndex] : null;
  const isDashFirst = firstAction && firstAction.option?.kind === "Dash" && firstAction.option?.id !== "dash_none";
  const isDmgFirst = firstAction && firstAction.option?.kind === "Damage";

  let desc = "";

  // 根据执行顺序描述：如果Dash在Damage之前，先描述Dash
  if (isDashFirst) {
    const dashDist = firstAction.option?.distance || 5;
    desc += `向前突进${dashDist}m后`;
  } else if (firstDashAction && !isDmgFirst) {
    // Dash存在但不在第一位，仍然描述（因为突进是重要效果）
    const dashDist = firstDashAction.option?.distance || 5;
    desc += `向前突进${dashDist}m后`;
  } else {
    desc += "近战";
  }

  // 伤害类型（如果Damage是第一个Action，或者Dash之后）
  if (isDmgFirst || firstDmgAction) {
    const dmgAction = isDmgFirst ? firstAction : firstDmgAction;
    const dmgId = dmgAction.option?.id;
    if (dmgId?.includes("cone")) {
      desc += "扇形高伤害";
    } else if (dmgId?.includes("line")) {
      desc += "直线穿刺";
    } else {
      desc += "爆发";
    }
  } else {
    desc += "攻击";
  }

  // 收集所有效果描述
  const effects = [];
  
  // 检查位移效果（优先描述）
  const dashAction = actionSlots.find((s) => s.option?.kind === "Dash" && s.option?.id !== "dash_none");
  const blinkAction = actionSlots.find((s) => s.option?.kind === "Blink");
  const jumpAction = actionSlots.find((s) => s.option?.kind === "Jump");
  const pullAction = actionSlots.find((s) => s.option?.kind === "Pull");
  const chargeAction = actionSlots.find((s) => s.option?.kind === "Charge");
  const stackAction = actionSlots.find((s) => s.option?.kind === "Stack");
  const summonAction = actionSlots.find((s) => s.option?.kind === "Summon");
  
  if (blinkAction) {
    const blinkDist = blinkAction.option?.distance || 5;
    effects.push(`闪现${blinkDist}m`);
  }
  
  if (jumpAction) {
    const jumpDist = jumpAction.option?.distance || 5;
    effects.push(`跳跃${jumpDist}m`);
  }
  
  if (pullAction) {
    const pullDist = pullAction.option?.distance || 3;
    effects.push(`拉回${pullDist}m`);
  }
  
  // 检查伤害类型
  const bounceDmgAction = actionSlots.find((s) => s.option?.kind === "BounceDamage");
  const pierceDmgAction = actionSlots.find((s) => s.option?.kind === "PierceDamage");
  const reflectDmgAction = actionSlots.find((s) => s.option?.kind === "ReflectDamage");
  
  if (bounceDmgAction) {
    const bounceCount = bounceDmgAction.option?.bounceCount || 3;
    effects.push(`弹射${bounceCount}次`);
  }
  
  if (pierceDmgAction) {
    const pierceCount = pierceDmgAction.option?.pierceCount || 3;
    effects.push(`穿透${pierceCount}个`);
  }
  
  if (reflectDmgAction) {
    const reflectPercent = Math.round((reflectDmgAction.option?.reflectPercent || 0.2) * 100);
    effects.push(`反弹${reflectPercent}%伤害`);
  }
  
  // 检查所有Debuff效果
  const debuffActions = actionSlots.filter((s) => s.option?.kind === "Debuff");
  for (const debuffAction of debuffActions) {
    const debuffId = debuffAction.option?.id;
    const debuffKind = debuffAction.option?.debuff?.kind;
    
    if (debuffKind === "shield") {
      const shieldAmount = debuffAction.option?.debuff?.power || 200;
      effects.push(`获得${shieldAmount}护盾`);
    } else if (debuffKind === "knockback") {
      const knockbackDist = debuffAction.option?.debuff?.power || 1.5;
      effects.push(`击退${knockbackDist}m`);
    } else if (debuffKind === "stun") {
      const stunDuration = (debuffAction.option?.debuff?.durationMs || 400) / 1000;
      effects.push(`眩晕${stunDuration}s`);
    } else if (debuffKind === "slow") {
      const slowPower = Math.round((debuffAction.option?.debuff?.power || 0.2) * 100);
      effects.push(`减速${slowPower}%`);
    } else if (debuffKind === "root") {
      effects.push("定身");
    } else if (debuffKind === "disarm") {
      effects.push("缴械");
    } else if (debuffKind === "vulnerable") {
      const vulnPower = Math.round((debuffAction.option?.debuff?.power || 0.1) * 100);
      effects.push(`易伤${vulnPower}%`);
    } else if (debuffKind === "selfVuln") {
      effects.push("自易伤");
    } else if (debuffKind === "selfSlow") {
      effects.push("自减速");
    } else if (debuffKind === "selfRoot") {
      effects.push("自定身");
    } else if (debuffKind === "fear") {
      const fearDuration = (debuffAction.option?.debuff?.durationMs || 1500) / 1000;
      effects.push(`恐惧${fearDuration}s`);
    } else if (debuffKind === "charm") {
      const charmDuration = (debuffAction.option?.debuff?.durationMs || 1200) / 1000;
      effects.push(`魅惑${charmDuration}s`);
    } else if (debuffKind === "polymorph") {
      const polyDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
      const polyForm = debuffAction.option?.debuff?.form || "sheep";
      effects.push(`变形${polyForm}${polyDuration}s`);
    } else if (debuffKind === "taunt") {
      const tauntDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
      effects.push(`嘲讽${tauntDuration}s`);
    } else if (debuffKind === "blind") {
      const blindDuration = (debuffAction.option?.debuff?.durationMs || 1500) / 1000;
      effects.push(`致盲${blindDuration}s`);
    } else if (debuffKind === "suppress") {
      const suppressDuration = (debuffAction.option?.debuff?.durationMs || 1000) / 1000;
      effects.push(`压制${suppressDuration}s`);
    } else if (debuffKind === "sleep") {
      const sleepDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
      effects.push(`睡眠${sleepDuration}s`);
    } else if (debuffKind === "ground") {
      const groundDuration = (debuffAction.option?.debuff?.durationMs || 1500) / 1000;
      effects.push(`击倒${groundDuration}s`);
    } else if (debuffKind === "banished") {
      const banishedDuration = (debuffAction.option?.debuff?.durationMs || 2000) / 1000;
      effects.push(`放逐${banishedDuration}s`);
    } else if (debuffKind === "immunity") {
      const immunityDuration = (debuffAction.option?.debuff?.durationMs || 3000) / 1000;
      effects.push(`免疫${immunityDuration}s`);
    } else if (debuffKind === "invulnerable") {
      const invulnDuration = (debuffAction.option?.debuff?.durationMs || 1000) / 1000;
      effects.push(`无敌${invulnDuration}s`);
    } else if (debuffKind === "cleanse") {
      effects.push("净化");
    } else if (debuffKind === "stealth") {
      const stealthDuration = (debuffAction.option?.debuff?.durationMs || 3000) / 1000;
      effects.push(`隐身${stealthDuration}s`);
    } else if (debuffKind === "haste") {
      const hasteDuration = (debuffAction.option?.debuff?.durationMs || 3000) / 1000;
      effects.push(`急速${hasteDuration}s`);
    }
  }
  
  // 检查伤害类型
  const splitDmgAction = actionSlots.find((s) => s.option?.kind === "SplitDamage");
  const executeDmgAction = actionSlots.find((s) => s.option?.kind === "ExecuteDamage");
  const bleedDmgAction = actionSlots.find((s) => s.option?.kind === "BleedDamage");
  const critDmgAction = actionSlots.find((s) => s.option?.kind === "CritDamage");
  
  if (splitDmgAction) {
    const splitCount = splitDmgAction.option?.splitCount || 3;
    effects.push(`分裂${splitCount}弹`);
  }
  
  if (executeDmgAction) {
    effects.push("处决伤害");
  }
  
  if (bleedDmgAction) {
    const bleedDuration = (bleedDmgAction.option?.durationMs || 3000) / 1000;
    effects.push(`流血${bleedDuration}s`);
  }
  
  if (critDmgAction) {
    const critChance = Math.round((critDmgAction.option?.critChance || 0.25) * 100);
    effects.push(`${critChance}%暴击`);
  }
  
  // 检查治疗
  const healAction = actionSlots.find((s) => s.option?.kind === "Heal");
  if (healAction) {
    effects.push("恢复生命值");
  }
  
  // 检查Buff
  const buffAction = actionSlots.find((s) => s.option?.kind === "Buff");
  if (buffAction) {
    const buffKind = buffAction.option?.buff?.kind;
    if (buffKind === "atkBoost") {
      const boostPower = Math.round((buffAction.option?.buff?.power || 0.2) * 100);
      effects.push(`攻击+${boostPower}%`);
    } else if (buffKind === "speedBoost") {
      const boostPower = Math.round((buffAction.option?.buff?.power || 0.15) * 100);
      effects.push(`速度+${boostPower}%`);
    } else if (buffKind === "defBoost") {
      const boostPower = buffAction.option?.buff?.power || 0;
      effects.push(`防御+${boostPower}`);
    }
  }
  
  // 检查特殊机制
  if (chargeAction) {
    const maxCharge = (chargeAction.option?.maxChargeTime || 2000) / 1000;
    effects.push(`蓄力${maxCharge}s`);
  }
  
  if (stackAction) {
    const maxStacks = stackAction.option?.maxStacks || 3;
    effects.push(`充能${maxStacks}层`);
  }
  
  if (summonAction) {
    const summonType = summonAction.option?.summonType || "minion";
    effects.push(`召唤${summonType === "minion" ? "仆从" : summonType === "pet" ? "宠物" : "分身"}`);
  }
  
  // 添加效果描述
  if (effects.length > 0) {
    desc += "，" + effects.join("、");
  }

  return desc || "近战爆发攻击";
}

/**
 * 反击类技能描述
 */
function generateCounterDescription(orderedSlots, conditionSlots, actionSlots) {
  const procCond = conditionSlots.find((s) => s.option?.kind === "ProcChance");
  const pulseAction = actionSlots.find((s) => s.option?.kind === "Damage" && s.option?.id?.includes("pulse"));
  const debuffAction = actionSlots.find((s) => s.option?.kind === "Debuff");
  const dmgAction = actionSlots.find((s) => s.option?.kind === "Damage" && !s.option?.id?.includes("pulse"));

  let desc = "受击时";

  // 触发概率
  if (procCond) {
    const procId = procCond.option?.id;
    if (procId?.includes("35")) {
      desc += "35%概率";
    } else {
      desc += "20%概率";
    }
  }

  // 效果类型
  if (pulseAction) {
    desc += "触发范围脉冲反击";
  } else {
    desc += "反击";
  }

  // 控制效果
  if (debuffAction) {
    const debuffId = debuffAction.option?.id;
    if (debuffId?.includes("silence")) {
      desc += "，沉默敌人";
    } else if (debuffId?.includes("slow")) {
      desc += "，减速敌人";
    }
  }

  // 伤害等级
  if (dmgAction) {
    const dmgId = dmgAction.option?.id;
    if (dmgId?.includes("mid")) {
      desc += "并造成中等伤害";
    } else if (dmgId?.includes("high")) {
      desc += "并造成高伤害";
    }
  }

  return desc || "受击反击";
}

/**
 * 地面持续类技能描述
 */
function generateGroundDotDescription(orderedSlots, targetSlot, actionSlots) {
  const dotAction = actionSlots.find((s) => s.option?.kind === "SpawnAreaDoT");
  const debuffAction = actionSlots.find((s) => s.option?.kind === "Debuff");

  let desc = "";

  // 范围信息
  if (targetSlot) {
    const radius = targetSlot.option?.id?.includes("r4") ? 4 : 3;
    desc += `在${radius}米半径圆形区域`;
  } else {
    desc += "在指定区域";
  }

  // 持续时间
  if (dotAction) {
    const dotId = dotAction.option?.id;
    if (dotId?.includes("6s")) {
      desc += "释放6秒持续伤害";
    } else {
      desc += "释放4秒持续伤害";
    }
  } else {
    desc += "释放持续伤害";
  }

  // 附加效果
  if (debuffAction) {
    const debuffId = debuffAction.option?.id;
    if (debuffId?.includes("slow")) {
      desc += "，同时减速区域内敌人";
    } else if (debuffId?.includes("no_heal")) {
      desc += "，同时禁止区域内敌人回复";
    }
  }

  return desc || "地面持续伤害";
}

/**
 * 标记收割类技能描述
 */
function generateMarkExecDescription(orderedSlots, actionSlots) {
  const markAction = actionSlots.find((s) => s.option?.kind === "Mark");
  const bonusAction = actionSlots.find((s) => s.option?.kind === "BonusDrop");

  let desc = "标记目标";

  if (bonusAction) {
    desc += "，击杀时获得额外掉落奖励";
  } else {
    desc += "，击杀时获得奖励";
  }

  return desc || "标记目标并收割";
}

/**
 * 通用技能描述生成（动态模板专用）
 * 按照 ECA 执行顺序生成完整描述，包含所有效果
 */
function generateGenericDescription(template, orderedSlots, targetSlot, actionSlots, conditionSlots) {
  if (!actionSlots || actionSlots.length === 0) {
    return "未知技能";
  }

  const parts = [];

  // 检查是否是主效果+副效果架构
  const coreSkillId = template?._coreSkill;
  const supportModifierIds = template?._supportModifiers || [];
  const negativeEffects = template?._negativeEffects || [];
  
  // 1. 识别事件类型（从模板中获取）
  const eventId = template?.event || "CastConfirm";
  const isOnDamaged = eventId === "OnDamaged";

  // 2. 识别条件（触发概率等）
  const procChanceCondition = conditionSlots.find((c) => c.option?.kind === "ProcChance");
  if (procChanceCondition && isOnDamaged) {
    const chance = procChanceCondition.option?.chance || 0.2;
    parts.push(`受击时${Math.floor(chance * 100)}%概率`);
  } else if (isOnDamaged) {
    parts.push("受击时");
  }
  
  // 如果是主效果+副效果架构，优先使用主效果描述
  if (coreSkillId) {
    const coreSkill = CORE_SKILLS.find(s => s.id === coreSkillId);
    if (coreSkill) {
      // 找到主效果动作选项（已应用副效果）
      const mainActionSlot = actionSlots.find(a => 
        a.option?._coreSkill === coreSkillId || 
        a.option?.id?.startsWith(`core_${coreSkillId}`)
      );
      
      if (mainActionSlot) {
        // 从实际动作选项中读取应用后的效果
        const actionOption = mainActionSlot.option;
        const actionKind = actionOption?.kind;
        
        // 构建详细描述
        let descParts = [];
        
        // 1. 目标选择
        if (targetSlot) {
          const targetKind = targetSlot.option?.kind;
          if (targetKind === "singleNearest" || targetKind === "line") {
            descParts.push("向最近敌人");
          } else if (targetKind === "lowestHealth") {
            descParts.push("向生命值最低的敌人");
          } else if (targetKind === "cone") {
            const range = targetSlot.option?.range || 10;
            descParts.push(`扇形${range}米范围`);
          } else if (targetKind === "circle" || targetKind === "allInRange") {
            const radius = targetSlot.option?.radius || targetSlot.option?.range || 8;
            descParts.push(`半径${radius}米范围`);
          }
        }
        
        // 2. 主效果类型描述
        if (actionKind === "SpawnProjectile") {
          let projDesc = "发射";
          
          // 检查投射物修饰符（从实际动作选项中读取）
          if (actionOption?.homing) {
            projDesc += "追踪";
          }
          if (actionOption?.spiral) {
            projDesc += "螺旋";
          }
          if (actionOption?.ricochet) {
            projDesc += "弹跳";
          }
          if (actionOption?.orbit) {
            projDesc += "环绕";
          }
          if (actionOption?.return) {
            projDesc += "回旋";
          }
          if (actionOption?.hover) {
            projDesc += "悬停";
          }
          if (actionOption?.pierceCount && actionOption.pierceCount > 0) {
            projDesc += `穿透${actionOption.pierceCount}个目标`;
          }
          if (actionOption?.splitOnHit) {
            projDesc += `命中分裂${actionOption.splitCount || 3}发`;
          }
          if (actionOption?.chainOnHit) {
            projDesc += `连锁${actionOption.chainCount || 3}个目标`;
          }
          if (actionOption?.explosionOnHit) {
            projDesc += "爆炸";
          }
          
          if (projDesc === "发射") {
            projDesc += "投射物";
          } else {
            projDesc += "弹";
          }
          
          descParts.push(projDesc);
        } else if (actionKind === "SpawnMultipleProjectiles") {
          const count = actionOption?.count || 3;
          descParts.push(`发射${count}发散射弹`);
        } else if (actionKind === "SpawnBurstProjectiles") {
          const count = actionOption?.count || 3;
          descParts.push(`发射${count}连发弹`);
        } else if (actionKind === "SpawnProjectileWithExplosion") {
          descParts.push("发射爆炸弹");
        } else if (actionKind === "Beam") {
          const length = actionOption?.beamLength || 12;
          const duration = actionOption?.beamDuration || 1500;
          descParts.push(`发射${length}米光束（持续${duration/1000}秒）`);
        } else if (actionKind === "Damage") {
          descParts.push("近战攻击");
        } else if (actionKind === "SpawnAreaDoT") {
          const radius = actionOption?.radius || 3;
          descParts.push(`施放${radius}米范围持续伤害`);
        } else if (actionKind === "Summon") {
          descParts.push("召唤");
        }
        
        // 3. 副效果描述（详细效果）
        const supportDetails = [];
        for (const supportId of supportModifierIds) {
          const support = SUPPORT_MODIFIERS.find(s => s.id === supportId);
          if (support) {
            let supportDesc = support.label;
            
            // 添加副效果的详细效果描述
            if (support.effects.damageMultiplier && support.effects.damageMultiplier !== 1.0) {
              const multiplier = support.effects.damageMultiplier;
              if (multiplier > 1.0) {
                supportDesc += `（伤害+${Math.floor((multiplier - 1) * 100)}%）`;
              } else {
                supportDesc += `（伤害${Math.floor((1 - multiplier) * 100)}%）`;
              }
            }
            
            if (support.effects.projectileSpeedMultiplier && support.effects.projectileSpeedMultiplier !== 1.0) {
              const speedMult = support.effects.projectileSpeedMultiplier;
              if (speedMult > 1.0) {
                supportDesc += `（速度+${Math.floor((speedMult - 1) * 100)}%）`;
              } else {
                supportDesc += `（速度${Math.floor((1 - speedMult) * 100)}%）`;
              }
            }
            
            if (support.effects.areaRadiusMultiplier && support.effects.areaRadiusMultiplier !== 1.0) {
              const areaMult = support.effects.areaRadiusMultiplier;
              supportDesc += `（范围+${Math.floor((areaMult - 1) * 100)}%）`;
            }
            
            if (support.effects.lifestealPercent) {
              supportDesc += `（${Math.floor(support.effects.lifestealPercent * 100)}%生命偷取）`;
            }
            
            if (support.effects.shieldOnHit) {
              supportDesc += `（命中+${support.effects.shieldOnHit}护盾）`;
            }
            
            if (support.effects.enableCharge) {
              supportDesc += `（蓄力${support.effects.maxChargeTime/1000}秒）`;
            }
            
            if (support.effects.castCount) {
              supportDesc += `（${support.effects.castCount}次施法）`;
            }
            
            supportDetails.push(supportDesc);
          }
        }
        
        if (supportDetails.length > 0) {
          descParts.push(`（${supportDetails.join("、")}）`);
        }
        
        // 4. 负面效果描述
        if (negativeEffects.length > 0) {
          descParts.push(`【负面：${negativeEffects.map(e => getNegativeEffectLabel(e.kind)).join("、")}】`);
        }
        
        // 5. 伤害描述（如果有公式）
        if (actionOption?.formula) {
          const scale = actionOption.formula.scale || 0;
          const flat = actionOption.formula.flat || 0;
          if (scale > 0.8 || flat > 40) {
            descParts.push("造成高伤害");
          } else if (scale > 0.5 || flat > 20) {
            descParts.push("造成中等伤害");
          } else {
            descParts.push("造成伤害");
          }
        }
        
        parts.push(...descParts);
        return parts.join("");
      } else {
        // 如果没有找到主效果动作，使用简化描述
        let mainDesc = coreSkill.label;
        
        const supportLabels = [];
        for (const supportId of supportModifierIds) {
          const support = SUPPORT_MODIFIERS.find(s => s.id === supportId);
          if (support) {
            supportLabels.push(support.label);
          }
        }
        if (supportLabels.length > 0) {
          mainDesc += `（${supportLabels.join("、")}）`;
        }
        
        if (negativeEffects.length > 0) {
          mainDesc += `【负面：${negativeEffects.map(e => getNegativeEffectLabel(e.kind)).join("、")}】`;
        }
        
        parts.push(mainDesc);
        return parts.join("");
      }
    }
  }
  
  // 3. 识别目标选择
  if (targetSlot) {
    const targetKind = targetSlot.option?.kind;
    const targetId = targetSlot.option?.id;
    
    if (targetKind === "singleNearest" || targetKind === "line") {
      parts.push("对最近敌人");
    } else if (targetKind === "cone") {
      const range = targetSlot.option?.range || 10;
      const max = targetSlot.option?.max || 3;
      parts.push(`扇形${range}米范围${max}个目标`);
    } else if (targetKind === "circle" || targetKind === "allInRange") {
      const radius = targetSlot.option?.radius || targetSlot.option?.range || 8;
      const maxCount = targetSlot.option?.maxCount || 10;
      parts.push(`半径${radius}米范围内${maxCount}个目标`);
    } else if (targetKind === "lowestHealth") {
      parts.push("对生命值最低的敌人");
    } else {
      parts.push("对目标");
    }
  }
  
  // 4. 按顺序处理所有动作
  const projectileActions = [];
  const damageActions = [];
  const debuffActions = [];
  const buffActions = [];
  const mobilityActions = [];
  const specialActions = [];
  
  for (const actionSlot of actionSlots) {
    const kind = actionSlot.option?.kind;
    const optionId = actionSlot.option?.id || "";
    
    if (kind === "SpawnProjectile" || 
        kind === "SpawnMultipleProjectiles" || 
        kind === "SpawnBurstProjectiles" || 
        kind === "SpawnProjectileWithExplosion" ||
        kind === "Beam") {
      projectileActions.push(actionSlot);
    } else if (kind === "Damage" || 
               kind === "PercentDamage" || 
               kind === "TrueDamage" ||
               kind === "ChainDamage" ||
               kind === "BounceDamage" ||
               kind === "PierceDamage" ||
               kind === "SplitDamage" ||
               kind === "ExecuteDamage" ||
               kind === "BleedDamage" ||
               kind === "CritDamage" ||
               kind === "ReflectDamage" ||
               kind === "AreaDamage") {
      damageActions.push(actionSlot);
    } else if (kind === "Debuff") {
      debuffActions.push(actionSlot);
    } else if (kind === "Buff" || kind === "Heal") {
      buffActions.push(actionSlot);
    } else if (kind === "Dash" || kind === "Blink" || kind === "Jump" || kind === "Pull") {
      mobilityActions.push(actionSlot);
    } else {
      specialActions.push(actionSlot);
    }
  }
  
  // 5. 生成投射物描述
  for (const projAction of projectileActions) {
    const kind = projAction.option?.kind;
    const optionId = projAction.option?.id || "";
    const label = projAction.option?.label || "";
    
    if (kind === "Beam") {
      const length = projAction.option?.beamLength || 12;
      const duration = projAction.option?.beamDuration || 1500;
      parts.push(`发射${length}米光束（持续${duration/1000}秒）`);
    } else if (kind === "SpawnMultipleProjectiles") {
      const count = projAction.option?.count || 3;
      parts.push(`发射${count}发散射弹`);
    } else if (kind === "SpawnBurstProjectiles") {
      const count = projAction.option?.count || 3;
      parts.push(`发射${count}连发弹`);
    } else if (kind === "SpawnProjectileWithExplosion") {
      parts.push("发射爆炸弹");
    } else {
      // 检查投射物修饰符
      let projDesc = "发射";
      
      if (optionId.includes("homing") || projAction.option?.homing) {
        projDesc += "追踪";
      }
      if (optionId.includes("spiral") || projAction.option?.spiral) {
        projDesc += "螺旋";
      }
      if (optionId.includes("ricochet") || projAction.option?.ricochet) {
        projDesc += "弹跳";
      }
      if (optionId.includes("orbit") || projAction.option?.orbit) {
        projDesc += "环绕";
      }
      if (optionId.includes("return") || projAction.option?.return) {
        projDesc += "回旋";
      }
      if (optionId.includes("hover") || projAction.option?.hover) {
        projDesc += "悬停";
      }
      
      if (projDesc === "发射") {
        // 优先使用label，如果没有则使用optionId推断，最后使用默认值
        if (label) {
          projDesc += label;
        } else if (optionId.includes("fast") || optionId === "proj_fast") {
          projDesc += "快速弹";
        } else if (optionId.includes("slow") || optionId === "proj_slow") {
          projDesc += "慢速弹";
        } else if (optionId.includes("pierce") || optionId === "proj_pierce") {
          projDesc += "穿透弹";
        } else {
          projDesc += "投射物";
        }
      } else {
        projDesc += "弹";
      }
      
      parts.push(projDesc);
    }
  }
  
  // 6. 生成伤害描述
  for (const dmgAction of damageActions) {
    const kind = dmgAction.option?.kind;
    const optionId = dmgAction.option?.id || "";
    const label = dmgAction.option?.label || "";
    
    if (kind === "PercentDamage") {
      const percent = dmgAction.option?.percent || 0.05;
      parts.push(`造成${Math.floor(percent * 100)}%最大生命伤害`);
    } else if (kind === "TrueDamage") {
      parts.push("造成真实伤害");
    } else if (kind === "ChainDamage") {
      const count = dmgAction.option?.chainCount || 3;
      parts.push(`造成${count}次连锁伤害`);
    } else if (kind === "BounceDamage") {
      const count = dmgAction.option?.bounceCount || 3;
      parts.push(`造成${count}次弹射伤害`);
    } else if (kind === "PierceDamage") {
      const count = dmgAction.option?.pierceCount || 3;
      parts.push(`造成穿透${count}个目标伤害`);
    } else if (kind === "SplitDamage") {
      const count = dmgAction.option?.splitCount || 3;
      parts.push(`命中后分裂成${count}发`);
    } else if (kind === "ExecuteDamage") {
      parts.push("对低生命值目标造成处决伤害");
    } else if (kind === "BleedDamage") {
      const duration = dmgAction.option?.durationMs || 3000;
      parts.push(`造成${duration/1000}秒流血伤害`);
    } else if (kind === "CritDamage") {
      const chance = dmgAction.option?.critChance || 0.25;
      parts.push(`造成${Math.floor(chance * 100)}%暴击伤害`);
    } else if (kind === "ReflectDamage") {
      const percent = dmgAction.option?.reflectPercent || 0.2;
      parts.push(`反弹${Math.floor(percent * 100)}%伤害`);
    } else if (kind === "AreaDamage") {
      const radius = dmgAction.option?.radius || 3;
      parts.push(`造成${radius}米范围伤害`);
    } else {
      // 普通伤害，根据 label 判断
      if (label.includes("高伤") || optionId.includes("high")) {
        parts.push("造成高伤害");
      } else if (label.includes("中伤") || optionId.includes("mid")) {
        parts.push("造成中等伤害");
      } else if (label.includes("轻伤") || optionId.includes("light")) {
        parts.push("造成轻伤害");
      } else {
        parts.push("造成伤害");
      }
    }
  }
  
  // 7. 生成 Debuff 描述
  for (const debuffAction of debuffActions) {
    const debuffKind = debuffAction.option?.debuff?.kind || "";
    const duration = debuffAction.option?.debuff?.durationMs || 1000;
    const power = debuffAction.option?.debuff?.power || 1.0;
    
    if (debuffKind === "slow") {
      const slowPercent = Math.floor(power * 100);
      parts.push(`减速${slowPercent}%持续${duration/1000}秒`);
    } else if (debuffKind === "root") {
      parts.push(`定身${duration/1000}秒`);
    } else if (debuffKind === "disarm") {
      parts.push(`缴械${duration/1000}秒`);
    } else if (debuffKind === "stun") {
      parts.push(`眩晕${duration/1000}秒`);
    } else if (debuffKind === "silence") {
      parts.push(`沉默${duration/1000}秒`);
    } else if (debuffKind === "fear") {
      parts.push(`恐惧${duration/1000}秒`);
    } else if (debuffKind === "charm") {
      parts.push(`魅惑${duration/1000}秒`);
    } else if (debuffKind === "blind") {
      parts.push(`致盲${duration/1000}秒`);
    } else if (debuffKind === "knockback") {
      const distance = debuffAction.option?.debuff?.power || 1.5;
      parts.push(`击退${distance}米`);
    } else if (debuffKind === "pull") {
      const distance = debuffAction.option?.debuff?.power || 3;
      parts.push(`拉回${distance}米`);
    } else if (debuffKind === "vulnerable") {
      const vulnPercent = Math.floor(power * 100);
      parts.push(`易伤${vulnPercent}%持续${duration/1000}秒`);
    } else if (debuffKind === "shield") {
      const shieldAmount = debuffAction.option?.debuff?.power || 200;
      parts.push(`获得${shieldAmount}护盾`);
    } else if (debuffKind === "stealth") {
      parts.push(`隐身${duration/1000}秒`);
    } else if (debuffKind === "haste") {
      parts.push(`急速${duration/1000}秒`);
    } else {
      // 尝试使用label或optionId来生成中文描述
      const optionLabel = debuffAction.option?.label || "";
      const optionId = debuffAction.option?.id || "";
      
      if (optionLabel) {
        parts.push(optionLabel);
      } else if (optionId) {
        // 如果label不存在，尝试从optionId推断
        const debuffMap = {
          "slow": "减速",
          "root": "定身",
          "disarm": "缴械",
          "stun": "眩晕",
          "silence": "沉默",
          "fear": "恐惧",
          "charm": "魅惑",
          "blind": "致盲",
          "knockback": "击退",
          "pull": "拉回",
          "vulnerable": "易伤",
          "shield": "护盾",
          "stealth": "隐身",
          "haste": "急速",
        };
        const chineseName = debuffMap[debuffKind] || debuffKind;
        parts.push(`施加${chineseName}效果`);
      } else {
        parts.push(`施加${debuffKind}效果`);
      }
    }
  }
  
  // 8. 生成 Buff/Heal 描述
  for (const buffAction of buffActions) {
    const kind = buffAction.option?.kind;
    
    if (kind === "Heal") {
      const label = buffAction.option?.label || "";
      if (label.includes("轻")) {
        parts.push("恢复少量生命");
      } else {
        parts.push("恢复生命");
      }
    } else if (kind === "Buff") {
      const buffKind = buffAction.option?.buff?.kind || "";
      const duration = buffAction.option?.buff?.durationMs || 5000;
      
      if (buffKind === "atkBoost") {
        const boost = Math.floor(buffAction.option?.buff?.power * 100);
        parts.push(`攻击力提升${boost}%持续${duration/1000}秒`);
      } else if (buffKind === "speedBoost") {
        const boost = Math.floor(buffAction.option?.buff?.power * 100);
        parts.push(`移动速度提升${boost}%持续${duration/1000}秒`);
      } else if (buffKind === "defBoost") {
        const boost = buffAction.option?.buff?.power || 0;
        parts.push(`防御力提升${boost}持续${duration/1000}秒`);
      }
    }
  }
  
  // 9. 生成移动描述
  for (const mobAction of mobilityActions) {
    const kind = mobAction.option?.kind;
    const distance = mobAction.option?.distance || 5;
    
    if (kind === "Dash") {
      parts.push(`突进${distance}米`);
    } else if (kind === "Blink") {
      parts.push(`闪现${distance}米`);
    } else if (kind === "Jump") {
      parts.push(`跳跃${distance}米`);
    } else if (kind === "Pull") {
      parts.push(`拉回${distance}米`);
    }
  }
  
  // 10. 生成特殊机制描述
  for (const specAction of specialActions) {
    const kind = specAction.option?.kind;
    
    if (kind === "Charge") {
      const maxCharge = specAction.option?.maxChargeTime || 2000;
      parts.push(`蓄力${maxCharge/1000}秒`);
    } else if (kind === "Mark") {
      const tag = specAction.option?.tag || "";
      if (tag.includes("hunt")) {
        parts.push("标记目标");
      } else {
        parts.push("施加印记");
      }
    } else if (kind === "MarkReward") {
      parts.push("击杀时获得奖励");
    } else if (kind === "SpawnAreaDoT") {
      const radius = specAction.option?.radius || 3;
      const duration = specAction.option?.durationMs || 4000;
      parts.push(`在${radius}米半径区域释放${duration/1000}秒持续伤害`);
    } else if (kind === "Summon") {
      parts.push("召唤仆从");
    } else if (kind === "Stack") {
      const maxStacks = specAction.option?.maxStacks || 3;
      parts.push(`充能${maxStacks}层`);
    }
  }
  
  // 11. 识别时间线延迟
  const timelineSlots = orderedSlots.filter((s) => s.slot?.type === "Timeline");
  for (const timelineSlot of timelineSlots) {
    const delayMs = timelineSlot.option?.delayMs || 0;
    if (delayMs > 0) {
      parts.push(`延迟${delayMs/1000}秒生效`);
    }
  }
  
  // 组合所有部分
  let desc = parts.join("，");
  
  // 如果没有生成任何描述，使用默认描述
  if (!desc || desc.trim() === "") {
    desc = "释放技能";
  }
  
  return desc;
}

/**
 * 生成修仙风格的法器名称
 * @param {Object} template - 技能模板
 * @param {string[]} order - 槽位顺序
 * @param {Object} slotOptions - 槽位选项映射
 * @param {Function} rng - 随机数生成器（可选）
 * @returns {string} 法器名称
 */
function generateArtifactName(template, order, slotOptions, rng = null) {
  const random = rng || (() => Math.random());
  
  // 法器名称前缀（材质/属性）
  const prefixes = [
    "赤炎", "寒冰", "雷霆", "狂风", "土石", "金光", "紫电", "青木",
    "玄铁", "白玉", "黑曜", "翡翠", "琉璃", "星辰", "月华", "日轮",
    "血煞", "幽冥", "天罡", "地煞", "阴阳", "五行", "八卦", "九宫",
  ];
  
  // 法器名称中缀（类型）
  const middles = [
    "飞剑", "法杖", "宝珠", "灵符", "法印", "神镜", "仙扇", "玉笛",
    "铜铃", "法轮", "宝塔", "葫芦", "丹炉", "阵盘", "符箓", "法剑",
    "灵珠", "法幡", "仙索", "神鞭", "法尺", "宝鉴", "仙琴", "法鼓",
  ];
  
  // 法器名称后缀（品质/特性）
  const suffixes = [
    "", "·初阶", "·中阶", "·高阶", "·极品", "·仙品", "·神品",
    "·上品", "·下品", "·凡品", "·灵品", "·圣品",
  ];
  
  // 根据技能特性选择前缀
  const actionSlots = order.map((slotId) => {
    const slot = template.slots.find((s) => s.id === slotId);
    const optionId = slotOptions[slotId] || slot?.defaultOption;
    const option = slot?.options.find((o) => o.id === optionId);
    return { slot, option, slotId };
  }).filter((s) => s.slot?.type === "Action");
  
  let selectedPrefix = prefixes[Math.floor(random() * prefixes.length)];
  
  // 根据动作类型调整前缀
  for (const actionSlot of actionSlots) {
    const kind = actionSlot.option?.kind || "";
    const optionId = actionSlot.option?.id || "";
    
    if (kind === "Beam" || optionId.includes("beam")) {
      selectedPrefix = ["紫电", "金光", "星辰", "月华"][Math.floor(random() * 4)];
    } else if (kind === "SpawnAreaDoT" || optionId.includes("area")) {
      selectedPrefix = ["赤炎", "血煞", "幽冥"][Math.floor(random() * 3)];
    } else if (kind === "SpawnProjectile" && (optionId.includes("hover") || actionSlot.option?.hover)) {
      selectedPrefix = ["月华", "星辰", "青木"][Math.floor(random() * 3)];
    } else if (kind === "ChainDamage" || optionId.includes("chain")) {
      selectedPrefix = ["雷霆", "紫电"][Math.floor(random() * 2)];
    }
    break; // 只检查第一个动作
  }
  
  const middle = middles[Math.floor(random() * middles.length)];
  const suffix = suffixes[Math.floor(random() * suffixes.length)];
  
  return `${selectedPrefix}${middle}${suffix}`;
}

/**
 * 将技能描述转换为修仙风格
 * @param {string} baseDesc - 基础技能描述
 * @param {Object} template - 技能模板
 * @param {string[]} order - 槽位顺序
 * @param {Object} slotOptions - 槽位选项映射
 * @returns {string} 修仙风格的描述
 */
function convertToCultivationStyle(baseDesc, template, order, slotOptions) {
  // 替换映射：将现代游戏术语转换为修仙术语
  const replacements = [
    // 动作替换
    { from: /发射/g, to: "祭出" },
    { from: /投射物/g, to: "法诀" },
    { from: /弹/g, to: "法弹" },
    { from: /光束/g, to: "神光" },
    { from: /散射弹/g, to: "散射法诀" },
    { from: /连发弹/g, to: "连发法诀" },
    { from: /爆炸弹/g, to: "爆裂法诀" },
    { from: /追踪弹/g, to: "追踪法诀" },
    { from: /螺旋弹/g, to: "螺旋法诀" },
    { from: /弹跳弹/g, to: "弹跳法诀" },
    { from: /环绕弹/g, to: "环绕法诀" },
    { from: /回旋弹/g, to: "回旋法诀" },
    { from: /悬停弹/g, to: "悬停法诀" },
    
    // 伤害替换
    { from: /造成伤害/g, to: "造成伤害" },
    { from: /高伤害/g, to: "重创" },
    { from: /中等伤害/g, to: "创伤" },
    { from: /轻伤害/g, to: "轻伤" },
    { from: /真实伤害/g, to: "真实伤害" },
    { from: /连锁伤害/g, to: "连锁伤害" },
    { from: /弹射伤害/g, to: "弹射伤害" },
    { from: /穿透伤害/g, to: "穿透伤害" },
    { from: /分裂/g, to: "分化" },
    { from: /处决伤害/g, to: "必杀一击" },
    { from: /流血伤害/g, to: "持续流血" },
    { from: /暴击伤害/g, to: "暴击" },
    { from: /反弹伤害/g, to: "反伤" },
    
    // 控制效果替换
    { from: /减速/g, to: "迟缓" },
    { from: /定身/g, to: "定身" },
    { from: /缴械/g, to: "封禁" },
    { from: /眩晕/g, to: "眩晕" },
    { from: /沉默/g, to: "禁言" },
    { from: /恐惧/g, to: "震慑" },
    { from: /魅惑/g, to: "魅惑" },
    { from: /致盲/g, to: "失明" },
    { from: /击退/g, to: "震退" },
    { from: /拉回/g, to: "牵引" },
    { from: /易伤/g, to: "破防" },
    { from: /护盾/g, to: "护体" },
    { from: /隐身/g, to: "隐匿" },
    { from: /急速/g, to: "加速" },
    
    // 增益效果替换
    { from: /恢复生命/g, to: "恢复气血" },
    { from: /恢复少量生命/g, to: "恢复少量气血" },
    { from: /攻击力提升/g, to: "攻击力提升" },
    { from: /移动速度提升/g, to: "身法提升" },
    { from: /防御力提升/g, to: "防御力提升" },
    
    // 移动效果替换
    { from: /突进/g, to: "疾冲" },
    { from: /闪现/g, to: "瞬移" },
    { from: /跳跃/g, to: "腾跃" },
    
    // 特殊机制替换
    { from: /蓄力/g, to: "蓄力" },
    { from: /标记目标/g, to: "标记目标" },
    { from: /施加印记/g, to: "施加印记" },
    { from: /击杀时获得奖励/g, to: "击杀时获得奖励" },
    { from: /持续伤害/g, to: "持续伤害" },
    { from: /召唤仆从/g, to: "召唤灵兽" },
    { from: /充能/g, to: "充能" },
    
    // 目标替换
    { from: /对最近敌人/g, to: "对最近敌人" },
    { from: /对目标/g, to: "对目标" },
    { from: /对生命值最低的敌人/g, to: "对气血最低的敌人" },
    { from: /范围内/g, to: "范围内" },
    { from: /扇形/g, to: "扇形" },
    { from: /圆形/g, to: "圆形" },
    { from: /半径/g, to: "半径" },
    { from: /米/g, to: "丈" },
    
    // 时间替换
    { from: /秒/g, to: "息" },
    { from: /延迟/g, to: "延迟" },
    { from: /持续/g, to: "持续" },
    
    // 事件替换
    { from: /受击时/g, to: "受击时" },
    { from: /概率/g, to: "概率" },
  ];
  
  let cultivationDesc = baseDesc;
  
  // 应用所有替换
  for (const replacement of replacements) {
    cultivationDesc = cultivationDesc.replace(replacement.from, replacement.to);
  }
  
  // 添加修仙风格的修饰
  const styleModifiers = [
    "此乃",
    "此法器",
    "此宝",
    "此物",
  ];
  
  const modifier = styleModifiers[Math.floor(Math.random() * styleModifiers.length)];
  
  return `${modifier}可${cultivationDesc}。`;
}

/**
 * 生成完整的技能描述（包含修仙风格包装）
 * @param {Object} template - 技能模板
 * @param {string[]} order - 槽位顺序
 * @param {Object} slotOptions - 槽位选项映射
 * @param {Function} rng - 随机数生成器（可选）
 * @returns {Object} 包含基础描述、法器名称和修仙描述的对象
 */
export function generateFullSkillDescription(template, order, slotOptions, rng = null) {
  const baseDesc = generateSkillDescription(template, order, slotOptions);
  const artifactName = generateArtifactName(template, order, slotOptions, rng);
  const cultivationDesc = convertToCultivationStyle(baseDesc, template, order, slotOptions);
  
  return {
    base: baseDesc,
    artifactName: artifactName,
    cultivation: cultivationDesc,
  };
}
