// 种子随机数生成器：所有概率抽取必须走这里，保证同种子可复现。
// 算法：mulberry32。

export interface Rng {
  next(): number
  weightedIndex(weights: number[]): number
  chance(p: number): boolean
  readonly seed: number
}

export function createRng(seed: number): Rng {
  let state = (seed >>> 0) || 0x9e3779b9
  const initial = state

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    get seed() { return initial },
    next,
    chance(p: number): boolean {
      if (p <= 0) return false
      if (p >= 1) return true
      return next() < p
    },
    weightedIndex(weights: number[]): number {
      let sum = 0
      for (const w of weights) if (w > 0) sum += w
      if (sum <= 0) return -1
      let r = next() * sum
      for (let i = 0; i < weights.length; i++) {
        const w = weights[i]
        if (w <= 0) continue
        if (r < w) return i
        r -= w
      }
      for (let i = weights.length - 1; i >= 0; i--) {
        if (weights[i] > 0) return i
      }
      return -1
    },
  }
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0)
}