import type { Condition, Effect, PlayerState, RunState, Script, RosterSave } from './types';
import { AFFINITY_CAP } from './script';

// ===== 纯逻辑引擎：条件求值、效果结算、结局判定 =====

// 条件是否满足
export function checkCondition(cond: Condition | undefined, p: PlayerState): boolean {
  if (!cond) return true;
  if (cond.hasIdentity && p.identity !== cond.hasIdentity) return false;
  if (cond.affinityAtLeast) {
    const [npc, v] = cond.affinityAtLeast;
    if ((p.affinity[npc] ?? 0) < v) return false;
  }
  if (cond.flag && !p.flags.includes(cond.flag)) return false;
  return true;
}

// 应用单条效果到玩家状态（返回新状态引用，便于日志）
export function applyEffect(p: PlayerState, e: Effect): string {
  switch (e.type) {
    case 'affinity': {
      const cur = p.affinity[e.npc] ?? 0;
      p.affinity[e.npc] = Math.max(0, cur + e.value);
      return `好感 ${e.npc} ${e.value >= 0 ? '+' : ''}${e.value}`;
    }
    case 'flag':
      if (!p.flags.includes(e.name)) p.flags.push(e.name);
      return `记录：${e.name}`;
    case 'goalProgress':
      p.goalProgress += e.value;
      return `私人目标 +${e.value}`;
    case 'unlock':
      if (!p.unlocked.includes(e.id)) p.unlocked.push(e.id);
      return `解锁：${e.id}`;
    case 'worldShift':
      return `世界变化 → ${e.scene}`;
    default:
      return '';
  }
}

// 好感总封顶裁剪（结算/带出时用）：超出总和则按比例裁剪
export function clampAffinity(affinity: Record<string, number>): Record<string, number> {
  const total = Object.values(affinity).reduce((a, b) => a + b, 0);
  if (total <= AFFINITY_CAP) return { ...affinity };
  const ratio = AFFINITY_CAP / total;
  const out: Record<string, number> = {};
  for (const k in affinity) out[k] = Math.floor(affinity[k] * ratio);
  return out;
}

// 结局判定：综合 私人目标进度 + 好感总和 + 解锁数
export function judgeEnding(p: PlayerState): string {
  const aff = Object.values(p.affinity).reduce((a, b) => a + b, 0);
  if (p.goalProgress >= 6) return '真相追寻者：你揭开了轮回的一角。';
  if (aff >= 8) return '羁绊之人：你与他们的关系，穿越了轮回。';
  if (p.unlocked.length > 0) return '觉醒者：你触碰了隐藏的血脉。';
  return '平凡毕业：三年匆匆，你没有留下太多。';
}

// 生成局外带出（轮回存档）：唯一身份 + 好感(裁剪) + 解锁
export function createRosterSave(p: PlayerState, runIndex: number): RosterSave {
  return {
    runIndex,
    identity: p.identity,
    affinity: clampAffinity(p.affinity),
    unlocked: [...p.unlocked],
  };
}