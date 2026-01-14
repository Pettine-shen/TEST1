export const templates = [
  {
    id: "tpl_ranged_proj_v1",
    event: "CastConfirm",
    budgetCap: { damage: 140, cc: 60, mobility: 0, proc: 40, perf: 50 },
    baseBudget: { damage: 0, cc: 0, mobility: 0, proc: 0, perf: 0 },
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
          { id: "line", label: "直线", kind: "singleNearest" },
          { id: "coneS", label: "小扇", kind: "cone", range: 10, max: 3, budget: { perf: 4 } },
          { id: "coneW", label: "大扇", kind: "cone", range: 12, max: 5, budget: { perf: 8 } },
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
            formula: { scale: 0.7, flat: 25 },
            budget: { damage: 25, perf: 6 },
          },
          {
            id: "proj_pierce",
            label: "穿1",
            kind: "SpawnProjectile",
            formula: { scale: 0.65, flat: 22 },
            budget: { damage: 26, perf: 10 },
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
        ],
      },
      {
        id: "tl1",
        type: "Timeline",
        defaultOption: "no_delay",
        options: [
          { id: "no_delay", label: "无延迟", delayMs: 0 },
          { id: "windup", label: "0.25s延迟", delayMs: 250, budget: { damage: -2 } },
        ],
      },
    ],
  },
  {
    id: "tpl_melee_burst_v1",
    event: "CastConfirm",
    budgetCap: { damage: 160, cc: 80, mobility: 40, proc: 20, perf: 40 },
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
          { id: "dash_none", label: "无位移", kind: "Dash", distance: 0 },
          { id: "dash5", label: "突进5m", kind: "Dash", distance: 5, budget: { mobility: 20 } },
        ],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "cone_hit",
        options: [
          { id: "cone_hit", label: "扇形高伤", kind: "Damage", formula: { scale: 1.0, flat: 20 }, budget: { damage: 35 } },
          { id: "line_thrust", label: "直线穿1", kind: "Damage", formula: { scale: 0.9, flat: 18 }, budget: { damage: 32 } },
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
          { id: "knockback", label: "击退1.5m", kind: "Debuff", debuff: { kind: "knockback", power: 1.5, durationMs: 0 }, budget: { cc: 15 } },
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
          { id: "recovery04", label: "后摇0.4s", delayMs: 400, budget: { damage: -2 } },
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
          { id: "pulse", label: "3m脉冲", kind: "SpawnAreaDoT", tickFormula: { scale: 0.4, flat: 10 }, budget: { damage: 18, perf: 6 } },
        ],
      },
      {
        id: "a2",
        type: "Action",
        defaultOption: "silence",
        options: [
          { id: "silence", label: "沉默0.6s", kind: "Debuff", debuff: { kind: "silence", power: 1, durationMs: 600 }, budget: { cc: 22 } },
          { id: "slow", label: "减速40% 1.5s", kind: "Debuff", debuff: { kind: "slow", power: 0.4, durationMs: 1500 }, budget: { cc: 12 } },
        ],
      },
      {
        id: "a3",
        type: "Action",
        defaultOption: "dmg_light",
        options: [
          { id: "dmg_light", label: "轻伤", kind: "Damage", formula: { scale: 0.4, flat: 10 }, budget: { damage: 12 } },
          { id: "dmg_mid", label: "中伤", kind: "Damage", formula: { scale: 0.55, flat: 15 }, budget: { damage: 18 } },
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
          { id: "r3", label: "半径3", kind: "circle", radius: 3, budget: { perf: 8 } },
          { id: "r4", label: "半径4", kind: "circle", radius: 4, budget: { perf: 12 } },
        ],
      },
      {
        id: "a1",
        type: "Action",
        defaultOption: "area4s",
        options: [
          { id: "area4s", label: "4s DoT", kind: "SpawnAreaDoT", tickFormula: { scale: 0.25, flat: 8 }, budget: { damage: 28, perf: 10 } },
          { id: "area6s", label: "6s DoT", kind: "SpawnAreaDoT", tickFormula: { scale: 0.35, flat: 10 }, budget: { damage: 35, perf: 14 } },
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
