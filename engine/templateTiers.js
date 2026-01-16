/**
 * 模板分级系统
 * 根据槽位数量和价值对模板进行分级
 */

/**
 * 模板分级定义
 */
export const TEMPLATE_TIERS = {
  // 简单模板：4-5个槽位，低价值
  simple: {
    minSlots: 4,
    maxSlots: 5,
    maxTotalBudget: 200, // 总预算上限（放宽以匹配现有模板）
    weight: 0.7, // 70%概率
    description: "简单技能",
  },
  
  // 普通模板：6个槽位，中等价值
  normal: {
    minSlots: 6,
    maxSlots: 6,
    maxTotalBudget: 300,
    weight: 0.25, // 25%概率
    description: "普通技能",
  },
  
  // 复杂模板：7+个槽位，高价值
  complex: {
    minSlots: 7,
    maxSlots: 999,
    maxTotalBudget: 999,
    weight: 0.05, // 5%概率
    description: "复杂技能",
  },
};

/**
 * 计算模板的总预算值
 * @param {Object} template - 模板对象
 * @returns {number} 总预算值
 */
export function calculateTemplateBudget(template) {
  const budgetCap = template.budgetCap || {};
  const totalBudget = (budgetCap.damage || 0) + 
                     (budgetCap.cc || 0) + 
                     (budgetCap.mobility || 0) + 
                     (budgetCap.proc || 0) + 
                     (budgetCap.perf || 0);
  return totalBudget;
}

/**
 * 获取模板的分级
 * @param {Object} template - 模板对象
 * @returns {string} 分级名称（simple/normal/complex）
 */
export function getTemplateTier(template) {
  const slotCount = template.slots?.length || 0;
  const totalBudget = calculateTemplateBudget(template);
  
  // 复杂模板：8+槽位 或 高预算
  if (slotCount >= TEMPLATE_TIERS.complex.minSlots) {
    return "complex";
  } 
  // 普通模板：6-7槽位
  else if (slotCount >= TEMPLATE_TIERS.normal.minSlots && slotCount <= TEMPLATE_TIERS.normal.maxSlots) {
    return "normal";
  } 
  // 简单模板：4-5槽位
  else {
    return "simple";
  }
}

/**
 * 根据分级筛选模板
 * @param {Array} templates - 所有模板
 * @param {string} tier - 分级名称
 * @returns {Array} 筛选后的模板数组
 */
export function filterTemplatesByTier(templates, tier) {
  return templates.filter(t => getTemplateTier(t) === tier);
}

/**
 * 根据权重随机选择分级
 * @param {Function} rng - 随机数生成器
 * @returns {string} 分级名称
 */
export function selectTierByWeight(rng) {
  const random = rng();
  if (random < TEMPLATE_TIERS.simple.weight) {
    return "simple";
  } else if (random < TEMPLATE_TIERS.simple.weight + TEMPLATE_TIERS.normal.weight) {
    return "normal";
  } else {
    return "complex";
  }
}
