/**
 * 技能描述生成器
 * 根据 Assembly 的 order 和 slotOptions 生成一句话技能描述
 */

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
  const targetSlot = orderedSlots.find((s) => s.slot?.type === "Target");
  const actionSlots = orderedSlots.filter((s) => s.slot?.type === "Action");
  const conditionSlots = orderedSlots.filter((s) => s.slot?.type === "Condition");
  const timelineSlots = orderedSlots.filter((s) => s.slot?.type === "Timeline");

  // 根据模板类型生成描述
  const templateId = template.id;

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
  return generateGenericDescription(orderedSlots, targetSlot, actionSlots);
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
  
  // 1. 目标类型（从targetSlot获取）
  if (targetSlot) {
    const targetKind = targetSlot.option?.kind;
    if (targetKind === "singleNearest" || targetSlot.option?.id === "line") {
      parts.push("向最近敌人");
    } else if (targetKind === "cone") {
      const label = targetSlot.option?.label || "";
      if (label.includes("大扇")) {
        parts.push("扇形范围");
      } else {
        parts.push("小扇形范围");
      }
    } else if (targetKind === "allInRange" || targetSlot.option?.id === "allRange") {
      parts.push("范围内所有敌人");
    } else if (targetKind === "lowestHealth" || targetSlot.option?.id === "lowestHp") {
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
 * 通用技能描述生成
 */
function generateGenericDescription(orderedSlots, targetSlot, actionSlots) {
  const firstAction = actionSlots[0];
  if (!firstAction) {
    return "未知技能";
  }

  const actionKind = firstAction.option?.kind;
  let desc = "";

  if (targetSlot) {
    const targetKind = targetSlot.option?.kind;
    if (targetKind === "singleNearest") {
      desc += "对最近敌人";
    } else if (targetKind === "cone") {
      desc += "扇形范围";
    } else if (targetKind === "circle") {
      desc += "圆形范围";
    }
  }

  if (actionKind === "Damage") {
    desc += "造成伤害";
  } else if (actionKind === "SpawnProjectile") {
    desc += "发射投射物";
  } else if (actionKind === "Dash") {
    desc += "突进";
  } else {
    desc += "释放技能";
  }

  return desc || "技能释放";
}
