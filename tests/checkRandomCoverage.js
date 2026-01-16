/**
 * 检查随机生成的覆盖范围
 * 统计主效果和副效果的分布情况
 */

import { CORE_SKILLS, SUPPORT_MODIFIERS, isCompatible } from "../configs/skillArchetypes.js";
import { createRng } from "../engine/rng.js";

// 统计主效果
console.log("=== 主效果统计 ===");
console.log(`总数: ${CORE_SKILLS.length}`);
console.log("\n主效果列表:");
CORE_SKILLS.forEach((skill, index) => {
  console.log(`${index + 1}. ${skill.label} (${skill.category}) - 权重: ${skill.weight}`);
});

// 统计副效果
console.log("\n=== 副效果统计 ===");
console.log(`总数: ${SUPPORT_MODIFIERS.length}`);

// 按类别分组统计
const supportByCategory = {};
SUPPORT_MODIFIERS.forEach(support => {
  const category = support.category || "unknown";
  if (!supportByCategory[category]) {
    supportByCategory[category] = [];
  }
  supportByCategory[category].push(support);
});

console.log("\n副效果按类别分组:");
Object.keys(supportByCategory).forEach(category => {
  console.log(`\n${category} (${supportByCategory[category].length}个):`);
  supportByCategory[category].forEach(support => {
    const compatInfo = support.compatibleCategories 
      ? ` [兼容: ${support.compatibleCategories.join(", ")}]`
      : " [通用]";
    console.log(`  - ${support.label} - 权重: ${support.weight}${compatInfo}`);
  });
});

// 检查兼容性覆盖
console.log("\n=== 兼容性覆盖检查 ===");
const coreCategories = [...new Set(CORE_SKILLS.map(s => s.category))];
console.log(`主效果类别: ${coreCategories.join(", ")}`);

coreCategories.forEach(category => {
  const compatibleSupports = SUPPORT_MODIFIERS.filter(support => 
    isCompatible(support, { category })
  );
  console.log(`\n${category} 类别可用的副效果: ${compatibleSupports.length}个`);
  if (compatibleSupports.length === 0) {
    console.log(`  ⚠️ 警告: ${category} 类别没有可用的副效果！`);
  }
});

// 模拟随机生成1000次，统计分布
console.log("\n=== 随机生成模拟 (1000次) ===");
const coreStats = {};
const supportStats = {};

function selectWeighted(items, rng, weightFn) {
  const weights = items.map(item => weightFn(item));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = rng() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

for (let i = 0; i < 1000; i++) {
  const rng = createRng(Date.now() + i);
  
  // 选择主效果
  const coreSkill = selectWeighted(CORE_SKILLS, rng, (skill) => skill.weight || 1.0);
  coreStats[coreSkill.id] = (coreStats[coreSkill.id] || 0) + 1;
  
  // 选择副效果（模拟选择1-3个）
  const supportCount = Math.floor(rng() * 3) + 1;
  const availableSupports = SUPPORT_MODIFIERS.filter(support => 
    isCompatible(support, coreSkill)
  );
  
  for (let j = 0; j < supportCount && availableSupports.length > 0; j++) {
    const support = selectWeighted(availableSupports, rng, (s) => s.weight || 1.0);
    supportStats[support.id] = (supportStats[support.id] || 0) + 1;
    // 移除已选择的（模拟不重复）
    const index = availableSupports.indexOf(support);
    if (index >= 0) {
      availableSupports.splice(index, 1);
    }
  }
}

console.log("\n主效果出现次数:");
Object.entries(coreStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, count]) => {
    const skill = CORE_SKILLS.find(s => s.id === id);
    const percentage = ((count / 1000) * 100).toFixed(1);
    console.log(`  ${skill?.label || id}: ${count}次 (${percentage}%)`);
  });

console.log("\n副效果出现次数:");
Object.entries(supportStats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, count]) => {
    const support = SUPPORT_MODIFIERS.find(s => s.id === id);
    const percentage = ((count / 1000) * 100).toFixed(1);
    console.log(`  ${support?.label || id}: ${count}次 (${percentage}%)`);
  });

// 检查未出现的副效果
console.log("\n=== 未出现的副效果 ===");
const neverAppeared = SUPPORT_MODIFIERS.filter(support => !supportStats[support.id]);
if (neverAppeared.length > 0) {
  console.log(`⚠️ 有 ${neverAppeared.length} 个副效果在1000次模拟中从未出现:`);
  neverAppeared.forEach(support => {
    console.log(`  - ${support.label} (权重: ${support.weight}, 类别: ${support.category})`);
  });
} else {
  console.log("✓ 所有副效果都有出现");
}

// 检查权重过低的效果
console.log("\n=== 权重过低的效果 (< 0.5) ===");
const lowWeightSupports = SUPPORT_MODIFIERS.filter(support => (support.weight || 1.0) < 0.5);
if (lowWeightSupports.length > 0) {
  console.log(`有 ${lowWeightSupports.length} 个副效果权重低于0.5:`);
  lowWeightSupports.forEach(support => {
    console.log(`  - ${support.label} (权重: ${support.weight})`);
  });
}
