// Statistics shared by report.mjs and evals/skill-ab-v3/scripts/analyze.mjs.

export function permutationP(a, b, rounds = 20000) {
  const all = [...a, ...b];
  const observed = Math.abs(meanOf(b) - meanOf(a));
  if (observed < 1e-12) return 1;
  let seed = 12345;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let extreme = 0;
  for (let round = 0; round < rounds; round += 1) {
    const shuffled = [...all];
    for (let k = shuffled.length - 1; k > 0; k -= 1) {
      const r = Math.floor(random() * (k + 1));
      [shuffled[k], shuffled[r]] = [shuffled[r], shuffled[k]];
    }
    const x = shuffled.slice(0, a.length);
    const y = shuffled.slice(a.length);
    if (Math.abs(meanOf(y) - meanOf(x)) >= observed - 1e-9) extreme += 1;
  }
  return round((extreme + 1) / (rounds + 1), 4);
}

// Two-sided Fisher exact test for the 2×2 table [[a, b], [c, d]].
export function fisherP(a, b, c, d) {
  const n = a + b + c + d;
  const logFactorial = (k) => {
    let sum = 0;
    for (let i = 2; i <= k; i += 1) sum += Math.log(i);
    return sum;
  };
  const probability = (x) => {
    const y = a + b - x;
    const z = a + c - x;
    const w = n - x - y - z;
    if (y < 0 || z < 0 || w < 0) return 0;
    return Math.exp(
      logFactorial(a + b) + logFactorial(c + d) + logFactorial(a + c) + logFactorial(b + d) - logFactorial(n) - logFactorial(x) - logFactorial(y) - logFactorial(z) - logFactorial(w),
    );
  };
  const observed = probability(a);
  let p = 0;
  for (let x = 0; x <= Math.min(a + b, a + c); x += 1) {
    const value = probability(x);
    if (value <= observed + 1e-12) p += value;
  }
  return round(Math.min(1, p), 4);
}

export function signFlipP(diffs) {
  const observed = Math.abs(diffs.reduce((sum, d) => sum + d, 0));
  const n = diffs.length;
  if (observed < 1e-12) return 1;
  let extreme = 0;
  const total = 2 ** n;
  for (let mask = 0; mask < total; mask += 1) {
    let sum = 0;
    for (let k = 0; k < n; k += 1) sum += mask & (1 << k) ? -diffs[k] : diffs[k];
    if (Math.abs(sum) >= observed - 1e-9) extreme += 1;
  }
  return round(extreme / total, 4);
}

export function meanOf(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function round(value, digits = 2) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}
