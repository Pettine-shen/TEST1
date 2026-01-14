/**
 * Deterministic RNG based on mulberry32 for reproducible sims.
 * Seed space is 32-bit; derive new seeds upstream (seed + frame + ruleId).
 */
export function createRng(seed) {
  let t = (seed >>> 0) + 0x6D2B79F5;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickChance(rng, probability) {
  return rng() < probability;
}
