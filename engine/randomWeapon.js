/**
 * 随机武器生成器
 * 每次体验时生成随机的技能 Assembly
 */

import { compileAssembly } from "./runtime.js";
import { createRng } from "./rng.js";
import { generateSkillDescription } from "./skillDescription.js";
import { generateRandomPresentationParams } from "./presentationParams.js";
import { selectTierByWeight, filterTemplatesByTier, getTemplateTier } from "./templateTiers.js";
import { checkSynergy, checkAllSynergies, extractEffectIds } from "./synergy.js";

// 记录最近生成的武器（用于避免重复）
let recentWeapons = [];
const MAX_RECENT_WEAPONS = 20;

/**
 * 生成随机武器
 * @param {Array} templates - 所有可用模板
 * @param {number|Object} seed - 随机种子（数字或 RNG 对象）
 * @returns {Object} 随机生成的 Assembly 对象，包含 templateId, order, slotOptions, description, isRandom
 */
export function generateRandomWeapon(templates, seed) {
  if (!templates || templates.length === 0) {
    throw new Error("No templates available");
  }

  // 使用更好的随机种子：时间戳 + 随机数 + 计数器
  const baseSeed = typeof seed === "number" ? seed : Date.now();
  const enhancedSeed = baseSeed + Math.floor(Math.random() * 1000000) + recentWeapons.length;
  const rng = typeof seed === "object" ? seed : createRng(enhancedSeed);

  let attempts = 0;
  const maxAttempts = 50; // 最多尝试50次以避免无限循环
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // 1. 根据分级权重选择模板分级（简单70%，普通25%，复杂5%）
    const selectedTier = selectTierByWeight(rng);
    const tierTemplates = filterTemplatesByTier(templates, selectedTier);
    
    // 如果该分级没有模板，降级到简单模板
    const availableTemplates = tierTemplates.length > 0 ? tierTemplates : filterTemplatesByTier(templates, "simple");
    
    // 识别单选项模板（缺乏多样性的模板）
    const singleOptionTemplates = availableTemplates.filter(t => {
      const singleOptionSlots = t.slots.filter(s => s.options.length === 1);
      const singleOptionRatio = singleOptionSlots.length / t.slots.length;
      return singleOptionRatio >= 0.4 || singleOptionSlots.length >= 1;
    });
    
    // 进一步识别极度缺乏多样性的模板
    const veryLowDiversityTemplates = availableTemplates.filter(t => {
      const singleOptionSlots = t.slots.filter(s => s.options.length === 1);
      const singleOptionRatio = singleOptionSlots.length / t.slots.length;
      return singleOptionRatio >= 0.6;
    });
    
    const multiOptionTemplates = availableTemplates.filter(t => !singleOptionTemplates.includes(t));
    
    let templateIndex;
    if (recentWeapons.length > 0) {
      const lastTemplateId = recentWeapons[recentWeapons.length - 1]?.templateId;
      const lastTemplate = templates.find(t => t.id === lastTemplateId);
      const isLastVeryLowDiversity = lastTemplate && veryLowDiversityTemplates.includes(lastTemplate);
      
      // 如果上次是极度缺乏多样性的模板，这次优先选择多选项模板
      if (isLastVeryLowDiversity && multiOptionTemplates.length > 0 && rng() < 0.9) {
        templateIndex = templates.indexOf(multiOptionTemplates[Math.floor(rng() * multiOptionTemplates.length)]);
      } else {
        // 正常随机，优先多选项模板
        if (multiOptionTemplates.length > 0 && rng() < 0.8) {
          templateIndex = templates.indexOf(multiOptionTemplates[Math.floor(rng() * multiOptionTemplates.length)]);
        } else {
          const fallbackTemplates = availableTemplates.filter(t => !veryLowDiversityTemplates.includes(t));
          if (fallbackTemplates.length > 0) {
            templateIndex = templates.indexOf(fallbackTemplates[Math.floor(rng() * fallbackTemplates.length)]);
          } else {
            templateIndex = templates.indexOf(availableTemplates[Math.floor(rng() * availableTemplates.length)]);
          }
        }
        // 避免连续选择相同模板
        const lastTemplateIndex = templates.findIndex(t => t.id === lastTemplateId);
        if (lastTemplateIndex === templateIndex && templates.length > 1) {
          const otherTemplates = availableTemplates.filter((t, i) => templates.indexOf(t) !== lastTemplateIndex && !veryLowDiversityTemplates.includes(t));
          if (otherTemplates.length > 0) {
            const otherIndex = Math.floor(rng() * otherTemplates.length);
            templateIndex = templates.indexOf(otherTemplates[otherIndex]);
          }
        }
      }
    } else {
      // 第一次生成：从选定的分级中选择
      if (multiOptionTemplates.length > 0 && rng() < 0.8) {
        templateIndex = templates.indexOf(multiOptionTemplates[Math.floor(rng() * multiOptionTemplates.length)]);
      } else {
        const fallbackTemplates = availableTemplates.filter(t => !veryLowDiversityTemplates.includes(t));
        if (fallbackTemplates.length > 0) {
          templateIndex = templates.indexOf(fallbackTemplates[Math.floor(rng() * fallbackTemplates.length)]);
        } else {
          templateIndex = templates.indexOf(availableTemplates[Math.floor(rng() * availableTemplates.length)]);
        }
      }
    }
    
    const template = templates[templateIndex];

    // 2. 随机重排顺序（确保真正的随机）
    const order = [...template.slots.map((s) => s.id)];
    shuffleArray(order, rng);

    // 3. 加权随机选择档位（考虑效果组合协同收益）
    const slotOptions = {};
    const selectedEffects = []; // 记录已选择的效果ID，用于检查协同
    
    for (const slot of template.slots) {
      // 使用加权随机，但考虑与已选效果的协同收益
      const option = selectWeightedOptionWithSynergy(slot.options, selectedEffects, rng);
      slotOptions[slot.id] = option.id;
      
      // 提取效果ID并添加到已选效果列表
      const effectIds = extractEffectIds(option);
      selectedEffects.push(...effectIds);
    }

    // 4. 在编译前应用表现参数波动（40%波动范围，提供更大的变化）
    // 创建模板的深拷贝，以便修改选项的表现参数而不影响原始模板
    const variance = 0.4; // 40%波动范围
    const modifiedTemplate = {
      ...template,
      slots: template.slots.map(slot => ({
        ...slot,
        options: slot.options.map(opt => {
          // 深拷贝选项
          const copiedOpt = { ...opt };
          // 如果这个选项被选中，且是 Action 类型，应用表现参数波动
          const isSelected = opt.id === slotOptions[slot.id];
          const isActionType = opt.kind === "SpawnProjectile" || opt.kind === "SpawnMultipleProjectiles" || 
                              opt.kind === "SpawnBurstProjectiles" || opt.kind === "SpawnProjectileWithExplosion" ||
                              opt.kind === "Damage" || opt.kind === "AreaDamage";
          
          if (isSelected && isActionType) {
            // 生成带波动的表现参数
            const randomPresentation = generateRandomPresentationParams(opt, rng, variance);
            
            // 合并到选项的 presentation 中
            copiedOpt.presentation = {
              ...(copiedOpt.presentation || {}),
              ...randomPresentation,
            };
            
            console.log("Applied presentation variance to selected option", opt.id, ":", randomPresentation);
          }
          
          return copiedOpt;
        }),
      })),
    };

    // 5. 应用效果组合协同收益（增加预算上限）
    const allSelectedEffects = [];
    for (const slot of modifiedTemplate.slots) {
      const optionId = slotOptions[slot.id];
      const option = slot.options.find(o => o.id === optionId);
      if (option) {
        const effectIds = extractEffectIds(option);
        allSelectedEffects.push(...effectIds);
      }
    }
    
    // 检查所有协同组合
    const synergies = checkAllSynergies(allSelectedEffects);
    
    // 合并协同收益到模板的预算上限
    if (synergies.length > 0) {
      const synergyBonus = synergies.reduce((acc, s) => {
        for (const [key, value] of Object.entries(s.bonus || {})) {
          acc[key] = (acc[key] || 0) + value;
        }
        return acc;
      }, {});
      
      console.log(`Found ${synergies.length} synergies:`, synergies.map(s => s.description));
      console.log("Synergy bonus:", synergyBonus);
      
      // 临时增加预算上限以容纳协同收益
      modifiedTemplate.budgetCap = {
        ...modifiedTemplate.budgetCap,
        ...Object.fromEntries(
          Object.entries(synergyBonus).map(([key, value]) => [
            key,
            (modifiedTemplate.budgetCap[key] || 0) + value
          ])
        ),
      };
    }

    // 6. 编译 Assembly 并检查预算（使用修改后的模板）
    let assembly;
    try {
      assembly = compileAssembly(modifiedTemplate, order, slotOptions);
    } catch (e) {
      console.warn("Assembly compilation failed, retrying:", e);
      continue; // 预算超限，重新生成
    }

    // 8. 检查是否与最近生成的武器重复（更严格的检查）
    const weaponSignature = `${template.id}-${order.join("-")}-${Object.values(slotOptions).join("-")}`;
    const isDuplicate = recentWeapons.some(w => w.signature === weaponSignature);
    
    // 也检查选项组合的相似度（避免只有顺序不同的重复）
    const optionsSignature = Object.values(slotOptions).sort().join("-");
    const isSimilar = recentWeapons.some(w => {
      const wOptionsSig = Object.values(w.slotOptions || {}).sort().join("-");
      return wOptionsSig === optionsSignature && w.templateId === template.id;
    });
    
    // 对于单选项模板，更严格地避免重复（因为它们的多样性本来就低）
    const isSingleOptionTemplate = singleOptionTemplates.includes(template);
    const maxAvoidAttempts = isSingleOptionTemplate ? maxAttempts - 15 : maxAttempts - 10; // 单选项模板提前5次允许重复
    
    if ((isDuplicate || isSimilar) && attempts < maxAvoidAttempts) {
      // 避免重复和相似，但单选项模板提前允许重复（避免无限循环）
      continue;
    }

    // 9. 生成描述
    let description = "随机技能";
    try {
      description = generateSkillDescription(template, order, slotOptions);
    } catch (e) {
      console.warn("Failed to generate skill description:", e);
    }

    // 10. 记录到最近生成的武器列表
    const weapon = {
      templateId: template.id,
      order,
      slotOptions,
      description,
      isRandom: true,
      assembly,
      signature: weaponSignature,
    };
    
    recentWeapons.push(weapon);
    if (recentWeapons.length > MAX_RECENT_WEAPONS) {
      recentWeapons.shift(); // 移除最旧的
    }

    return weapon;
  }

  // 如果所有尝试都失败，返回一个基本的随机武器（仍然使用加权随机，不使用defaultOption）
  console.warn("Failed to generate unique weapon after", maxAttempts, "attempts, returning basic random weapon");
  const templateIndex = Math.floor(rng() * templates.length);
  const template = templates[templateIndex];
  const order = [...template.slots.map((s) => s.id)];
  shuffleArray(order, rng);
  const slotOptions = {};
  for (const slot of template.slots) {
    // 仍然使用加权随机，不使用defaultOption
    const option = selectWeightedOption(slot.options, rng);
    slotOptions[slot.id] = option.id;
  }
  const assembly = compileAssembly(template, order, slotOptions);
  return {
    templateId: template.id,
    order,
    slotOptions,
    description: generateSkillDescription(template, order, slotOptions),
    isRandom: true,
    assembly,
  };
}

/**
 * 加权随机选择选项（考虑效果组合协同收益）
 * @param {Array} options - 选项数组
 * @param {Array} selectedEffects - 已选择的效果ID数组
 * @param {Function} rng - 随机数生成器
 * @returns {Object} 选中的选项
 */
function selectWeightedOptionWithSynergy(options, selectedEffects, rng) {
  if (!options || options.length === 0) {
    throw new Error("No options available");
  }

  // 如果只有一个选项，直接返回
  if (options.length === 1) {
    return options[0];
  }

  // 计算权重：基础权重 + 协同收益加成
  const weights = options.map((opt) => {
    // 基础权重（使用原有的权重计算逻辑）
    let weight = calculateBaseWeight(opt);
    
    // 检查协同收益：如果这个选项与已选效果有协同，增加权重
    const optEffectIds = extractEffectIds(opt);
    const combinedEffects = [...selectedEffects, ...optEffectIds];
    const synergy = checkSynergy(combinedEffects);
    
    if (synergy) {
      // 有协同收益，增加权重（最多提升50%）
      const synergyBonus = 1.5;
      weight *= synergyBonus;
      console.log(`Synergy detected for option ${opt.id}:`, synergy.description);
    }
    
    return Math.max(0.1, weight);
  });

  // 加权随机选择
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return options[Math.floor(rng() * options.length)];
  }
  
  let random = rng() * totalWeight;
  
  for (let i = 0; i < options.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return options[i];
    }
  }
  
  return options[Math.floor(rng() * options.length)];
}

/**
 * 计算选项的基础权重
 * 根据选项的稀有度（rarity）或类型分配权重
 */
function calculateBaseWeight(opt) {
  let weight = 1.0; // 默认权重
  
  // 根据选项ID判断稀有度
  const optId = opt.id || "";
  
  // 纯伤害选项（降低权重，减少出现频率）
  if (opt.kind === "Damage" && !optId.includes("chain") && !optId.includes("bounce") && 
      !optId.includes("pierce") && !optId.includes("split") && !optId.includes("execute") &&
      !optId.includes("bleed") && !optId.includes("crit") && !optId.includes("reflect")) {
    weight = 0.4;
  }
  // 基础投射物（降低权重）
  else if (optId.includes("proj_fast") || optId.includes("proj_pierce") || 
           optId.includes("proj_slow") || optId.includes("proj_mid")) {
    weight = 0.5;
  }
  // 基础选项（中等权重）
  else if (optId.includes("slow") || optId.includes("fast") || optId.includes("mid")) {
    weight = 0.7;
  } 
  // 中等稀有选项（伤害+效果组合）
  else if (optId.includes("high") || optId.includes("explosive") || optId.includes("chain") ||
           optId.includes("scatter") || optId.includes("burst") || optId.includes("bounce") ||
           optId.includes("pierce") || optId.includes("split")) {
    weight = 0.9;
  } 
  // 高稀有选项（特殊效果）
  else if (optId.includes("percent") || optId.includes("true") || optId.includes("shield") ||
           optId.includes("execute") || optId.includes("crit") || optId.includes("bleed") ||
           optId.includes("reflect") || optId.includes("homing") || optId.includes("ricochet") ||
           optId.includes("spiral") || optId.includes("orbit") || optId.includes("return") ||
           optId.includes("hover") || optId.includes("beam") || optId.includes("chain")) {
    weight = 1.3;
  }
  
  // 根据选项类型调整权重
  if (opt.kind === "SpawnMultipleProjectiles" || opt.kind === "SpawnBurstProjectiles" || 
      opt.kind === "SpawnProjectileWithExplosion") {
    weight *= 1.05;
  } 
  else if (opt.homing || opt.ricochet || opt.spiral || opt.orbit || opt.return || opt.hover) {
    weight *= 1.6;
  }
  else if (opt.kind === "ChainDamage" || opt.kind === "BounceDamage" || opt.kind === "PierceDamage" ||
           opt.kind === "SplitDamage" || opt.kind === "PercentDamage" || opt.kind === "TrueDamage" ||
           opt.kind === "ExecuteDamage" || opt.kind === "BleedDamage" || opt.kind === "CritDamage" ||
           opt.kind === "ReflectDamage") {
    weight *= 0.95;
  } 
  else if (opt.kind === "Heal" || opt.kind === "Buff") {
    weight *= 1.6;
  } 
  else if (opt.kind === "Debuff") {
    const debuffKind = opt.debuff?.kind || "";
    if (debuffKind === "slow" || debuffKind === "root" || debuffKind === "disarm" || 
        debuffKind === "stun" || debuffKind === "knockback") {
      weight *= 1.3;
    }
    else if (debuffKind === "fear" || debuffKind === "charm" || debuffKind === "blind" ||
             debuffKind === "suppress" || debuffKind === "polymorph" || debuffKind === "taunt") {
      weight *= 1.6;
    }
    else if (debuffKind === "sleep" || debuffKind === "ground" || debuffKind === "banished" ||
             debuffKind === "immunity" || debuffKind === "invulnerable" || debuffKind === "cleanse" ||
             debuffKind === "stealth" || debuffKind === "haste") {
      weight *= 1.7;
    }
    else if (debuffKind === "shield") {
      weight *= 1.5;
    }
  }
  else if (opt.kind === "Dash" || opt.kind === "Blink" || opt.kind === "Jump" || opt.kind === "Pull") {
    weight *= 1.6;
  }
  else if (opt.kind === "Charge" || opt.kind === "Stack" || opt.kind === "Summon" ||
           opt.kind === "ChainTrigger" || opt.kind === "Beam") {
    weight *= 1.9;
  }
  
  return Math.max(0.1, weight);
}

/**
 * 加权随机选择选项（保留原有函数用于兼容）
 * 根据选项的稀有度（rarity）或类型分配权重
 * 改进：避免某些选项因为权重过高而频繁出现，增加多样性
 */
function selectWeightedOption(options, rng) {
  if (!options || options.length === 0) {
    throw new Error("No options available");
  }

  // 如果只有一个选项，直接返回
  if (options.length === 1) {
    return options[0];
  }

  // 计算权重：提升非伤害效果的权重占比，但避免权重差异过大
  const weights = options.map((opt, index) => {
    let weight = 1.0; // 默认权重
    
    // 根据选项ID判断稀有度
    const optId = opt.id || "";
    
    // 纯伤害选项（降低权重，减少出现频率）
    if (opt.kind === "Damage" && !optId.includes("chain") && !optId.includes("bounce") && 
        !optId.includes("pierce") && !optId.includes("split") && !optId.includes("execute") &&
        !optId.includes("bleed") && !optId.includes("crit") && !optId.includes("reflect")) {
      weight = 0.4; // 纯伤害选项权重进一步降低
    }
    // 基础投射物（降低权重）
    else if (optId.includes("proj_fast") || optId.includes("proj_pierce") || 
             optId.includes("proj_slow") || optId.includes("proj_mid")) {
      weight = 0.5; // 基础投射物权重进一步降低
    }
    // 基础选项（中等权重）
    else if (optId.includes("slow") || optId.includes("fast") || optId.includes("mid")) {
      weight = 0.7; // 常见选项权重降低
    } 
    // 中等稀有选项（伤害+效果组合）
    else if (optId.includes("high") || optId.includes("explosive") || optId.includes("chain") ||
             optId.includes("scatter") || optId.includes("burst") || optId.includes("bounce") ||
             optId.includes("pierce") || optId.includes("split")) {
      weight = 0.9; // 中等权重
    } 
    // 高稀有选项（特殊效果）
    else if (optId.includes("percent") || optId.includes("true") || optId.includes("shield") ||
             optId.includes("execute") || optId.includes("crit") || optId.includes("bleed") ||
             optId.includes("reflect") || optId.includes("homing") || optId.includes("ricochet") ||
             optId.includes("spiral") || optId.includes("orbit") || optId.includes("return") ||
             optId.includes("hover") || optId.includes("beam") || optId.includes("chain")) {
      weight = 1.3; // 特殊效果权重提升（包括魔法工艺机制）
    }
    
    // 根据选项类型调整权重（降低倍数，避免某些选项权重过高）
    // 投射物类型（中等权重）
    if (opt.kind === "SpawnMultipleProjectiles" || opt.kind === "SpawnBurstProjectiles" || 
        opt.kind === "SpawnProjectileWithExplosion") {
      weight *= 1.05; // 多弹/连发/爆炸（降低倍数）
    } 
    // 特殊投射物效果（提升权重，但降低倍数）
    else if (opt.homing || opt.ricochet || opt.spiral || opt.orbit || opt.return || opt.hover) {
      weight *= 1.6; // 特殊投射物效果权重提升（包括悬停）
    }
    // 伤害类型（中等权重）
    else if (opt.kind === "ChainDamage" || opt.kind === "BounceDamage" || opt.kind === "PierceDamage" ||
             opt.kind === "SplitDamage" || opt.kind === "PercentDamage" || opt.kind === "TrueDamage" ||
             opt.kind === "ExecuteDamage" || opt.kind === "BleedDamage" || opt.kind === "CritDamage" ||
             opt.kind === "ReflectDamage") {
      weight *= 0.95; // 特殊伤害类型稍微降低权重
    } 
    // 增益效果（提升权重，但降低倍数）
    else if (opt.kind === "Heal" || opt.kind === "Buff") {
      weight *= 1.6; // 增益效果权重提升（降低倍数）
    } 
    // 控制效果（Debuff）- 提升权重，但降低倍数
    else if (opt.kind === "Debuff") {
      const debuffKind = opt.debuff?.kind || "";
      // 基础控制效果（提升权重）
      if (debuffKind === "slow" || debuffKind === "root" || debuffKind === "disarm" || 
          debuffKind === "stun" || debuffKind === "knockback") {
        weight *= 1.3; // 基础控制效果权重提升（降低倍数）
      }
      // 高级控制效果（提升权重，但降低倍数）
      else if (debuffKind === "fear" || debuffKind === "charm" || debuffKind === "blind" ||
               debuffKind === "suppress" || debuffKind === "polymorph" || debuffKind === "taunt") {
        weight *= 1.6; // 高级控制效果权重提升（降低倍数）
      }
      // 顶级控制效果（提升权重，但降低倍数）
      else if (debuffKind === "sleep" || debuffKind === "ground" || debuffKind === "banished" ||
               debuffKind === "immunity" || debuffKind === "invulnerable" || debuffKind === "cleanse" ||
               debuffKind === "stealth" || debuffKind === "haste") {
        weight *= 1.7; // 顶级控制效果权重提升（降低倍数）
      }
      // 特殊效果（护盾等）
      else if (debuffKind === "shield") {
        weight *= 1.5; // 护盾权重提升（降低倍数）
      }
    }
    // 移动效果（提升权重，但降低倍数）
    else if (opt.kind === "Dash" || opt.kind === "Blink" || opt.kind === "Jump" || opt.kind === "Pull") {
      weight *= 1.6; // 移动效果权重提升（降低倍数）
    }
    // 特殊机制（提升权重，但降低倍数）
    else if (opt.kind === "Charge" || opt.kind === "Stack" || opt.kind === "Summon" ||
             opt.kind === "ChainTrigger" || opt.kind === "Beam") {
      weight *= 1.9; // 特殊机制权重提升（包括魔法工艺机制）
    }
    
    // 确保权重不为0或负数
    return Math.max(0.1, weight);
  });

  // 加权随机选择
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    // 如果总权重为0，使用均匀随机
    return options[Math.floor(rng() * options.length)];
  }
  
  let random = rng() * totalWeight;
  
  for (let i = 0; i < options.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return options[i];
    }
  }
  
  // 兜底：随机返回一个选项（不使用最后一个，避免固定）
  return options[Math.floor(rng() * options.length)];
}

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
