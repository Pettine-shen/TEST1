import { templates } from "./templates.js";
import { compileAssembly } from "../engine/runtime.js";

function findTemplate(id) {
  const tpl = templates.find((t) => t.id === id);
  if (!tpl) throw new Error(`template ${id} not found`);
  return tpl;
}

export const assemblies = {
  iceCone: compileAssembly(findTemplate("tpl_ranged_proj_v1"), ["c1", "c2", "t1", "a1", "a2", "a3", "tl1"], {
    c1: "mana30",
    c2: "range18",
    t1: "coneW",
    a1: "proj_fast",
    a2: "dmg_mid",
    a3: "slow_light",
    tl1: "no_delay",
  }),
  meleeBurst: compileAssembly(findTemplate("tpl_melee_burst_v1"), ["c1", "a1", "a2", "a3", "a4", "tl1", "tl2"], {
    a1: "dash5",
    a2: "cone_hit",
    a3: "berserk",
    a4: "ministun",
    tl1: "root05",
    tl2: "recovery02",
  }),
  counterPulse: compileAssembly(findTemplate("tpl_counter_v1"), ["c1", "a1", "a2", "a3", "a4", "tl1"], {
    c1: "proc20",
    a1: "pulse",
    a2: "silence",
    a3: "dmg_light",
    a4: "overheat",
    tl1: "delay0",
  }),
  groundControl: compileAssembly(findTemplate("tpl_ground_dot_v1"), ["c1", "t1", "a1", "a2", "tl1"], {
    c1: "mana25",
    t1: "r4",
    a1: "area6s",
    a2: "slow15",
    tl1: "delay300",
  }),
  markHunt: compileAssembly(findTemplate("tpl_mark_exec_v1"), ["c1", "t1", "a1", "a2", "a3", "tl1"], {
    c1: "monsterOnly",
    t1: "single",
    a1: "mark",
    a2: "bonus",
    a3: "lightDmg",
    tl1: "noDelay",
  }),
};
