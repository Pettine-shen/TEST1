export const templates = [
  {
    id: "tpl_ranged_proj_v1",
    event: "CastConfirm",
    budgetCap: { damage: 140, cc: 60, mobility: 0, proc: 40, perf: 50 },
    baseBudget: { damage: 0, cc: 0, mobility: 0, proc: 0, perf: 0 },
    presentation: { windupMs: 150, recoveryMs: 300, projectileSpeed: 10, indicatorShape: "line" },
    slots: [
      {
        id: "c1",
        type: "Condition",
        defaultOption: "mana30",
        options: [
          { id: "mana30", label: "Mana≥30", kind: "HasResource", resource: "mana", amount: 30 },
          { id: "ammo1", label: "Ammo≥1", kind: "HasResource", resource: "ammo", amount: 1 },
        ],
      },
      {
        id: "c2",
        type: "Condition",
        defaultOption: "range12",
        options: [
          { id: "range12", label: "≤12m", kind: "InRange", max: 12 },
          { id: "range18", label: "≤18m", kind: "InRange", max: 18, budget: { damage: 5 } },
        ],
      },
      {
        id: "t1",
        type: "Target",
        defaultOption: "line",
        options: [
          { id: "line", label: "直线", kind: "singleNearest", presentation: { indicatorShape: "line", indicatorSize: { range: 12 } } },
          { id: "coneS", label: "小扇", kind: "cone", range: 10, max: 3, budget: { perf: 4 }, presentation: { indicatorShape: "cone", indicatorSize: { range: 10, angle: 60 } } },
          { id: "coneW", label: "大扇", kind: "cone", range: 12, max: 5, budget: { perf: 8 }, presentation: { indicatorShape: "cone", indicatorSize: { range: 12, angle: 90 } } },
          { id: "allRange", label: "范围内所有", kind: "allInRange", range: 8, maxCount: 10, budget: { perf: 8 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 8 } } },
          { id: "lowestHp", label: "最低生命", kind: "lowestHealth", range: 12, count: 1, budget: { perf: 6 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 12 } } },
        ],
      },
      {
        id: "a1",
        type: "Action",
        defaultOption: "proj_fast",
        options: [
          {
            id: "proj_fast",
            label: "快弹",
            kind: "SpawnProjectile",
            formula: { scale: 0.45, flat: 16 }, // 快速高命中，伤害降低
            budget: { damage: 18, perf: 6 },
            presentation: { windupMs: 100, projectileSpeed: 20 }, // 极快，前摇短
          },
          {
            id: "proj_pierce",
            label: "穿1",
            kind: "SpawnProjectile",
            formula: { scale: 0.6, flat: 20 }, // 中等速度，中等伤害
            budget: { damage: 24, perf: 10 },
            presentation: { windupMs: 150, projectileSpeed: 14 }, // 中等速度
          },
          {
            id: "proj_slow",
            label: "慢弹",
            kind: "SpawnProjectile",
            formula: { scale: 1.3, flat: 46 }, // 慢速低命中，伤害提高
            budget: { damage: 45, perf: 6 },
            presentation: { windupMs: 400, projectileSpeed: 8 }, // 极慢，长前摇
          },
          {
            id: "proj_scatter3",
            label: "3弹散射",
            kind: "SpawnMultipleProjectiles",
            count: 3,
            spreadAngle: 45,
            spreadType: "fan",
            formula: { scale: 0.4, flat: 14 }, // 每个子弹伤害（范围优势，单发伤害降低）
            budget: { damage: 42, perf: 12 }, // 总伤害 = 3 * 14 = 42
            presentation: { windupMs: 200, projectileSpeed: 12 }, // 中等速度，范围优势
          },
          {
            id: "proj_scatter5",
            label: "5弹散射",
            kind: "SpawnMultipleProjectiles",
            count: 5,
            spreadAngle: 60,
            spreadType: "fan",
            formula: { scale: 0.35, flat: 12 }, // 每个子弹伤害（大范围优势，单发伤害更低）
            budget: { damage: 60, perf: 18 }, // 总伤害 = 5 * 12 = 60
            presentation: { windupMs: 200, projectileSpeed: 12 }, // 中等速度，大范围优势
          },
          {
            id: "proj_burst3",
            label: "3连发",
            kind: "SpawnBurstProjectiles",
            count: 3,
            burstDelay: 150, // 增加延迟，降低命中率
            formula: { scale: 0.5, flat: 18 }, // 每个子弹伤害（连发优势，单发伤害降低）
            budget: { damage: 54, perf: 15 }, // 总伤害 = 3 * 18 = 54
            presentation: { windupMs: 200, projectileSpeed: 14 }, // 中等速度，连发有延迟
          },
          {
            id: "proj_explosive",
            label: "爆炸弹",
            kind: "SpawnProjectileWithExplosion",
            formula: { scale: 0.4, flat: 12 }, // 子弹伤害降低（命中后才有伤害）
            explosionFormula: { scale: 1.5, flat: 55 }, // 爆炸伤害提高（长延迟+范围，高伤害）
            explosionRadius: 2.5,
            explosionDelay: 1000,
            explosionType: "time",
            budget: { damage: 85, perf: 18 }, // 总伤害 = 12 + 55 = 67（但范围大）
            presentation: { windupMs: 250, projectileSpeed: 10 }, // 慢速+长延迟，高伤害
          },
          {
            id: "proj_hover",
            label: "悬停弹",
            kind: "SpawnProjectile",
            formula: { scale: 0.5, flat: 15 },
            hover: {
              hoverDuration: 2000,
              hoverRadius: 2,
              tickInterval: 200,
              tickFormula: { scale: 0.3, flat: 10 },
              hoverType: "position"
            },
            budget: { damage: 45, perf: 15 },
            presentation: { windupMs: 200, projectileSpeed: 12 },
          },
          {
            id: "proj_hover_long",
            label: "长悬停弹",
            kind: "SpawnProjectile",
            formula: { scale: 0.4, flat: 12 },
            hover: {
              hoverDuration: 3000,
              hoverRadius: 2.5,
              tickInterval: 150,
              tickFormula: { scale: 0.25, flat: 8 },
              hoverType: "position"
            },
            budget: { damage: 50, perf: 18 },
            presentation: { windupMs: 250, projectileSpeed: 10 },
          },
          {
            id: "beam_short",
            label: "短光束",
            kind: "Beam",
            beamLength: 12,
            beamWidth: 1,
            beamDuration: 1500,
            tickInterval: 100,
            tickFormula: { scale: 0.35, flat: 12 },
            pierceCount: -1,
            canRotate: false,
            budget: { damage: 45, perf: 20 },
            presentation: { windupMs: 200 },
          },
          {
            id: "beam_long",
            label: "长光束",
            kind: "Beam",
            beamLength: 18,
            beamWidth: 1.5,
            beamDuration: 2500,
            tickInterval: 80,
            tickFormula: { scale: 0.4, flat: 15 },
            pierceCount: -1,
            canRotate: false,
            budget: { damage: 60, perf: 25 },
            presentation: { windupMs: 300 },
          },
        ],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "dmg_mid",
        options: [
          { id: "dmg_mid", label: "中伤", kind: "Damage", formula: { scale: 0.7, flat: 25 }, budget: { damage: 25 } },
          { id: "dmg_high", label: "高伤", kind: "Damage", formula: { scale: 0.9, flat: 35 }, budget: { damage: 35 } },
          { id: "percent5", label: "5%最大生命", kind: "PercentDamage", percent: 0.05, flat: 0, budget: { damage: 30 } },
          { id: "percent8", label: "8%最大生命", kind: "PercentDamage", percent: 0.08, flat: 0, budget: { damage: 40 } },
          { id: "true_dmg", label: "真实伤害", kind: "TrueDamage", formula: { scale: 0.5, flat: 30 }, budget: { damage: 35 } },
          { id: "chain3", label: "3次连锁", kind: "ChainDamage", formula: { scale: 0.6, flat: 20 }, chainCount: 3, chainRange: 4, damageDecay: 0.8, budget: { damage: 40, perf: 10 } },
          { id: "bounce3", label: "3次弹射", kind: "BounceDamage", formula: { scale: 0.7, flat: 25 }, bounceCount: 3, bounceRange: 4, damageDecay: 0.8, canBounceSelf: false, budget: { damage: 45, perf: 12 } },
          { id: "pierce3", label: "穿透3个", kind: "PierceDamage", formula: { scale: 0.65, flat: 22 }, pierceCount: 3, damageDecay: 0.9, pierceWidth: 0.5, budget: { damage: 35, perf: 8 } },
          { id: "reflect20", label: "反弹20%", kind: "ReflectDamage", reflectPercent: 0.2, durationMs: 3000, maxReflect: 500, budget: { damage: 30, cc: 15 } },
          { id: "split3", label: "分裂3弹", kind: "SplitDamage", formula: { scale: 0.6, flat: 20 }, splitCount: 3, splitAngle: 60, damageDecay: 0.7, projectileSpeed: 10, budget: { damage: 50, perf: 15 } },
          { id: "execute", label: "处决伤害", kind: "ExecuteDamage", baseFormula: { scale: 0.8, flat: 30 }, executeThreshold: 0.3, executeMultiplier: 2.0, budget: { damage: 40 } },
          { id: "bleed", label: "流血3s", kind: "BleedDamage", tickFormula: { scale: 0.2, flat: 8 }, durationMs: 3000, tickIntervalMs: 500, maxStacks: 3, budget: { damage: 30, perf: 8 } },
          { id: "crit25", label: "25%暴击", kind: "CritDamage", formula: { scale: 0.7, flat: 25 }, critChance: 0.25, critMultiplier: 2.0, budget: { damage: 35, proc: 15 } },
          { id: "homing", label: "追踪弹", kind: "SpawnProjectile", formula: { scale: 0.6, flat: 22 }, homing: { turnRate: 0.15, loseTargetRange: 10 }, budget: { damage: 30, perf: 8 }, presentation: { projectileSpeed: 8 } },
          { id: "ricochet3", label: "弹跳3次", kind: "SpawnProjectile", formula: { scale: 0.65, flat: 24 }, ricochet: { bounceCount: 3, bounceRange: 4, damageDecay: 0.8 }, budget: { damage: 40, perf: 12 }, presentation: { projectileSpeed: 12 } },
          { id: "spiral", label: "螺旋弹", kind: "SpawnProjectile", formula: { scale: 0.7, flat: 26 }, spiral: { spiralRadius: 0.5, spiralSpeed: 5, turns: 2 }, budget: { damage: 32, perf: 10 }, presentation: { projectileSpeed: 10 } },
          { id: "orbit3", label: "环绕3弹", kind: "SpawnProjectile", formula: { scale: 0.5, flat: 18 }, orbit: { orbitRadius: 3, orbitSpeed: 2, orbitCount: 3, durationMs: 5000 }, budget: { damage: 35, perf: 15 }, presentation: { projectileSpeed: 0 } },
          { id: "return", label: "回旋弹", kind: "SpawnProjectile", formula: { scale: 0.6, flat: 20 }, return: { maxDistance: 8, returnSpeed: 8, returnDamage: true }, budget: { damage: 30, perf: 8 }, presentation: { projectileSpeed: 10 } },
          { id: "charge", label: "蓄力2s", kind: "Charge", maxChargeTime: 2000, minEffect: { scale: 0.5, flat: 20 }, maxEffect: { scale: 1.5, flat: 60 }, budget: { damage: 35, perf: 10 } },
          { id: "stack3", label: "充能3层", kind: "Stack", stackId: "default", maxStacks: 3, stackCooldown: 5000, budget: { proc: 15 } },
          { id: "summon_minion", label: "召唤仆从", kind: "Summon", hp: 100, atk: 20, defense: 5, moveSpeed: 2, attackRange: 3, attackSpeed: 1000, durationMs: 10000, summonType: "minion", ai: "attack", budget: { damage: 40, perf: 20 } },
        ],
      },
      {
        id: "a3",
        type: "Action",
        defaultOption: "slow_light",
        options: [
          {
            id: "slow_light",
            label: "减速20% 1.2s",
            kind: "Debuff",
            debuff: { kind: "slow", power: 0.2, durationMs: 1200 },
            budget: { cc: 8 },
          },
          {
            id: "vuln10",
            label: "易伤10% 2s",
            kind: "Debuff",
            debuff: { kind: "vulnerable", power: 0.1, durationMs: 2000 },
            budget: { damage: 8 },
          },
          {
            id: "root_short",
            label: "定身0.8s",
            kind: "Debuff",
            debuff: { kind: "root", power: 1.0, durationMs: 800 },
            budget: { cc: 18 },
          },
          {
            id: "disarm_short",
            label: "缴械1s",
            kind: "Debuff",
            debuff: { kind: "disarm", power: 1.0, durationMs: 1000 },
            budget: { cc: 20 },
          },
          {
            id: "heal_light",
            label: "轻治疗",
            kind: "Heal",
            formula: { scale: 0.3, flat: 50 },
            isPercent: false,
            budget: { cc: 15 },
          },
          {
            id: "atk_boost20",
            label: "攻击+20% 5s",
            kind: "Buff",
            buff: { kind: "atkBoost", power: 0.2, durationMs: 5000 },
            budget: { cc: 12 },
          },
          {
            id: "speed_boost15",
            label: "速度+15% 4s",
            kind: "Buff",
            buff: { kind: "speedBoost", power: 0.15, durationMs: 4000 },
            budget: { cc: 10 },
          },
          {
            id: "fear_short",
            label: "恐惧1.5s",
            kind: "Debuff",
            debuff: { kind: "fear", power: 1.0, durationMs: 1500, moveSpeed: 2 },
            budget: { cc: 28 },
          },
          {
            id: "charm_short",
            label: "魅惑1.2s",
            kind: "Debuff",
            debuff: { kind: "charm", power: 1.0, durationMs: 1200, moveSpeed: 2 },
            budget: { cc: 30 },
          },
          {
            id: "polymorph",
            label: "变形2s",
            kind: "Debuff",
            debuff: { kind: "polymorph", power: 1.0, durationMs: 2000, form: "sheep" },
            budget: { cc: 35 },
          },
          {
            id: "taunt",
            label: "嘲讽2s",
            kind: "Debuff",
            debuff: { kind: "taunt", power: 1.0, durationMs: 2000 },
            budget: { cc: 25 },
          },
          {
            id: "blind",
            label: "致盲1.5s",
            kind: "Debuff",
            debuff: { kind: "blind", power: 1.0, durationMs: 1500, missChance: 0.5 },
            budget: { cc: 20 },
          },
          {
            id: "suppress",
            label: "压制1s",
            kind: "Debuff",
            debuff: { kind: "suppress", power: 1.0, durationMs: 1000 },
            budget: { cc: 40 },
          },
          {
            id: "sleep",
            label: "睡眠2s",
            kind: "Debuff",
            debuff: { kind: "sleep", power: 1.0, durationMs: 2000, wakeOnDamage: true, healRate: 5 },
            budget: { cc: 25 },
          },
          {
            id: "ground",
            label: "击倒1.5s",
            kind: "Debuff",
            debuff: { kind: "ground", power: 1.0, durationMs: 1500 },
            budget: { cc: 30 },
          },
          {
            id: "banished",
            label: "放逐2s",
            kind: "Debuff",
            debuff: { kind: "banished", power: 1.0, durationMs: 2000 },
            budget: { cc: 35 },
          },
          {
            id: "immunity",
            label: "免疫3s",
            kind: "Debuff",
            debuff: { kind: "immunity", power: 1.0, durationMs: 3000, immunityType: "all" },
            budget: { cc: 30 },
          },
          {
            id: "invulnerable",
            label: "无敌1s",
            kind: "Debuff",
            debuff: { kind: "invulnerable", power: 1.0, durationMs: 1000 },
            budget: { cc: 40 },
          },
          {
            id: "cleanse",
            label: "净化",
            kind: "Debuff",
            debuff: { kind: "cleanse", power: 1.0, durationMs: 0, removeTypes: ["slow", "stun", "root", "disarm"], immunityDuration: 1000 },
            budget: { cc: 25 },
          },
          {
            id: "stealth",
            label: "隐身3s",
            kind: "Debuff",
            debuff: { kind: "stealth", power: 1.0, durationMs: 3000, revealOnAttack: true, revealOnDamage: true, revealRange: 3 },
            budget: { cc: 30 },
          },
          {
            id: "haste",
            label: "急速3s",
            kind: "Debuff",
            debuff: { kind: "haste", power: 1.0, durationMs: 3000, speedBoost: 0.5, attackSpeedBoost: 0.3 },
            budget: { cc: 20 },
          },
          {
            id: "charge",
            label: "蓄力2s",
            kind: "Charge",
            maxChargeTime: 2000,
            minEffect: { scale: 0.5, flat: 20 },
            maxEffect: { scale: 1.5, flat: 60 },
            budget: { damage: 35, perf: 10 },
          },
          {
            id: "stack3",
            label: "充能3层",
            kind: "Stack",
            stackId: "default",
            maxStacks: 3,
            stackCooldown: 5000,
            budget: { proc: 15 },
          },
          {
            id: "summon_minion",
            label: "召唤仆从",
            kind: "Summon",
            hp: 100,
            atk: 20,
            defense: 5,
            moveSpeed: 2,
            attackRange: 3,
            attackSpeed: 1000,
            durationMs: 10000,
            summonType: "minion",
            ai: "attack",
            budget: { damage: 40, perf: 20 },
          },
        ],
      },
      {
        id: "tl1",
        type: "Timeline",
        defaultOption: "no_delay",
        options: [
          { id: "no_delay", label: "无延迟", delayMs: 0 },
          { id: "windup", label: "0.25s延迟", delayMs: 250, budget: { damage: 5 } }, // 延迟降低命中率，增加伤害预算
          { id: "windup_long", label: "0.5s延迟", delayMs: 500, budget: { damage: 12 } }, // 长延迟，更高伤害
        ],
      },
    ],
  },
  {
    id: "tpl_melee_burst_v1",
    event: "CastConfirm",
    budgetCap: { damage: 160, cc: 80, mobility: 40, proc: 20, perf: 40 },
    presentation: { windupMs: 200, recoveryMs: 400, indicatorShape: "cone" }, // 近战需要前摇，但范围小
    slots: [
      {
        id: "c1",
        type: "Condition",
        defaultOption: "range4",
        options: [{ id: "range4", label: "近战≤4m", kind: "InRange", max: 4 }],
      },
      {
        id: "a1",
        type: "Action",
        defaultOption: "dash5",
        options: [
          { id: "dash_none", label: "无位移", kind: "Dash", distance: 0, speed: 15 },
          { id: "dash5", label: "突进5m", kind: "Dash", distance: 5, speed: 15, budget: { mobility: 20 }, presentation: { indicatorShape: "dash", indicatorSize: { distance: 5 } } },
          { id: "blink5", label: "闪现5m", kind: "Blink", distance: 5, canPassWall: false, budget: { mobility: 25 }, presentation: { indicatorShape: "dash", indicatorSize: { distance: 5 } } },
          { id: "jump5", label: "跳跃5m", kind: "Jump", distance: 5, height: 2, duration: 500, landDamage: null, budget: { mobility: 30 }, presentation: { indicatorShape: "dash", indicatorSize: { distance: 5 } } },
          { id: "pull3", label: "拉回3m", kind: "Pull", distance: 3, speed: 10, budget: { cc: 20, mobility: 15 } },
        ],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "cone_hit",
        options: [
          { id: "cone_hit", label: "扇形高伤", kind: "Damage", formula: { scale: 1.1, flat: 25 }, budget: { damage: 40 } }, // 近战范围小，伤害提高
          { id: "line_thrust", label: "直线穿1", kind: "Damage", formula: { scale: 1.0, flat: 22 }, budget: { damage: 36 } }, // 直线更精准，伤害稍高
          { id: "charge", label: "蓄力2s", kind: "Charge", maxChargeTime: 2000, minEffect: { scale: 0.5, flat: 20 }, maxEffect: { scale: 1.5, flat: 60 }, budget: { damage: 35, perf: 10 } },
          { id: "stack3", label: "充能3层", kind: "Stack", stackId: "default", maxStacks: 3, stackCooldown: 5000, budget: { proc: 15 } },
          { id: "summon_minion", label: "召唤仆从", kind: "Summon", hp: 100, atk: 20, defense: 5, moveSpeed: 2, attackRange: 3, attackSpeed: 1000, durationMs: 10000, summonType: "minion", ai: "attack", budget: { damage: 40, perf: 20 } },
        ],
      },
      {
        id: "a3",
        type: "Action",
        defaultOption: "berserk",
        options: [
          { id: "berserk", label: "狂暴自易伤", kind: "Debuff", debuff: { kind: "selfVuln", power: 0.1, durationMs: 4000 }, budget: { damage: 10 } },
          { id: "shield", label: "护盾200", kind: "Debuff", debuff: { kind: "shield", power: 200, durationMs: 3000 }, budget: { cc: 5 } },
        ],
      },
      {
        id: "a4",
        type: "Action",
        defaultOption: "knockback",
        options: [
          { id: "knockback", label: "击退1.5m", kind: "Debuff", debuff: { kind: "knockback", power: 1.5, durationMs: 300, moveSpeed: 5 }, budget: { cc: 15 } },
          { id: "ministun", label: "小眩0.4s", kind: "Debuff", debuff: { kind: "stun", power: 0.4, durationMs: 400 }, budget: { cc: 22 } },
        ],
      },
      {
        id: "tl1",
        type: "Timeline",
        defaultOption: "root05",
        options: [
          { id: "root05", label: "硬直0.5s", delayMs: 0 },
          { id: "slow1", label: "自减速1s", delayMs: 0 },
        ],
      },
      {
        id: "tl2",
        type: "Timeline",
        defaultOption: "recovery02",
        options: [
          { id: "recovery02", label: "后摇0.2s", delayMs: 200 },
          { id: "recovery04", label: "后摇0.4s", delayMs: 400, budget: { damage: 3 } }, // 长后摇降低DPS，但可以增加伤害预算
        ],
      },
    ],
  },
  {
    id: "tpl_counter_v1",
    event: "OnDamaged",
    guards: { icdMs: 800, capPerSecond: 2 },
    budgetCap: { damage: 100, cc: 80, mobility: 0, proc: 40, perf: 30 },
    slots: [
      {
        id: "c1",
        type: "Condition",
        defaultOption: "proc20",
        options: [
          { id: "proc20", label: "触发20%", kind: "ProcChance", chance: 0.2, budget: { proc: 10 } },
          { id: "proc35", label: "触发35%", kind: "ProcChance", chance: 0.35, budget: { proc: 20 } },
        ],
      },
      {
        id: "a1",
        type: "Action",
        defaultOption: "pulse",
        options: [
          { id: "pulse", label: "3m脉冲", kind: "SpawnAreaDoT", tickFormula: { scale: 0.4, flat: 10 }, radius: 3, durationMs: 2000, tickIntervalMs: 500, budget: { damage: 18, perf: 6 } },
        ],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "silence",
        options: [
          { id: "silence", label: "沉默0.6s", kind: "Debuff", debuff: { kind: "silence", power: 1, durationMs: 600 }, budget: { cc: 22 } },
          { id: "slow", label: "减速40% 1.5s", kind: "Debuff", debuff: { kind: "slow", power: 0.4, durationMs: 1500 }, budget: { cc: 12 } },
          { id: "root", label: "定身1s", kind: "Debuff", debuff: { kind: "root", power: 1.0, durationMs: 1000 }, budget: { cc: 18 } },
          { id: "disarm", label: "缴械1.2s", kind: "Debuff", debuff: { kind: "disarm", power: 1.0, durationMs: 1200 }, budget: { cc: 20 } },
        ],
      },
      {
        id: "a3",
        type: "Action",
        defaultOption: "dmg_light",
        options: [
          { id: "dmg_light", label: "轻伤", kind: "Damage", formula: { scale: 0.4, flat: 10 }, budget: { damage: 12 } },
          { id: "dmg_mid", label: "中伤", kind: "Damage", formula: { scale: 0.55, flat: 15 }, budget: { damage: 18 } },
          { id: "percent6", label: "6%最大生命", kind: "PercentDamage", percent: 0.06, flat: 0, budget: { damage: 35 } },
          { id: "chain2", label: "2次连锁", kind: "ChainDamage", formula: { scale: 0.5, flat: 15 }, chainCount: 2, chainRange: 3, damageDecay: 0.85, budget: { damage: 30, perf: 8 } },
        ],
      },
      {
        id: "a4",
        type: "Action",
        defaultOption: "overheat",
        options: [
          { id: "overheat", label: "自减速20% 1.2s", kind: "Debuff", debuff: { kind: "selfSlow", power: 0.2, durationMs: 1200 }, budget: { mobility: -5 } },
          { id: "selfroot", label: "自定身0.5s", kind: "Debuff", debuff: { kind: "selfRoot", power: 1, durationMs: 500 }, budget: { mobility: -8 } },
        ],
      },
      {
        id: "tl1",
        type: "Timeline",
        defaultOption: "delay0",
        options: [
          { id: "delay0", label: "即时", delayMs: 0 },
          { id: "delay150", label: "延迟0.15s", delayMs: 150 },
        ],
      },
    ],
  },
  {
    id: "tpl_ground_dot_v1",
    event: "CastConfirm",
    budgetCap: { damage: 140, cc: 50, mobility: 0, proc: 20, perf: 50 },
    presentation: { windupMs: 300, recoveryMs: 200, indicatorShape: "circle" }, // 范围技能，长前摇但大范围
    slots: [
      {
        id: "c1",
        type: "Condition",
        defaultOption: "mana25",
        options: [{ id: "mana25", label: "Mana≥25", kind: "HasResource", resource: "mana", amount: 25 }],
      },
      {
        id: "t1",
        type: "Target",
        defaultOption: "r3",
        options: [
          { id: "r3", label: "半径3", kind: "circle", radius: 3, budget: { perf: 8 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 3 } } },
          { id: "r4", label: "半径4", kind: "circle", radius: 4, budget: { perf: 12 }, presentation: { indicatorShape: "circle", indicatorSize: { radius: 4 } } },
        ],
      },
      {
        id: "a1",
        type: "Action",
        defaultOption: "area4s",
        options: [
          { id: "area4s", label: "4s DoT", kind: "SpawnAreaDoT", tickFormula: { scale: 0.2, flat: 7 }, durationMs: 4000, tickIntervalMs: 500, budget: { damage: 28, perf: 10 } }, // 大范围，单次伤害降低
          { id: "area6s", label: "6s DoT", kind: "SpawnAreaDoT", tickFormula: { scale: 0.3, flat: 9 }, durationMs: 6000, tickIntervalMs: 500, budget: { damage: 35, perf: 14 } }, // 持续时间长，总伤害高
        ],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "slow15",
        options: [
          { id: "slow15", label: "减速15%", kind: "Debuff", debuff: { kind: "slow", power: 0.15, durationMs: 4000 }, budget: { cc: 8 } },
          { id: "healcut", label: "治疗-10%", kind: "Debuff", debuff: { kind: "antiHeal", power: 0.1, durationMs: 4000 }, budget: { cc: 6 } },
        ],
      },
      {
        id: "tl1",
        type: "Timeline",
        defaultOption: "noDelay",
        options: [
          { id: "noDelay", label: "无延迟", delayMs: 0 },
          { id: "delay300", label: "0.3s延迟", delayMs: 300 },
        ],
      },
    ],
  },
  {
    id: "tpl_mark_exec_v1",
    event: "CastConfirm",
    budgetCap: { damage: 90, cc: 20, mobility: 0, proc: 10, perf: 10 },
    slots: [
      {
        id: "c1",
        type: "Condition",
        defaultOption: "monsterOnly",
        options: [
          { id: "monsterOnly", label: "仅怪物", kind: "TargetType", allow: ["monster"] },
          { id: "any", label: "任意目标", kind: "TargetType", allow: ["monster", "player"] },
        ],
      },
      {
        id: "t1",
        type: "Target",
        defaultOption: "single",
        options: [{ id: "single", label: "单体", kind: "singleNearest" }],
      },
      {
        id: "a1",
        type: "Action",
        defaultOption: "mark",
        options: [{ id: "mark", label: "印记20s", kind: "Mark", tag: "hunt_mark" }],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "bonus",
        options: [
          {
            id: "bonus",
            label: "击杀掉落加成",
            kind: "MarkReward",
            requiredTag: "hunt_mark",
            reward: { type: "dropBonus", table: "pve_bonus" },
          },
        ],
      },
      {
        id: "a3",
        type: "Action",
        defaultOption: "lightDmg",
        options: [
          { id: "lightDmg", label: "轻伤", kind: "Damage", formula: { scale: 0.5, flat: 15 }, budget: { damage: 18 } },
          { id: "noDmg", label: "无伤害", kind: "Damage", formula: { scale: 0, flat: 0 }, budget: { damage: 0 } },
        ],
      },
      {
        id: "tl1",
        type: "Timeline",
        defaultOption: "noDelay",
        options: [{ id: "noDelay", label: "无延迟", delayMs: 0 }],
      },
    ],
  },
];
