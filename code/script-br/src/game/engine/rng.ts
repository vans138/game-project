// 种子随机数生成器：所有概率抽取必须走这里，保证同种子可复现。
// 算法：mulberry32 —— 轻量、分布够用、32 位状态、便于序列化种子。

export interface Rng {
  /** [0,1) 浮点随机 */
  next(): number
  /** 按权重抽取索引；权重全 0 或空数组返回 -1 */
  weightedIndex(weights: number[]): number
  /** 按概率判定（p 落在 [0,1]） */
  chance(p: number): boolean
  /** 当前种子（可用于存档/复现） */
  readonly seed: number
}

/** 由种子创建 RNG（同一 seed 产生同一序列） */
export function createRng(seed: number): Rng {
  // 归一化到 32 位无符号整数，避免外部误传负数/小数导致序列漂移
  let state = (seed >>> 0) || 0x9e3779b9
  const initial = state

  function next(): number {
    // mulberry32
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
      // 浮点边界兜底：返回最后一个正权重项
      for (let i = weights.length - 1; i >= 0; i--) {
        if (weights[i] > 0) return i
      }
      return -1
    },
  }
}

/** 便捷：生成一个随机种子（用于"开新局"时没有指定种子的情况） */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0)
}