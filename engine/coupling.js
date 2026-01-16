/**
 * 效果耦合关系系统
 * 定义哪些效果组合在一起有强依赖关系，提升技能的有效性
 * 
 * 与synergy的区别：
 * - synergy: 效果组合有"叠加收益"（bonus），但可以独立存在
 * - coupling: 效果组合有"强依赖关系"，缺少依赖效果会导致技能有效性大幅下降
 */

/**
 * 耦合关系定义
 * 格式：{ 
 *   effect: "主效果ID", 
 *   requires: ["依赖效果ID数组"], 
 *   priority: 优先级(1-10, 10最高),
 *   description: "描述",
 *   weight: 权重(0-1, 1表示100%概率同时生成)
 * }
 */
export const COUPLING_RELATIONS = [
  // === 反击类效果需要续航支持 ===
  {
    effect: "counter", // 反击（OnDamaged事件）
    requires: ["heal", "shield", "lifesteal"],
    priority: 10,
    description: "反击需要续航：反击会频繁触发，需要恢复或护盾保证生存",
    weight: 0.8, // 80%概率同时生成恢复效果
  },
  {
    effect: "reflect", // 反弹伤害
    requires: ["heal", "shield"],
    priority: 9,
    description: "反弹伤害需要防护：反弹伤害时自身也会受到伤害，需要恢复或护盾",
    weight: 0.7,
  },
  
  // === 高伤害技能需要控制支持 ===
  {
    effect: "execute", // 处决伤害（低血量时高伤害）
    requires: ["slow", "root", "stun"],
    priority: 9,
    description: "处决需要控制：处决需要敌人血量低，控制效果帮助降低敌人血量并防止逃跑",
    weight: 0.75,
  },
  {
    effect: "charge", // 蓄力技能
    requires: ["root", "stun", "slow"],
    priority: 8,
    description: "蓄力需要控制：蓄力时间长，需要控制敌人防止其逃跑或打断",
    weight: 0.7,
  },
  {
    effect: "proj_slow", // 慢速投射物
    requires: ["slow", "root", "stun"],
    priority: 8,
    description: "慢速投射物需要控制：慢速投射物容易被躲避，控制效果提高命中率",
    weight: 0.65,
  },
  
  // === 持续伤害需要控制支持 ===
  {
    effect: "areaDoT", // 区域持续伤害
    requires: ["slow", "root", "pull"],
    priority: 9,
    description: "区域持续伤害需要控制：敌人需要停留在区域内，控制效果防止其离开",
    weight: 0.8,
  },
  {
    effect: "bleed", // 流血伤害
    requires: ["slow", "root"],
    priority: 7,
    description: "流血需要控制：流血是持续伤害，控制效果防止敌人逃跑",
    weight: 0.6,
  },
  {
    effect: "hover", // 悬停投射物
    requires: ["slow", "root"],
    priority: 7,
    description: "悬停投射物需要控制：悬停投射物需要敌人停留在范围内，控制效果提高命中率",
    weight: 0.6,
  },
  
  // === 突进类技能需要防护支持 ===
  {
    effect: "dash", // 突进
    requires: ["shield", "invulnerable", "heal"],
    priority: 8,
    description: "突进需要防护：突进会接近敌人，需要防护避免被集火",
    weight: 0.7,
  },
  {
    effect: "blink", // 闪现
    requires: ["shield", "stealth"],
    priority: 7,
    description: "闪现需要防护：闪现后可能处于危险位置，需要防护或隐身",
    weight: 0.65,
  },
  {
    effect: "jump", // 跳跃
    requires: ["shield", "invulnerable"],
    priority: 6,
    description: "跳跃需要防护：跳跃过程中可能受到攻击，需要防护",
    weight: 0.6,
  },
  
  // === 易伤效果需要高伤害配合 ===
  {
    effect: "vulnerable", // 易伤debuff
    requires: ["dmg_high", "crit", "execute", "chain", "bounce"],
    priority: 9,
    description: "易伤需要高伤害：易伤debuff需要配合高伤害技能才能发挥最大效果",
    weight: 0.8,
  },
  
  // === 标记效果需要处决或奖励配合 ===
  {
    effect: "mark", // 标记
    requires: ["execute", "markReward"],
    priority: 8,
    description: "标记需要配合：标记通常配合处决伤害或击杀奖励使用",
    weight: 0.75,
  },
  
  // === 充能效果需要高伤害配合 ===
  {
    effect: "stack", // 充能
    requires: ["dmg_high", "crit", "execute"],
    priority: 7,
    description: "充能需要高伤害：充能后应该释放高伤害技能才能发挥最大价值",
    weight: 0.7,
  },
  
  // === 控制效果组合（先控后打） ===
  {
    effect: "pull", // 拉回
    requires: ["stun", "root", "damage"],
    priority: 8,
    description: "拉回需要控制：拉回敌人后需要控制或伤害，否则敌人会立即反击",
    weight: 0.75,
  },
  {
    effect: "knockback", // 击退
    requires: ["slow", "root"],
    priority: 6,
    description: "击退需要控制：击退后减速或定身，防止敌人快速返回",
    weight: 0.6,
  },
  
  // === 范围技能需要目标选择配合 ===
  {
    effect: "areaDoT", // 区域持续伤害
    requires: ["allInRange", "cone"],
    priority: 6,
    description: "区域伤害需要范围目标：区域伤害配合范围目标选择效果更好",
    weight: 0.5,
  },
  
  // === 连锁/弹跳需要多目标配合 ===
  {
    effect: "chain", // 连锁伤害
    requires: ["allInRange", "cone"],
    priority: 7,
    description: "连锁需要多目标：连锁伤害需要多个敌人才能发挥最大效果",
    weight: 0.7,
  },
  {
    effect: "bounce", // 弹跳伤害
    requires: ["allInRange", "cone"],
    priority: 7,
    description: "弹跳需要多目标：弹跳伤害需要多个敌人才能发挥最大效果",
    weight: 0.7,
  },
  
  // === 自身负面效果需要收益补偿 ===
  {
    effect: "selfVuln", // 自身易伤（狂暴）
    requires: ["dmg_high", "crit", "atkBoost"],
    priority: 9,
    description: "自身易伤需要高收益：自身易伤是负面效果，需要高伤害或攻击加成补偿",
    weight: 0.85,
  },
  {
    effect: "selfSlow", // 自身减速（过热）
    requires: ["dmg_high", "crit"],
    priority: 8,
    description: "自身减速需要高收益：自身减速是负面效果，需要高伤害补偿",
    weight: 0.8,
  },
  {
    effect: "selfRoot", // 自身定身
    requires: ["dmg_high", "crit", "execute"],
    priority: 9,
    description: "自身定身需要高收益：自身定身是严重负面效果，需要极高伤害补偿",
    weight: 0.9,
  },
  
  // === 召唤需要保护或控制配合 ===
  {
    effect: "summon", // 召唤
    requires: ["shield", "slow", "root"],
    priority: 6,
    description: "召唤需要配合：召唤物需要时间发挥作用，控制或防护帮助创造环境",
    weight: 0.5,
  },
  
  // === 光束需要控制配合 ===
  {
    effect: "beam", // 光束
    requires: ["slow", "root", "stun"],
    priority: 7,
    description: "光束需要控制：光束是持续伤害，控制效果防止敌人离开光束范围",
    weight: 0.65,
  },
  
  // === 追踪投射物需要穿透或分裂配合 ===
  {
    effect: "homing", // 追踪
    requires: ["pierce", "split", "bounce"],
    priority: 6,
    description: "追踪需要穿透：追踪投射物配合穿透或分裂可以命中更多敌人",
    weight: 0.5,
  },
];

/**
 * 检查效果是否有耦合依赖
 * @param {string} effectId - 效果ID
 * @returns {Array} 匹配的耦合关系数组
 */
export function getCouplingRelations(effectId) {
  if (!effectId) return [];
  
  const normalizedId = (effectId || "").toLowerCase();
  return COUPLING_RELATIONS.filter(relation => {
    const relationEffect = (relation.effect || "").toLowerCase();
    return normalizedId === relationEffect || 
           normalizedId.includes(relationEffect) || 
           relationEffect.includes(normalizedId);
  });
}

/**
 * 检查效果组合是否满足耦合关系
 * @param {Array} effectIds - 当前已有的效果ID数组
 * @param {string} newEffectId - 新添加的效果ID
 * @returns {Object|null} 耦合关系对象，如果不满足则返回null
 */
export function checkCouplingRequirement(effectIds, newEffectId) {
  const relations = getCouplingRelations(newEffectId);
  if (relations.length === 0) return null;
  
  // 找到优先级最高的耦合关系
  const highestPriorityRelation = relations.reduce((max, rel) => 
    rel.priority > (max?.priority || 0) ? rel : max, null
  );
  
  if (!highestPriorityRelation) return null;
  
  // 检查是否已经包含依赖效果
  const normalizedEffectIds = effectIds.map(id => (id || "").toLowerCase());
  const hasRequired = highestPriorityRelation.requires.some(req => {
    const normalizedReq = req.toLowerCase();
    return normalizedEffectIds.some(id => 
      id === normalizedReq || 
      id.includes(normalizedReq) || 
      normalizedReq.includes(id)
    );
  });
  
  if (hasRequired) {
    return null; // 已经满足依赖，不需要额外处理
  }
  
  return highestPriorityRelation; // 需要补充依赖效果
}

/**
 * 根据耦合关系推荐需要补充的效果
 * @param {Array} effectIds - 当前已有的效果ID数组
 * @param {string} newEffectId - 新添加的效果ID
 * @returns {Array} 推荐的效果ID数组（按优先级排序）
 */
export function getRecommendedCouplingEffects(effectIds, newEffectId) {
  const relation = checkCouplingRequirement(effectIds, newEffectId);
  if (!relation) return [];
  
  // 返回依赖效果列表，按优先级排序
  return relation.requires.map(req => ({
    effectId: req,
    priority: relation.priority,
    weight: relation.weight,
    description: relation.description,
  }));
}

/**
 * 从选项对象中提取效果ID（用于耦合检查）
 * @param {Object} option - 选项对象
 * @returns {Array} 效果ID数组
 */
export function extractEffectIdsForCoupling(option) {
  const effectIds = [];
  if (!option) return effectIds;
  
  const optId = (option.id || "").toLowerCase();
  const kind = (option.kind || "").toLowerCase();
  
  // 事件类型
  if (optId.includes("counter") || optId.includes("ondamaged")) {
    effectIds.push("counter");
  }
  
  // 伤害类型
  if (optId.includes("dmg_high") || kind === "damage" && (option.formula?.flat > 30 || option.formula?.scale > 0.8)) {
    effectIds.push("dmg_high");
  }
  if (kind === "ExecuteDamage") effectIds.push("execute");
  if (kind === "CritDamage") effectIds.push("crit");
  if (kind === "ChainDamage") effectIds.push("chain");
  if (kind === "BounceDamage") effectIds.push("bounce");
  if (kind === "PierceDamage") effectIds.push("pierce");
  if (kind === "SplitDamage") effectIds.push("split");
  if (kind === "BleedDamage") effectIds.push("bleed");
  
  // 投射物类型
  if (optId.includes("proj_slow") || (kind === "SpawnProjectile" && option.presentation?.projectileSpeed < 10)) {
    effectIds.push("proj_slow");
  }
  if (option.homing) effectIds.push("homing");
  if (option.hover) effectIds.push("hover");
  if (kind === "Beam") effectIds.push("beam");
  
  // 控制类型
  if (option.debuff) {
    const debuffKind = (option.debuff.kind || "").toLowerCase();
    if (debuffKind === "slow") effectIds.push("slow");
    if (debuffKind === "root") effectIds.push("root");
    if (debuffKind === "stun") effectIds.push("stun");
    if (debuffKind === "vulnerable") effectIds.push("vulnerable");
    if (debuffKind === "knockback") effectIds.push("knockback");
    if (debuffKind === "pull") effectIds.push("pull");
  }
  
  // 移动类型
  if (kind === "Dash") effectIds.push("dash");
  if (kind === "Blink") effectIds.push("blink");
  if (kind === "Jump") effectIds.push("jump");
  if (kind === "Pull") effectIds.push("pull");
  
  // 特殊机制
  if (kind === "Charge") effectIds.push("charge");
  if (kind === "Stack") effectIds.push("stack");
  if (kind === "Mark") effectIds.push("mark");
  if (kind === "MarkReward") effectIds.push("markReward");
  if (kind === "Summon") effectIds.push("summon");
  if (kind === "Heal") effectIds.push("heal");
  if (kind === "SpawnAreaDoT") effectIds.push("areaDoT");
  
  // Buff类型
  if (option.buff) {
    const buffKind = (option.buff.kind || "").toLowerCase();
    if (buffKind === "shield") effectIds.push("shield");
    if (buffKind === "atkBoost") effectIds.push("atkBoost");
  }
  
  // 自身负面效果
  if (option.debuff) {
    const debuffKind = (option.debuff.kind || "").toLowerCase();
    if (debuffKind === "selfVuln" || debuffKind === "selfvuln") effectIds.push("selfVuln");
    if (debuffKind === "selfSlow" || debuffKind === "selfslow") effectIds.push("selfSlow");
    if (debuffKind === "selfRoot" || debuffKind === "selfroot") effectIds.push("selfRoot");
  }
  
  // 反弹伤害
  if (kind === "ReflectDamage") effectIds.push("reflect");
  
  // 目标选择类型
  if (kind === "allInRange" || optId.includes("allrange")) effectIds.push("allInRange");
  if (kind === "cone" || optId.includes("cone")) effectIds.push("cone");
  
  return effectIds;
}
