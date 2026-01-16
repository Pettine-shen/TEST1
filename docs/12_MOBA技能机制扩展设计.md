# 12 MOBA 技能机制扩展设计

## 12.1 设计目标

参考主流 MOBA 游戏（英雄联盟、DOTA2、王者荣耀等）的技能机制，扩展 ECA 系统的 Action、Condition、Target 类型，使技能系统更加丰富多样，支持：

1. **更多位移机制**：闪现、跳跃、拉回、传送
2. **更丰富的控制效果**：眩晕、击飞、拉拽、恐惧、魅惑、变形
3. **更复杂的伤害机制**：百分比伤害、真实伤害、反弹、延迟伤害、连锁伤害
4. **增益与保护机制**：护盾、治疗、属性提升、免疫、无敌
5. **特殊机制**：标记、连锁、弹射、穿透、分裂、追踪、蓄力、充能
6. **区域效果扩展**：治疗区域、视野区域、阻挡区域
7. **召唤机制**：召唤物、陷阱、守卫

## 12.2 位移机制扩展

### 12.2.1 现有机制
- `Dash(distance, speed)`: 突进（已实现）

### 12.2.2 新增位移类型

#### Blink（闪现）
- **功能**：瞬间移动到目标位置（无轨迹）
- **参数**：
  - `distance`: 最大距离
  - `canPassWall`: 是否可穿墙（本阶段简化为忽略障碍）
- **预算**：`mobility: 25`
- **示例**：
```javascript
{
  id: "blink5",
  label: "闪现5m",
  kind: "Blink",
  distance: 5,
  canPassWall: false,
  budget: { mobility: 25 }
}
```

#### Jump（跳跃）
- **功能**：抛物线跳跃到目标位置
- **参数**：
  - `distance`: 水平距离
  - `height`: 跳跃高度
  - `duration`: 跳跃持续时间
- **预算**：`mobility: 30`
- **视觉**：抛物线轨迹，落地有冲击效果

#### Pull（拉回）
- **功能**：将目标拉向自己
- **参数**：
  - `distance`: 拉回距离
  - `speed`: 拉回速度
- **预算**：`cc: 20, mobility: 15`
- **目标**：需要 Target 选择

#### Teleport（传送）
- **功能**：延迟后传送到目标位置
- **参数**：
  - `delay`: 传送延迟（毫秒）
  - `maxDistance`: 最大距离
- **预算**：`mobility: 35`
- **视觉**：传送前有引导效果

## 12.3 控制效果扩展

### 12.3.1 现有机制
- `Debuff(slow)`: 减速（已实现）
- `Debuff(silence)`: 沉默（已实现）
- `Debuff(stun)`: 眩晕（已实现）

### 12.3.2 新增控制类型

#### Stun（眩晕）
- **功能**：目标无法移动和施法
- **参数**：
  - `durationMs`: 持续时间
  - `power`: 强度（1.0 = 完全眩晕）
- **预算**：`cc: 25`
- **示例**：
```javascript
{
  id: "stun_short",
  label: "眩晕0.5s",
  kind: "Debuff",
  debuff: { kind: "stun", power: 1.0, durationMs: 500 },
  budget: { cc: 25 }
}
```

#### Knockup（击飞）
- **功能**：目标被击飞，无法操作
- **参数**：
  - `height`: 击飞高度
  - `durationMs`: 持续时间
- **预算**：`cc: 30`
- **视觉**：目标向上飞起，然后落下

#### Pull（拉拽）
- **功能**：强制移动目标
- **参数**：
  - `direction`: 拉拽方向（"towardCaster" / "awayFromCaster" / "aimDirection"）
  - `distance`: 拉拽距离
  - `speed`: 拉拽速度
- **预算**：`cc: 22`

#### Fear（恐惧）
- **功能**：目标随机移动，无法控制
- **参数**：
  - `durationMs`: 持续时间
  - `moveSpeed`: 恐惧时的移动速度
- **预算**：`cc: 28`

#### Charm（魅惑）
- **功能**：目标向施法者移动
- **参数**：
  - `durationMs`: 持续时间
  - `moveSpeed`: 魅惑时的移动速度
- **预算**：`cc: 26`

#### Polymorph（变形）
- **功能**：目标变形为小动物，无法攻击
- **参数**：
  - `durationMs`: 持续时间
- **预算**：`cc: 32`
- **视觉**：目标外观改变

#### Root（定身）
- **功能**：目标无法移动，但可以攻击和施法
- **参数**：
  - `durationMs`: 持续时间
- **预算**：`cc: 18`

#### Disarm（缴械）
- **功能**：目标无法攻击，但可以移动和施法
- **参数**：
  - `durationMs`: 持续时间
- **预算**：`cc: 20`

## 12.4 伤害机制扩展

### 12.4.1 现有机制
- `Damage(formula)`: 基础伤害（已实现）
- `SpawnProjectile(formula)`: 投射物伤害（已实现）
- `SpawnAreaDoT(tickFormula)`: 区域持续伤害（已实现）

### 12.4.2 新增伤害类型

#### PercentDamage（百分比伤害）
- **功能**：基于目标最大生命值的百分比伤害
- **参数**：
  - `percent`: 百分比（0.05 = 5%）
  - `flat`: 固定伤害（可选）
- **预算**：`damage: 30`
- **示例**：
```javascript
{
  id: "percent_dmg5",
  label: "5%最大生命",
  kind: "PercentDamage",
  percent: 0.05,
  flat: 0,
  budget: { damage: 30 }
}
```

#### TrueDamage（真实伤害）
- **功能**：无视防御的伤害
- **参数**：
  - `formula`: 伤害公式（不计算防御）
- **预算**：`damage: 35`
- **示例**：
```javascript
{
  id: "true_dmg",
  label: "真实伤害",
  kind: "TrueDamage",
  formula: { scale: 0.5, flat: 30 },
  budget: { damage: 35 }
}
```

#### ReflectDamage（反弹伤害）
- **功能**：反弹受到的伤害
- **参数**：
  - `percent`: 反弹百分比
  - `durationMs`: 持续时间
- **预算**：`damage: 25, proc: 15`
- **事件**：通常绑定 `OnDamaged`

#### DelayedDamage（延迟伤害）
- **功能**：延迟一段时间后造成伤害
- **参数**：
  - `formula`: 伤害公式
  - `delayMs`: 延迟时间
- **预算**：`damage: 28`
- **实现**：使用 Timeline 延迟执行

#### ChainDamage（连锁伤害）
- **功能**：伤害在目标之间跳跃
- **参数**：
  - `formula`: 基础伤害公式
  - `chainCount`: 连锁次数
  - `chainRange`: 连锁范围
  - `damageDecay`: 每次连锁伤害衰减（0.8 = 每次减少20%）
- **预算**：`damage: 40, perf: 10`
- **示例**：
```javascript
{
  id: "chain3",
  label: "3次连锁",
  kind: "ChainDamage",
  formula: { scale: 0.6, flat: 20 },
  chainCount: 3,
  chainRange: 4,
  damageDecay: 0.8,
  budget: { damage: 40, perf: 10 }
}
```

#### BounceDamage（弹射伤害）
- **功能**：伤害在目标之间弹射
- **参数**：
  - `formula`: 基础伤害公式
  - `bounceCount`: 弹射次数
  - `bounceRange`: 弹射范围
  - `damageDecay`: 每次弹射伤害衰减
- **预算**：`damage: 45, perf: 12`
- **区别**：弹射可以重复命中同一目标，连锁不能

#### PierceDamage（穿透伤害）
- **功能**：伤害穿透多个目标
- **参数**：
  - `formula`: 伤害公式
  - `pierceCount`: 穿透次数
  - `damageDecay`: 每次穿透伤害衰减
- **预算**：`damage: 35, perf: 8`
- **实现**：投射物命中后继续飞行

#### SplitDamage（分裂伤害）
- **功能**：命中后分裂成多个投射物
- **参数**：
  - `formula`: 基础伤害公式
  - `splitCount`: 分裂数量
  - `splitAngle`: 分裂角度
  - `damageDecay`: 分裂后伤害衰减
- **预算**：`damage: 50, perf: 15`

## 12.5 增益与保护机制

### 12.5.1 现有机制
- `Debuff(shield)`: 护盾（已实现）
- `Debuff(selfSlow)`: 自减速（已实现）

### 12.5.2 新增增益类型

#### Shield（护盾）
- **功能**：吸收伤害
- **参数**：
  - `amount`: 护盾值
  - `durationMs`: 持续时间
- **预算**：`cc: 10`
- **实现**：已存在，需要完善

#### Heal（治疗）
- **功能**：恢复生命值
- **参数**：
  - `formula`: 治疗量公式（基于施法者属性）
  - `isPercent`: 是否基于目标最大生命值百分比
- **预算**：`cc: 15`
- **示例**：
```javascript
{
  id: "heal_light",
  label: "轻治疗",
  kind: "Heal",
  formula: { scale: 0.3, flat: 50 },
  isPercent: false,
  budget: { cc: 15 }
}
```

#### Buff（增益）
- **功能**：提升目标属性
- **参数**：
  - `kind`: 增益类型（"atkBoost" / "defBoost" / "speedBoost" / "critBoost"）
  - `power`: 提升百分比或固定值
  - `durationMs`: 持续时间
- **预算**：`cc: 12`
- **示例**：
```javascript
{
  id: "atk_boost20",
  label: "攻击+20% 5s",
  kind: "Buff",
  buff: { kind: "atkBoost", power: 0.2, durationMs: 5000 },
  budget: { cc: 12 }
}
```

#### Immunity（免疫）
- **功能**：免疫特定类型的伤害或控制
- **参数**：
  - `type`: 免疫类型（"damage" / "cc" / "debuff" / "all"）
  - `durationMs`: 持续时间
- **预算**：`cc: 35`
- **示例**：
```javascript
{
  id: "immune_cc",
  label: "免疫控制 1s",
  kind: "Immunity",
  immunity: { type: "cc", durationMs: 1000 },
  budget: { cc: 35 }
}
```

#### Invulnerable（无敌）
- **功能**：完全免疫所有伤害
- **参数**：
  - `durationMs`: 持续时间
- **预算**：`cc: 40`
- **实现**：类似免疫，但优先级更高

#### Cleanse（净化）
- **功能**：移除负面效果
- **参数**：
  - `types`: 移除的效果类型数组（["slow", "stun", "silence"]）
- **预算**：`cc: 18`
- **示例**：
```javascript
{
  id: "cleanse_all",
  label: "净化所有负面",
  kind: "Cleanse",
  removeTypes: ["slow", "stun", "silence", "root", "disarm"],
  budget: { cc: 18 }
}
```

## 12.6 特殊机制

### 12.6.1 标记与连锁机制

#### Mark（标记）
- **功能**：标记目标（已实现）
- **扩展**：支持标记叠加层数

#### MarkReward（标记奖励）
- **功能**：对标记目标有额外效果（已实现）

#### Chain（连锁）
- **功能**：效果在目标之间连锁
- **参数**：
  - `chainCount`: 连锁次数
  - `chainRange`: 连锁范围
  - `targetType`: 连锁目标类型（"enemy" / "ally" / "any"）
- **预算**：`proc: 20, perf: 10`

### 12.6.2 投射物机制扩展

#### HomingProjectile（追踪投射物）
- **功能**：自动追踪目标
- **参数**：
  - `formula`: 伤害公式
  - `turnRate`: 转向速度（度/秒）
  - `maxTurnAngle`: 最大转向角度
- **预算**：`damage: 30, perf: 8`
- **实现**：投射物每帧调整方向朝向目标

#### RicochetProjectile（弹跳投射物）
- **功能**：在目标之间弹跳
- **参数**：
  - `formula`: 伤害公式
  - `bounceCount`: 弹跳次数
  - `bounceRange`: 弹跳范围
  - `damageDecay`: 每次弹跳伤害衰减
- **预算**：`damage: 45, perf: 12`

#### PiercingProjectile（穿透投射物）
- **功能**：穿透多个目标
- **参数**：
  - `formula`: 伤害公式
  - `pierceCount`: 穿透次数
  - `damageDecay`: 每次穿透伤害衰减
- **预算**：`damage: 35, perf: 8`
- **实现**：投射物命中后不消失，继续飞行

#### SplittingProjectile（分裂投射物）
- **功能**：命中后分裂成多个投射物
- **参数**：
  - `formula`: 基础伤害公式
  - `splitCount`: 分裂数量
  - `splitAngle`: 分裂角度
  - `damageDecay`: 分裂后伤害衰减
- **预算**：`damage: 50, perf: 15`

### 12.6.3 蓄力与充能机制

#### Charge（蓄力）
- **功能**：按住技能键蓄力，释放时根据蓄力时间产生不同效果
- **参数**：
  - `maxChargeTime`: 最大蓄力时间
  - `minEffect`: 最小蓄力时的效果
  - `maxEffect`: 最大蓄力时的效果
- **预算**：`damage: 40, perf: 5`
- **实现**：需要修改输入系统，支持按住检测

#### Stack（叠加）
- **功能**：效果可以叠加层数
- **参数**：
  - `maxStacks`: 最大层数
  - `stackEffect`: 每层效果
- **预算**：`proc: 15`
- **示例**：
```javascript
{
  id: "stack_atk",
  label: "攻击叠加",
  kind: "Stack",
  maxStacks: 5,
  stackEffect: { atkBoost: 0.05 },
  budget: { proc: 15 }
}
```

### 12.6.4 延迟与触发机制

#### DelayedTrigger（延迟触发）
- **功能**：延迟一段时间后触发效果
- **参数**：
  - `delayMs`: 延迟时间
  - `effect`: 触发的效果（Action）
- **预算**：`proc: 10`
- **实现**：使用 Timeline 或世界队列

#### ConditionalTrigger（条件触发）
- **功能**：满足条件时触发效果
- **参数**：
  - `condition`: 触发条件（Condition）
  - `effect`: 触发的效果（Action）
- **预算**：`proc: 15`
- **实现**：需要事件监听系统

## 12.7 区域效果扩展

### 12.7.1 现有机制
- `SpawnAreaDoT`: 区域持续伤害（已实现）

### 12.7.2 新增区域类型

#### SpawnAreaHeal（治疗区域）
- **功能**：区域内持续治疗
- **参数**：
  - `tickFormula`: 每次治疗量公式
  - `radius`: 区域半径
  - `durationMs`: 持续时间
  - `tickIntervalMs`: 治疗间隔
- **预算**：`cc: 25, perf: 8`
- **示例**：
```javascript
{
  id: "heal_zone",
  label: "治疗区域",
  kind: "SpawnAreaHeal",
  tickFormula: { scale: 0.1, flat: 20 },
  radius: 3,
  durationMs: 5000,
  tickIntervalMs: 1000,
  budget: { cc: 25, perf: 8 }
}
```

#### SpawnAreaSlow（减速区域）
- **功能**：区域内持续减速
- **参数**：
  - `slowPower`: 减速百分比
  - `radius`: 区域半径
  - `durationMs`: 持续时间
- **预算**：`cc: 20, perf: 6`

#### SpawnAreaVision（视野区域）
- **功能**：提供视野
- **参数**：
  - `radius`: 视野半径
  - `durationMs`: 持续时间
- **预算**：`proc: 10, perf: 5`
- **实现**：标记区域内的敌人可见

#### SpawnAreaBlock（阻挡区域）
- **功能**：阻挡移动
- **参数**：
  - `radius`: 区域半径
  - `durationMs`: 持续时间
- **预算**：`cc: 30, perf: 8`
- **实现**：区域内无法移动

## 12.8 召唤机制

### 12.8.1 Summon（召唤物）
- **功能**：召唤一个实体
- **参数**：
  - `type`: 召唤物类型（"minion" / "turret" / "ward"）
  - `hp`: 生命值
  - `atk`: 攻击力
  - `durationMs`: 存在时间
  - `behavior`: 行为（"attack" / "defend" / "follow"）
- **预算**：`proc: 25, perf: 15`
- **示例**：
```javascript
{
  id: "summon_minion",
  label: "召唤小兵",
  kind: "Summon",
  summon: {
    type: "minion",
    hp: 200,
    atk: 30,
    durationMs: 10000,
    behavior: "attack"
  },
  budget: { proc: 25, perf: 15 }
}
```

### 12.8.2 Trap（陷阱）
- **功能**：放置陷阱，触发时产生效果
- **参数**：
  - `triggerRadius`: 触发半径
  - `effect`: 触发效果（Action）
  - `durationMs`: 存在时间
  - `maxTriggers`: 最大触发次数
- **预算**：`proc: 20, perf: 10`
- **示例**：
```javascript
{
  id: "trap_explosive",
  label: "爆炸陷阱",
  kind: "Trap",
  trap: {
    triggerRadius: 2,
    effect: { kind: "Damage", formula: { scale: 0.8, flat: 40 } },
    durationMs: 30000,
    maxTriggers: 1
  },
  budget: { proc: 20, perf: 10 }
}
```

### 12.8.3 Ward（守卫）
- **功能**：放置守卫，提供视野
- **参数**：
  - `visionRadius`: 视野半径
  - `durationMs`: 存在时间
  - `isInvisible`: 是否隐形
- **预算**：`proc: 15, perf: 8`

## 12.9 Condition 扩展

### 12.9.1 现有条件
- `HasResource`: 资源检查（已实现）
- `InRange`: 距离检查（已实现）
- `TargetType`: 目标类型检查（已实现）
- `ProcChance`: 概率检查（已实现）

### 12.9.2 新增条件类型

#### HasBuff（有增益）
- **功能**：检查目标是否有特定增益
- **参数**：
  - `buffType`: 增益类型
  - `minStacks`: 最小层数（可选）
- **预算**：`proc: 5`

#### HasDebuff（有负面）
- **功能**：检查目标是否有特定负面效果
- **参数**：
  - `debuffType`: 负面类型
  - `minStacks`: 最小层数（可选）
- **预算**：`proc: 5`

#### HealthBelow（生命值低于）
- **功能**：检查目标生命值百分比
- **参数**：
  - `percent`: 百分比阈值（0.5 = 50%）
- **预算**：`proc: 5`

#### HealthAbove（生命值高于）
- **功能**：检查目标生命值百分比
- **参数**：
  - `percent`: 百分比阈值
- **预算**：`proc: 5`

#### HasMark（有标记）
- **功能**：检查目标是否有特定标记
- **参数**：
  - `markTag`: 标记标签
- **预算**：`proc: 5`

#### CooldownReady（冷却就绪）
- **功能**：检查技能冷却是否完成
- **参数**：
  - `skillId`: 技能ID（可选，默认当前技能）
- **预算**：`proc: 5`

## 12.10 Target 扩展

### 12.10.1 现有目标选择
- `singleNearest`: 最近单体（已实现）
- `cone`: 扇形（已实现）
- `circle`: 圆形（已实现）

### 12.10.2 新增目标选择类型

#### AllInRange（范围内所有）
- **功能**：选择范围内的所有目标
- **参数**：
  - `range`: 范围
  - `maxCount`: 最大数量（可选）
- **预算**：`perf: 8`

#### LowestHealth（最低生命值）
- **功能**：选择生命值最低的目标
- **参数**：
  - `range`: 搜索范围
  - `count`: 选择数量
- **预算**：`perf: 6`

#### HighestHealth（最高生命值）
- **功能**：选择生命值最高的目标
- **参数**：
  - `range`: 搜索范围
  - `count`: 选择数量
- **预算**：`perf: 6`

#### MarkedTargets（标记目标）
- **功能**：选择有特定标记的目标
- **参数**：
  - `markTag`: 标记标签
  - `range`: 搜索范围
- **预算**：`perf: 5`

#### Self（自己）
- **功能**：选择自己
- **参数**：无
- **预算**：`perf: 1`

#### Allies（友军）
- **功能**：选择友军
- **参数**：
  - `range`: 搜索范围
  - `maxCount`: 最大数量
- **预算**：`perf: 6`

#### Line（直线）
- **功能**：选择直线路径上的目标
- **参数**：
  - `range`: 直线长度
  - `width`: 直线宽度
- **预算**：`perf: 8`

## 12.11 实现优先级

### 第一阶段（核心机制）
1. **控制效果扩展**：Stun、Root、Disarm
2. **伤害机制扩展**：PercentDamage、TrueDamage、ChainDamage
3. **增益机制**：Heal、Buff（atkBoost、speedBoost）
4. **目标选择扩展**：AllInRange、LowestHealth

### 第二阶段（进阶机制）
1. **位移扩展**：Blink、Jump、Pull
2. **控制扩展**：Knockup、Fear、Charm
3. **投射物扩展**：HomingProjectile、PiercingProjectile
4. **区域效果扩展**：SpawnAreaHeal、SpawnAreaSlow

### 第三阶段（高级机制）
1. **召唤机制**：Summon、Trap、Ward
2. **特殊机制**：Charge、Stack、DelayedTrigger
3. **复杂伤害**：BounceDamage、SplitDamage、ReflectDamage
4. **条件扩展**：HasBuff、HasDebuff、HealthBelow

## 12.12 预算系统扩展

新增预算类型：
- `sustain`: 持续能力（治疗、护盾）
- `utility`: 功能性（视野、传送、净化）

预算上限示例：
```javascript
budgetCap: {
  damage: 140,
  cc: 80,
  mobility: 40,
  proc: 40,
  perf: 50,
  sustain: 30,  // 新增
  utility: 20   // 新增
}
```

## 12.13 模板扩展建议

### 新增模板类型

1. **tpl_support_v1**（辅助模板）
   - 事件：CastConfirm
   - 槽位：资源条件 → 目标选择（友军） → 治疗/护盾 → 增益 → 净化

2. **tpl_tank_v1**（坦克模板）
   - 事件：CastConfirm / OnDamaged
   - 槽位：资源条件 → 目标选择 → 护盾/免疫 → 控制 → 反弹伤害

3. **tpl_assassin_v1**（刺客模板）
   - 事件：CastConfirm
   - 槽位：资源条件 → 目标选择（最低生命） → 闪现/突进 → 高伤害 → 标记

4. **tpl_mage_v1**（法师模板）
   - 事件：CastConfirm
   - 槽位：资源条件 → 目标选择（范围） → 连锁/弹射伤害 → 控制 → 区域效果

5. **tpl_summoner_v1**（召唤师模板）
   - 事件：CastConfirm
   - 槽位：资源条件 → 目标选择 → 召唤物 → 增益（给召唤物） → 陷阱

## 12.14 技能描述生成扩展

技能描述生成器需要识别新类型：
- `Blink` → "闪现到目标位置"
- `Heal` → "恢复X点生命值"
- `ChainDamage` → "连锁伤害，最多X次"
- `Summon` → "召唤X"
- `Trap` → "放置陷阱"

## 12.15 性能考虑

1. **连锁/弹射计算**：限制最大连锁/弹射次数（建议5次）
2. **区域效果查询**：使用空间分区优化（本阶段简化）
3. **召唤物数量**：限制同时存在的召唤物数量（建议5个）
4. **投射物数量**：限制同时存在的投射物数量（建议20个）
5. **预算限制**：通过预算系统限制过度使用高性能效果

## 12.16 视觉效果建议

1. **控制效果**：不同颜色光晕（眩晕=黄色，沉默=紫色，减速=蓝色）
2. **增益效果**：绿色光晕，向上箭头
3. **治疗效果**：绿色数字，上升动画
4. **召唤物**：不同外观区分类型
5. **陷阱**：半透明标记，触发时高亮
6. **连锁/弹射**：连接线显示路径
