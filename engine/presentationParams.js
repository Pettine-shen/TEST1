/**
 * 表现参数分级系统
 * 定义施法前摇、子弹速度等影响命中率和手感的参数的分级
 * 在随机生成时提供更大的波动范围
 */

/**
 * 施法前摇（windupMs）分级
 * 前摇越长，命中率越低，但伤害可以更高
 */
export const WINDUP_TIERS = [
  { id: "instant", label: "瞬发", windupMs: 50, hitRateModifier: 1.0, damageModifier: 0.7 }, // 极快，低伤害
  { id: "veryFast", label: "极快", windupMs: 100, hitRateModifier: 0.95, damageModifier: 0.8 },
  { id: "fast", label: "快速", windupMs: 150, hitRateModifier: 0.9, damageModifier: 0.85 },
  { id: "medium", label: "中等", windupMs: 200, hitRateModifier: 0.85, damageModifier: 1.0 }, // 基准
  { id: "slow", label: "慢速", windupMs: 300, hitRateModifier: 0.75, damageModifier: 1.2 },
  { id: "verySlow", label: "极慢", windupMs: 450, hitRateModifier: 0.6, damageModifier: 1.4 },
  { id: "charged", label: "蓄力", windupMs: 600, hitRateModifier: 0.5, damageModifier: 1.6 }, // 极慢，高伤害
];

/**
 * 投射物速度（projectileSpeed）分级
 * 速度越快，命中率越高，但伤害可以更低
 */
export const PROJECTILE_SPEED_TIERS = [
  { id: "instant", label: "瞬发", projectileSpeed: 25, hitRateModifier: 1.0, damageModifier: 0.6 }, // 极快，低伤害
  { id: "veryFast", label: "极快", projectileSpeed: 20, hitRateModifier: 0.95, damageModifier: 0.7 },
  { id: "fast", label: "快速", projectileSpeed: 16, hitRateModifier: 0.9, damageModifier: 0.85 },
  { id: "medium", label: "中等", projectileSpeed: 12, hitRateModifier: 0.85, damageModifier: 1.0 }, // 基准
  { id: "slow", label: "慢速", projectileSpeed: 9, hitRateModifier: 0.75, damageModifier: 1.2 },
  { id: "verySlow", label: "极慢", projectileSpeed: 6, hitRateModifier: 0.6, damageModifier: 1.4 },
  { id: "crawling", label: "爬行", projectileSpeed: 4, hitRateModifier: 0.45, damageModifier: 1.6 }, // 极慢，高伤害
];

/**
 * 后摇（recoveryMs）分级
 * 后摇影响连发速度
 */
export const RECOVERY_TIERS = [
  { id: "instant", label: "无后摇", recoveryMs: 100, fireRateModifier: 1.0 },
  { id: "veryFast", label: "极快", recoveryMs: 200, fireRateModifier: 0.9 },
  { id: "fast", label: "快速", recoveryMs: 300, fireRateModifier: 0.85 },
  { id: "medium", label: "中等", recoveryMs: 400, fireRateModifier: 0.75 }, // 基准
  { id: "slow", label: "慢速", recoveryMs: 600, fireRateModifier: 0.6 },
  { id: "verySlow", label: "极慢", recoveryMs: 800, fireRateModifier: 0.45 },
];

/**
 * 随机选择一个前摇档位（带波动）
 * @param {Function} rng - 随机数生成器
 * @param {number} variance - 波动范围（0-1），0=完全按档位，1=完全随机
 * @returns {Object} 选中的档位，可能带有随机调整
 */
export function selectRandomWindup(rng, variance = 0.3) {
  const tier = WINDUP_TIERS[Math.floor(rng() * WINDUP_TIERS.length)];
  
  if (variance > 0) {
    // 在档位基础上添加随机波动
    const baseMs = tier.windupMs;
    const varianceRange = baseMs * variance; // 波动范围
    const adjustment = (rng() - 0.5) * 2 * varianceRange; // -varianceRange 到 +varianceRange
    const adjustedMs = Math.max(50, Math.min(800, baseMs + adjustment)); // 限制在合理范围内
    
    return {
      ...tier,
      windupMs: Math.round(adjustedMs),
    };
  }
  
  return tier;
}

/**
 * 随机选择一个投射物速度档位（带波动）
 * @param {Function} rng - 随机数生成器
 * @param {number} variance - 波动范围（0-1）
 * @returns {Object} 选中的档位，可能带有随机调整
 */
export function selectRandomProjectileSpeed(rng, variance = 0.3) {
  const tier = PROJECTILE_SPEED_TIERS[Math.floor(rng() * PROJECTILE_SPEED_TIERS.length)];
  
  if (variance > 0) {
    // 在档位基础上添加随机波动
    const baseSpeed = tier.projectileSpeed;
    const varianceRange = baseSpeed * variance;
    const adjustment = (rng() - 0.5) * 2 * varianceRange;
    const adjustedSpeed = Math.max(3, Math.min(30, baseSpeed + adjustment));
    
    return {
      ...tier,
      projectileSpeed: Math.round(adjustedSpeed * 10) / 10, // 保留一位小数
    };
  }
  
  return tier;
}

/**
 * 随机选择一个后摇档位（带波动）
 * @param {Function} rng - 随机数生成器
 * @param {number} variance - 波动范围（0-1）
 * @returns {Object} 选中的档位，可能带有随机调整
 */
export function selectRandomRecovery(rng, variance = 0.3) {
  const tier = RECOVERY_TIERS[Math.floor(rng() * RECOVERY_TIERS.length)];
  
  if (variance > 0) {
    const baseMs = tier.recoveryMs;
    const varianceRange = baseMs * variance;
    const adjustment = (rng() - 0.5) * 2 * varianceRange;
    const adjustedMs = Math.max(50, Math.min(1000, baseMs + adjustment));
    
    return {
      ...tier,
      recoveryMs: Math.round(adjustedMs),
    };
  }
  
  return tier;
}

/**
 * 根据命中率调整伤害公式
 * 命中率越低，伤害越高（平衡机制）
 * @param {Object} formula - 原始伤害公式 { scale, flat }
 * @param {number} hitRateModifier - 命中率修正（0-1）
 * @returns {Object} 调整后的伤害公式
 */
export function adjustDamageByHitRate(formula, hitRateModifier) {
  // 命中率越低，伤害越高
  // hitRateModifier = 0.5 时，伤害提升到 1.5 倍
  // hitRateModifier = 1.0 时，伤害保持原样
  const damageMultiplier = 1.0 + (1.0 - hitRateModifier) * 0.5; // 最多提升50%
  
  return {
    scale: (formula.scale || 0) * damageMultiplier,
    flat: (formula.flat || 0) * damageMultiplier,
  };
}

/**
 * 为选项生成随机的表现参数
 * @param {Object} option - 选项对象
 * @param {Function} rng - 随机数生成器
 * @param {number} variance - 波动范围（0-1），默认0.4（较大波动）
 * @returns {Object} 包含表现参数的对象
 */
export function generateRandomPresentationParams(option, rng, variance = 0.4) {
  const presentation = option.presentation || {};
  
  // 如果选项已经有表现参数，可以基于它们进行调整
  // 否则完全随机生成
  
  let windupMs = presentation.windupMs;
  let projectileSpeed = presentation.projectileSpeed;
  let recoveryMs = presentation.recoveryMs;
  
  // 前摇：如果没有指定，随机选择
  if (windupMs === undefined) {
    const windupTier = selectRandomWindup(rng, variance);
    windupMs = windupTier.windupMs;
  } else if (variance > 0) {
    // 如果有指定值，添加波动
    const varianceRange = windupMs * variance;
    const adjustment = (rng() - 0.5) * 2 * varianceRange;
    windupMs = Math.max(50, Math.min(800, Math.round(windupMs + adjustment)));
  }
  
  // 投射物速度：如果没有指定，随机选择
  if (projectileSpeed === undefined && (option.kind === "SpawnProjectile" || option.kind === "SpawnMultipleProjectiles" || option.kind === "SpawnBurstProjectiles")) {
    const speedTier = selectRandomProjectileSpeed(rng, variance);
    projectileSpeed = speedTier.projectileSpeed;
  } else if (projectileSpeed !== undefined && variance > 0) {
    // 如果有指定值，添加波动
    const varianceRange = projectileSpeed * variance;
    const adjustment = (rng() - 0.5) * 2 * varianceRange;
    projectileSpeed = Math.max(3, Math.min(30, Math.round((projectileSpeed + adjustment) * 10) / 10));
  }
  
  // 后摇：如果没有指定，随机选择
  if (recoveryMs === undefined) {
    const recoveryTier = selectRandomRecovery(rng, variance);
    recoveryMs = recoveryTier.recoveryMs;
  } else if (variance > 0) {
    const varianceRange = recoveryMs * variance;
    const adjustment = (rng() - 0.5) * 2 * varianceRange;
    recoveryMs = Math.max(50, Math.min(1000, Math.round(recoveryMs + adjustment)));
  }
  
  const result = {};
  if (windupMs !== undefined) result.windupMs = windupMs;
  if (projectileSpeed !== undefined) result.projectileSpeed = projectileSpeed;
  if (recoveryMs !== undefined) result.recoveryMs = recoveryMs;
  
  // 保留原有的其他表现参数
  if (presentation.indicatorShape) result.indicatorShape = presentation.indicatorShape;
  if (presentation.indicatorSize) result.indicatorSize = presentation.indicatorSize;
  
  return result;
}
