/**
 * 计算技能组合数量
 * 用于预估基于当前模板和选项可以组成多少种不同的技能
 */

import { templates } from "../configs/templates.js";

/**
 * 计算阶乘
 */
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * 计算每个模板的组合数
 */
function calculateTemplateCombinations(template) {
  const slotCounts = template.slots.map(slot => slot.options.length);
  
  // 基础组合数：每个槽位选项数的乘积
  const baseCombinations = slotCounts.reduce((product, count) => product * count, 1);
  
  // 考虑顺序重排：槽位顺序的排列数
  const orderPermutations = factorial(template.slots.length);
  
  // 考虑表现参数波动：假设每个Action选项有3-5种不同的表现参数组合
  // 这里简化计算，假设平均每个Action选项有4种表现参数变化
  const actionSlots = template.slots.filter(s => s.type === "Action");
  const presentationVariations = actionSlots.reduce((total, slot) => {
    // 每个Action选项平均4种表现参数变化
    return total * Math.pow(4, slot.options.length);
  }, 1);
  
  return {
    templateId: template.id,
    slotCount: template.slots.length,
    slotOptionCounts: slotCounts,
    baseCombinations,
    withOrder: baseCombinations * orderPermutations,
    withPresentation: baseCombinations * orderPermutations * presentationVariations,
  };
}

/**
 * 计算所有模板的总组合数
 */
export function calculateAllCombinations() {
  const results = templates.map(t => calculateTemplateCombinations(t));
  
  let totalBase = 0;
  let totalWithOrder = 0;
  let totalWithPresentation = 0;
  
  console.log("=== 技能组合数量预估 ===\n");
  
  for (const result of results) {
    console.log(`模板: ${result.templateId}`);
    console.log(`  槽位数量: ${result.slotCount}`);
    console.log(`  每个槽位选项数: [${result.slotOptionCounts.join(", ")}]`);
    console.log(`  基础组合数（不考虑顺序）: ${result.baseCombinations.toLocaleString()}`);
    console.log(`  考虑顺序重排: ${result.withOrder.toLocaleString()}`);
    console.log(`  考虑表现参数波动: ${result.withPresentation.toLocaleString()}`);
    console.log("");
    
    totalBase += result.baseCombinations;
    totalWithOrder += result.withOrder;
    totalWithPresentation += result.withPresentation;
  }
  
  console.log("=== 总计 ===");
  console.log(`所有模板基础组合数: ${totalBase.toLocaleString()}`);
  console.log(`考虑顺序重排: ${totalWithOrder.toLocaleString()}`);
  console.log(`考虑表现参数波动: ${totalWithPresentation.toLocaleString()}`);
  console.log(`\n预估有效组合数（考虑预算限制）: ${Math.floor(totalWithOrder * 0.3).toLocaleString()} - ${Math.floor(totalWithOrder * 0.7).toLocaleString()}`);
  
  return {
    templates: results,
    totals: {
      base: totalBase,
      withOrder: totalWithOrder,
      withPresentation: totalWithPresentation,
    },
  };
}

// 如果直接运行此文件，执行计算
if (import.meta.url === `file://${process.argv[1]}`) {
  calculateAllCombinations();
}
