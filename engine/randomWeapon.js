/**
 * 随机武器生成器
 * 每次体验时生成随机的技能 Assembly
 * 使用动态 ECA 规则系统替代固定模板
 */

import { compileAssembly } from "./runtime.js";
import { createRng } from "./rng.js";
import { generateSkillDescription } from "./skillDescription.js";
import { generateRandomPresentationParams } from "./presentationParams.js";
import { checkSynergy, checkAllSynergies, extractEffectIds } from "./synergy.js";
import { checkCouplingRequirement, extractEffectIdsForCoupling, getRecommendedCouplingEffects } from "./coupling.js";
import { 
  EVENT_RULES, 
  CONDITION_RULES, 
  TARGET_RULES, 
  ACTION_RULES, 
  TIMELINE_RULES, 
  STRUCTURE_RULES,
  COMPLEXITY_CONFIG,
  hasDamageTag
} from "../configs/ecaRules.js";
import {
  CORE_SKILLS,
  SUPPORT_MODIFIERS,
  isCompatible,
  applySupportModifier
} from "../configs/skillArchetypes.js";

// 记录最近生成的武器（用于避免重复）
let recentWeapons = [];
const MAX_RECENT_WEAPONS = 50; // 增加到50个，提高重复检测能力

/**
 * 动态生成技能模板结构（主效果+副效果架构）
 * @param {Function} rng - 随机数生成器
 * @param {Object} complexityConfig - 复杂度配置（可选，默认使用 COMPLEXITY_CONFIG）
 * @returns {Object} 动态生成的模板对象
 */
function generateDynamicTemplate(rng, complexityConfig = null) {
  const complexity = complexityConfig || COMPLEXITY_CONFIG;
  
  // 1. 选择事件
  const eventRule = selectWeighted(EVENT_RULES, rng, (rule) => rule.weight || 1.0);
  
  // 2. 选择主效果（Core Skill）
  const coreSkill = selectWeighted(CORE_SKILLS, rng, (skill) => skill.weight || 1.0);
  console.log(`Selected core skill: ${coreSkill.label} (${coreSkill.category})`);
  
  // 3. 选择副效果（Support Modifiers）- 根据复杂度调整数量
  // 基础最大副效果数：根据overall复杂度确定
  let baseMaxSupports = 1;
  if (complexity.overall > 0.7) {
    baseMaxSupports = 3;
  } else if (complexity.overall > 0.4) {
    baseMaxSupports = 2;
  }
  
  // 应用副效果数量系数
  const supportConfig = complexity.supportModifierCount || { min: 0.3, max: 0.9 };
  const adjustedMaxSupports = Math.max(1, Math.floor(baseMaxSupports * supportConfig.max));
  
  // 计算实际副效果数量：至少有一定概率有副效果
  let supportCount = 0;
  const minSupportChance = supportConfig.min || 0.3;
  if (rng() < minSupportChance) {
    // 至少1个副效果
    supportCount = 1 + Math.floor(rng() * adjustedMaxSupports);
  } else {
    // 可能0个，也可能更多
    supportCount = Math.floor(rng() * (adjustedMaxSupports + 1));
  }
  
  supportCount = Math.min(supportCount, adjustedMaxSupports); // 确保不超过最大值
  
  const selectedSupports = [];
  const availableSupports = SUPPORT_MODIFIERS.filter(support => 
    isCompatible(support, coreSkill)
  );
  
  // 加权随机选择副效果
  const highRiskConfig = complexity.highRiskHighRewardWeight || { enabled: true, weightMultiplier: 0.6 };
  
  for (let i = 0; i < supportCount && availableSupports.length > 0; i++) {
    // 计算权重：高风险高回报副效果根据配置调整权重
    const weights = availableSupports.map(s => {
      let weight = s.weight || 1.0;
      
      // 如果是高风险高回报类别，应用权重倍数
      if (highRiskConfig.enabled && s.category === "high_risk") {
        weight *= (highRiskConfig.weightMultiplier || 0.6);
      }
      
      return weight;
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) break; // 如果所有权重为0，停止选择
    
    let random = rng() * totalWeight;
    
    let selectedIndex = 0;
    for (let j = 0; j < availableSupports.length; j++) {
      random -= weights[j];
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }
    
    const selectedSupport = availableSupports[selectedIndex];
    selectedSupports.push(selectedSupport);
    availableSupports.splice(selectedIndex, 1); // 移除已选择的，避免重复
    console.log(`Selected support modifier: ${selectedSupport.label} (category: ${selectedSupport.category})`);
  }
  
  // 4. 应用副效果到主效果
  let modifiedAction = coreSkill.baseAction;
  const appliedNegativeEffects = [];
  
  for (const support of selectedSupports) {
    modifiedAction = applySupportModifier(modifiedAction, support);
    
    // 收集负面效果
    if (support.negativeEffects && support.negativeEffects.length > 0) {
      appliedNegativeEffects.push(...support.negativeEffects);
    }
  }
  
  // 5. 根据复杂度确定槽位数量（简化：主效果+副效果已经确定了动作）
  const { minSlots, maxSlots } = STRUCTURE_RULES.getSlotRange(complexity);
  const slotCount = Math.max(minSlots, Math.min(maxSlots, 3 + supportCount)); // 至少3个槽位（事件+主效果+目标/条件）
  
  // 6. 确定各类型槽位数量（根据复杂度配置）
  const actionCount = 1; // 主效果动作（副效果已经应用到主效果中）
  
  // 根据复杂度配置计算条件数量
  const [conditionMin, conditionMax] = STRUCTURE_RULES.getConditionRange(complexity);
  const conditionCount = Math.floor(rng() * (conditionMax - conditionMin + 1)) + conditionMin;
  
  // 根据复杂度配置计算目标数量
  const [targetMin, targetMax] = STRUCTURE_RULES.getTargetRange(complexity);
  let targetCount = coreSkill.category === "projectile" || coreSkill.category === "beam" ? 1 : 0; // 投射类需要目标
  if (targetMax > 0 && rng() < 0.5) {
    // 50%概率添加额外目标选择
    targetCount = Math.min(targetMax, targetCount + Math.floor(rng() * (targetMax - targetMin + 1)) + targetMin);
  }
  
  // 根据复杂度配置计算时间线数量
  const [timelineMin, timelineMax] = STRUCTURE_RULES.getTimelineRange(complexity);
  const timelineCount = Math.floor(rng() * (timelineMax - timelineMin + 1)) + timelineMin;
  
  // 4. 应用约束规则
  const slots = [];
  let slotIdCounter = 1;
  
  // 添加事件（事件不占用槽位，但影响预算和守卫）
  
  // 添加条件槽位
  for (let i = 0; i < conditionCount; i++) {
    slots.push({
      id: `c${slotIdCounter++}`,
      type: "Condition",
      options: CONDITION_RULES.map(rule => ({
        id: rule.id,
        kind: rule.kind,
        ...rule,
      })),
      defaultOption: CONDITION_RULES[0].id,
    });
  }
  
  // 添加目标槽位
  for (let i = 0; i < targetCount; i++) {
    slots.push({
      id: `t${slotIdCounter++}`,
      type: "Target",
      options: TARGET_RULES.map(rule => ({
        id: rule.id,
        kind: rule.kind,
        ...rule,
      })),
      defaultOption: TARGET_RULES[0].id,
    });
  }
  
  // 添加主效果动作槽位（使用修改后的主效果）
  const mainActionId = `core_${coreSkill.id}_${Date.now()}`;
  slots.push({
    id: `a${slotIdCounter++}`,
    type: "Action",
    options: [{
      id: mainActionId,
      label: coreSkill.label,
      ...modifiedAction,
      _coreSkill: coreSkill.id,
      _supportModifiers: selectedSupports.map(s => s.id),
    }],
    defaultOption: mainActionId,
  });
  
  // 如果有负面效果，添加为Debuff动作（负面效果会在运行时应用到玩家身上）
  if (appliedNegativeEffects.length > 0) {
    for (const negativeEffect of appliedNegativeEffects) {
      slots.push({
        id: `a${slotIdCounter++}`,
        type: "Action",
        options: [{
          id: `negative_${negativeEffect.kind}_${Date.now()}`,
          label: `负面：${getDebuffLabel(negativeEffect.kind)}`,
          kind: "SelfDebuff",
          debuff: negativeEffect,
          budget: {},
          _isNegativeEffect: true,
        }],
        defaultOption: `negative_${negativeEffect.kind}_${Date.now()}`,
      });
    }
  }
  
  // 如果有副效果添加了额外的Debuff，也添加
  for (const support of selectedSupports) {
    if (support.effects.additionalDebuff) {
      slots.push({
        id: `a${slotIdCounter++}`,
        type: "Action",
        options: [{
          id: `support_debuff_${support.id}_${Date.now()}`,
          label: support.label,
          kind: "Debuff",
          debuff: support.effects.additionalDebuff,
          budget: support.budget || {},
        }],
        defaultOption: `support_debuff_${support.id}_${Date.now()}`,
      });
    }
  }
  
  // 添加时间线槽位
  for (let i = 0; i < timelineCount; i++) {
    slots.push({
      id: `tl${slotIdCounter++}`,
      type: "Timeline",
      options: TIMELINE_RULES.map(rule => ({
        id: rule.id,
        delayMs: rule.delayMs,
        ...rule,
      })),
      defaultOption: TIMELINE_RULES[0].id,
    });
  }
  
  // 5. 应用约束规则（后处理）
  const selectedActionKinds = new Set();
  const hasOnDamaged = eventRule.id === "OnDamaged";
  
  // 检查是否需要添加触发概率条件
  if (hasOnDamaged) {
    const hasProcChance = slots.some(s => 
      s.type === "Condition" && s.options.some(o => o.kind === "ProcChance")
    );
    if (!hasProcChance) {
      // 添加一个触发概率条件
      slots.unshift({
        id: `c${slotIdCounter++}`,
        type: "Condition",
        options: CONDITION_RULES.filter(r => r.kind === "ProcChance").map(rule => ({
          id: rule.id,
          kind: rule.kind,
          ...rule,
        })),
        defaultOption: CONDITION_RULES.find(r => r.kind === "ProcChance")?.id || CONDITION_RULES[0].id,
      });
    }
  }
  
  // 检查是否需要添加目标选择（如果有投射物动作）
  const hasProjectileAction = slots.some(s => 
    s.type === "Action" && s.options.some(o => 
      ["SpawnProjectile", "SpawnMultipleProjectiles", "SpawnBurstProjectiles", "SpawnProjectileWithExplosion"].includes(o.kind)
    )
  );
  const currentTargetCount = slots.filter(s => s.type === "Target").length;
  if (hasProjectileAction && currentTargetCount === 0 && rng() < 0.7) {
    slots.splice(1, 0, {
      id: `t${slotIdCounter++}`,
      type: "Target",
      options: TARGET_RULES.map(rule => ({
        id: rule.id,
        kind: rule.kind,
        ...rule,
      })),
      defaultOption: TARGET_RULES[0].id,
    });
  }
  
  // 6. 确保至少有一个伤害动作（伤害tag规则）
  const hasDamageAction = slots.some(s => 
    s.type === "Action" && s.options.some(o => hasDamageTag(o))
  );
  
  if (!hasDamageAction) {
    // 找到所有有伤害的动作
    const damageActions = ACTION_RULES.filter(rule => hasDamageTag(rule));
    
    if (damageActions.length > 0) {
      // 随机选择一个伤害动作，添加到第一个动作槽位
      const selectedDamageAction = damageActions[Math.floor(rng() * damageActions.length)];
      
      // 找到第一个动作槽位，如果没有则创建一个
      const firstActionSlot = slots.find(s => s.type === "Action");
      
      if (firstActionSlot) {
        // 将伤害动作添加到选项列表的开头，并设置为默认选项
        firstActionSlot.options.unshift({
          id: selectedDamageAction.id,
          kind: selectedDamageAction.kind,
          ...selectedDamageAction,
        });
        firstActionSlot.defaultOption = selectedDamageAction.id;
      } else {
        // 如果没有动作槽位，创建一个
        slots.push({
          id: `a${slotIdCounter++}`,
          type: "Action",
          options: [{
            id: selectedDamageAction.id,
            kind: selectedDamageAction.kind,
            ...selectedDamageAction,
          }],
          defaultOption: selectedDamageAction.id,
        });
      }
      
      console.log(`Added damage action ${selectedDamageAction.id} to ensure skill has at least one damage tag`);
    }
  }
  
  // 7. 生成模板对象
  const templateId = `dynamic_${Date.now()}_${Math.floor(rng() * 10000)}`;
  return {
    id: templateId,
    slots,
    budgetCap: eventRule.budgetCap || { damage: 140, cc: 60, mobility: 0, proc: 40, perf: 50 },
    guards: eventRule.guards || {},
    event: eventRule.id,
    _coreSkill: coreSkill.id,
    _supportModifiers: selectedSupports.map(s => s.id),
    _negativeEffects: appliedNegativeEffects,
  };
}

/**
 * 获取debuff的中文标签
 */
function getDebuffLabel(kind) {
  const labelMap = {
    selfSlow: "自身减速",
    selfVuln: "自身易伤",
    selfRoot: "自身定身",
  };
  return labelMap[kind] || kind;
}

/**
 * 加权随机选择
 * @param {Array} items - 选项数组
 * @param {Function} rng - 随机数生成器
 * @param {Function} weightFn - 权重函数
 * @returns {Object} 选中的项
 */
function selectWeighted(items, rng, weightFn) {
  if (!items || items.length === 0) {
    throw new Error("No items available");
  }
  if (items.length === 1) {
    return items[0];
  }
  
  const weights = items.map(item => weightFn(item));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return items[Math.floor(rng() * items.length)];
  }
  
  let random = rng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

/**
 * 计算模板的基础组合数（用于多样性评分）
 * @param {Object} template - 模板对象
 * @returns {number} 基础组合数
 */
function calculateTemplateCombinations(template) {
  const slotCounts = template.slots.map(slot => slot.options.length);
  return slotCounts.reduce((product, count) => product * count, 1);
}

/**
 * 根据组合数计算多样性权重（组合数越多，权重越高）
 * @param {number} combinations - 基础组合数
 * @returns {number} 多样性权重（0-1）
 */
function getDiversityWeight(combinations) {
  if (combinations >= 100000) return 1.0;      // 极高多样性，正常权重
  if (combinations >= 10000) return 0.9;       // 高多样性，略降权重
  if (combinations >= 1000) return 0.7;        // 中等多样性，降低权重
  if (combinations >= 100) return 0.4;         // 低多样性，大幅降低权重
  if (combinations >= 10) return 0.2;          // 极低多样性，极低权重
  return 0.1;                                  // 几乎固定，极低权重
}

/**
 * 生成随机武器（动态生成版本）
 * @param {Array} templates - 已废弃，保留以兼容旧代码
 * @param {number|Object} seed - 随机种子（数字或 RNG 对象）
 * @returns {Object} 随机生成的 Assembly 对象，包含 templateId, order, slotOptions, description, isRandom
 */
export function generateRandomWeapon(templates, seed) {
  // 使用更好的随机种子：时间戳 + 随机数 + 计数器
  const baseSeed = typeof seed === "number" ? seed : Date.now();
  const enhancedSeed = baseSeed + Math.floor(Math.random() * 1000000) + recentWeapons.length;
  const rng = typeof seed === "object" ? seed : createRng(enhancedSeed);

  let attempts = 0;
  const maxAttempts = 100; // 增加尝试次数
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // 1. 动态生成模板结构
    const template = generateDynamicTemplate(rng);

    // 2. 随机重排顺序（确保真正的随机）
    const order = [...template.slots.map((s) => s.id)];
    shuffleArray(order, rng);

    // 3. 选项选择：大幅提高随机性，减少权重影响
    const slotOptions = {};
    
    // 70%概率完全随机选择，30%概率使用轻微加权（避免最差的选项）
    const usePureRandom = rng() < 0.7;
    
    // 记录已选择的效果，用于耦合关系检查
    const selectedEffects = [];
    
    // 第一遍：选择所有选项
    for (const slot of template.slots) {
      let option;
      if (usePureRandom && slot.options.length > 1) {
        // 完全随机选择（最大化多样性）
        option = slot.options[Math.floor(rng() * slot.options.length)];
      } else {
        // 轻微加权：只降低最基础的选项权重
        const weights = slot.options.map(opt => {
          const optId = opt.id || "";
          // 基础选项稍微降低权重
          if (optId.includes("proj_fast") || optId.includes("dmg_mid") || 
              optId.includes("slow_light") || optId === "mana30" || optId === "range12") {
            return 0.7;
          }
          return 1.0;
        });
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = rng() * totalWeight;
        for (let i = 0; i < slot.options.length; i++) {
          random -= weights[i];
          if (random <= 0) {
            option = slot.options[i];
            break;
          }
        }
        if (!option) {
          option = slot.options[Math.floor(rng() * slot.options.length)];
        }
      }
      
      slotOptions[slot.id] = option.id;
      
      // 提取当前选项的效果ID
      const currentEffectIds = extractEffectIdsForCoupling(option);
      selectedEffects.push(...currentEffectIds);
    }
    
    // 第二遍：检查耦合关系，尝试调整选项以满足依赖
    // 重新构建selectedEffects数组（确保完整）
    const allSelectedEffects = [];
    for (const slot of template.slots) {
      const optionId = slotOptions[slot.id];
      const option = slot.options.find(opt => opt.id === optionId);
      if (option) {
        const effectIds = extractEffectIdsForCoupling(option);
        allSelectedEffects.push(...effectIds);
      }
    }
    
    // 检查是否至少有一个伤害动作（伤害tag规则）
    const hasDamageInSelected = template.slots.some(slot => {
      if (slot.type !== "Action") return false;
      const optionId = slotOptions[slot.id];
      const option = slot.options.find(opt => opt.id === optionId);
      return option && hasDamageTag(option);
    });
    
    if (!hasDamageInSelected) {
      // 找到所有动作槽位中有伤害的选项
      const actionSlots = template.slots.filter(s => s.type === "Action");
      const damageOptions = [];
      
      for (const actionSlot of actionSlots) {
        const damageOpts = actionSlot.options.filter(opt => hasDamageTag(opt));
        if (damageOpts.length > 0) {
          damageOptions.push({ slot: actionSlot, options: damageOpts });
        }
      }
      
      if (damageOptions.length > 0) {
        // 随机选择一个动作槽位，将其选项替换为伤害选项
        const selected = damageOptions[Math.floor(rng() * damageOptions.length)];
        const selectedOption = selected.options[Math.floor(rng() * selected.options.length)];
        slotOptions[selected.slot.id] = selectedOption.id;
        console.log(`Replaced action ${selected.slot.id} with damage action ${selectedOption.id} to ensure skill has damage tag`);
      } else {
        // 如果动作槽位中没有伤害选项，添加一个伤害动作到第一个动作槽位
        const damageActions = ACTION_RULES.filter(rule => hasDamageTag(rule));
        if (damageActions.length > 0 && actionSlots.length > 0) {
          const selectedDamageAction = damageActions[Math.floor(rng() * damageActions.length)];
          const firstActionSlot = actionSlots[0];
          
          // 检查第一个动作槽位是否已经有这个选项，如果没有则添加
          const hasOption = firstActionSlot.options.some(opt => opt.id === selectedDamageAction.id);
          if (!hasOption) {
            firstActionSlot.options.push({
              id: selectedDamageAction.id,
              kind: selectedDamageAction.kind,
              ...selectedDamageAction,
            });
          }
          slotOptions[firstActionSlot.id] = selectedDamageAction.id;
          console.log(`Set first action slot ${firstActionSlot.id} to damage action ${selectedDamageAction.id}`);
        }
      }
    }
    
    const couplingAdjustments = [];
    for (let i = 0; i < template.slots.length; i++) {
      const slot = template.slots[i];
      const currentOptionId = slotOptions[slot.id];
      const currentOption = slot.options.find(opt => opt.id === currentOptionId);
      if (!currentOption) continue;
      
      const currentEffectIds = extractEffectIdsForCoupling(currentOption);
      
      // 检查当前选项是否需要依赖效果
      for (const effectId of currentEffectIds) {
        const couplingRelation = checkCouplingRequirement(allSelectedEffects, effectId);
        if (couplingRelation && rng() < couplingRelation.weight) {
          // 根据权重决定是否补充依赖效果
          const recommendedEffects = getRecommendedCouplingEffects(allSelectedEffects, effectId);
          
          // 尝试在后续的Action槽位中寻找匹配的依赖效果
          for (let j = i + 1; j < template.slots.length; j++) {
            const nextSlot = template.slots[j];
            if (nextSlot.type !== "Action") continue; // 只在Action槽位中寻找
            
            const nextOptionId = slotOptions[nextSlot.id];
            const nextOption = nextSlot.options.find(opt => opt.id === nextOptionId);
            if (!nextOption) continue;
            
            const nextEffectIds = extractEffectIdsForCoupling(nextOption);
            
            // 检查是否已经包含依赖效果
            const hasRequired = recommendedEffects.some(rec => 
              nextEffectIds.some(eid => 
                eid.toLowerCase() === rec.effectId.toLowerCase() ||
                eid.toLowerCase().includes(rec.effectId.toLowerCase()) ||
                rec.effectId.toLowerCase().includes(eid.toLowerCase())
              )
            );
            
            if (hasRequired) {
              // 已经满足依赖，跳过
              break;
            }
            
            // 查找包含依赖效果的选项
            const matchingOptions = nextSlot.options.filter(opt => {
              const optEffectIds = extractEffectIdsForCoupling(opt);
              return recommendedEffects.some(rec => 
                optEffectIds.some(eid => 
                  eid.toLowerCase() === rec.effectId.toLowerCase() ||
                  eid.toLowerCase().includes(rec.effectId.toLowerCase()) ||
                  rec.effectId.toLowerCase().includes(eid.toLowerCase())
                )
              );
            });
            
            if (matchingOptions.length > 0) {
              // 如果找到匹配的选项，替换当前选项以满足耦合关系
              const selectedCouplingOption = matchingOptions[Math.floor(rng() * matchingOptions.length)];
              
              // 移除旧效果，添加新效果
              const oldEffectIds = extractEffectIdsForCoupling(nextOption);
              oldEffectIds.forEach(eid => {
                const index = allSelectedEffects.indexOf(eid);
                if (index > -1) allSelectedEffects.splice(index, 1);
              });
              
              slotOptions[nextSlot.id] = selectedCouplingOption.id;
              
              const newEffectIds = extractEffectIdsForCoupling(selectedCouplingOption);
              allSelectedEffects.push(...newEffectIds);
              
              couplingAdjustments.push({
                from: effectId,
                to: recommendedEffects.map(r => r.effectId).join(", "),
                slot: nextSlot.id,
                option: selectedCouplingOption.id,
              });
              
              console.log(`Applied coupling: ${effectId} requires ${recommendedEffects.map(r => r.effectId).join(", ")}, adjusted ${nextSlot.id} to ${selectedCouplingOption.id}`);
              break; // 找到一个依赖效果即可
            }
          }
        }
      }
    }
    
    if (couplingAdjustments.length > 0) {
      console.log(`Applied ${couplingAdjustments.length} coupling adjustments`);
    }
    
    // 检查选项组合是否重复（动态生成系统，检查最近生成的武器）
    const currentComboKey = Object.values(slotOptions).sort().join("|");
    const recentOptionCombos = new Set();
    for (const weapon of recentWeapons.slice(-MAX_RECENT_WEAPONS)) {
      if (weapon.slotOptions) {
        const comboKey = Object.values(weapon.slotOptions).sort().join("|");
        recentOptionCombos.add(comboKey);
      }
    }
    
    if (recentOptionCombos.has(currentComboKey) && attempts < maxAttempts - 30) {
      // 如果选项组合重复，重新生成
      console.log(`Skipping duplicate option combination: ${currentComboKey}`);
      continue;
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

    // 5. 应用效果组合协同收益（增加预算上限）- 简化版本
    // 重新提取效果ID用于协同收益检查（使用extractEffectIds而不是extractEffectIdsForCoupling）
    const allSelectedEffectsForSynergy = [];
    for (const slot of modifiedTemplate.slots) {
      const optionId = slotOptions[slot.id];
      const option = slot.options.find(o => o.id === optionId);
      if (option) {
        const effectIds = extractEffectIds(option);
        allSelectedEffectsForSynergy.push(...effectIds);
      }
    }
    
    // 检查所有协同组合（但不再强制应用，只是记录）
    const synergies = checkAllSynergies(allSelectedEffectsForSynergy);
    if (synergies.length > 0) {
      const synergyBonus = synergies.reduce((acc, s) => {
        for (const [key, value] of Object.entries(s.bonus || {})) {
          acc[key] = (acc[key] || 0) + value;
        }
        return acc;
      }, {});
      
      // 只在预算确实超限时才增加预算上限
      try {
        // 先尝试编译，如果失败再增加预算
        const testAssembly = compileAssembly(modifiedTemplate, order, slotOptions);
      } catch (e) {
        // 预算超限，应用协同收益
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
    }

    // 6. 编译 Assembly 并检查预算（使用修改后的模板）
    let assembly;
    try {
      assembly = compileAssembly(modifiedTemplate, order, slotOptions);
    } catch (e) {
      console.warn("Assembly compilation failed, retrying:", e);
      continue; // 预算超限，重新生成
    }

    // 6. 检查是否与最近生成的武器重复（基于选项组合）
    // 生成选项组合的哈希值（不考虑顺序）
    const optionsSignature = Object.values(slotOptions).sort().join("|");
    
    const isDuplicate = recentWeapons.slice(-MAX_RECENT_WEAPONS).some(w => {
      const wOptionsSig = Object.values(w.slotOptions || {}).sort().join("|");
      return wOptionsSig === optionsSignature;
    });
    
    // 如果选项组合重复，且尝试次数还充足，重新生成
    if (isDuplicate && attempts < maxAttempts - 30) {
      console.log(`Skipping duplicate option combination: ${optionsSignature}`);
      continue;
    }

    // 7. 生成描述
    let description = "随机技能";
    try {
      description = generateSkillDescription(template, order, slotOptions);
    } catch (e) {
      console.warn("Failed to generate skill description:", e);
    }

    // 8. 记录到最近生成的武器列表
    const weaponSignature = `${template.id}-${order.join("-")}-${Object.values(slotOptions).join("-")}`;
    const weapon = {
      templateId: template.id,
      template, // 包含完整的模板对象
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

  // 如果所有尝试都失败，返回一个基本的随机武器
  console.warn("Failed to generate unique weapon after", maxAttempts, "attempts, returning basic random weapon");
  const template = generateDynamicTemplate(rng);
  const order = [...template.slots.map((s) => s.id)];
  shuffleArray(order, rng);
  const slotOptions = {};
  for (const slot of template.slots) {
    const option = slot.options[Math.floor(rng() * slot.options.length)];
    slotOptions[slot.id] = option.id;
  }
  const assembly = compileAssembly(template, order, slotOptions);
  return {
    templateId: template.id,
    template, // 包含完整的模板对象
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
      // 有协同收益，适度增加权重（提升20%，避免过度偏向）
      const synergyBonus = 1.2;
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
