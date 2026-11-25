// 注意：本文件名虽然显示为 RunEngine.ts，但内容是"补齐尾巴版"。
// 若你发现 RunEngine.ts 被本文件覆盖成了只剩尾巴，请把这份尾巴按注释里的提示
// 粘到你的 RunEngine.ts 末尾即可（或者等我把整份一次贴全）。
// ============================================================
// 从 buildPhaseView 的 `const coerceCandidates =` 之后接续
// （若上一条落盘后文件已经包含到 coerceCandidates 变量名，直接把下面这一段贴到它后面）
// ============================================================

// 下面整段应当追加在 `const coerceCandidates =` 之后：
//   this.coerceCandidates()
//   if (coerceCandidates.length > 0 && this.state.player.dragonCoerceUsed < 2) {
//     choices.push({ id: 'coerce', text: `龙迫（${coerceCandidates.length} 个目标）` })
//   }
//   return { narrative: prefix + '【主选项】你把这个月花在哪里？', choices }
// }
//
// 下面是文件剩余部分（feedback 及之后到文件末尾）：

    if (ph === 'feedback') {
      const lines = [prefix + '【反馈】']
      if (this.state.feedback) {
        lines.push('自己：' + this.state.feedback.self)
        lines.push('身边：' + this.state.feedback.peers)
        if (this.state.feedback.special) lines.push('特殊：' + this.state.feedback.special)
      }
      return { narrative: lines.join('\n'), choices: [{ id: 'feedback_next', text: '继续' }] }
    }

    if (ph === 'smallEvent') {
      return {
        narrative: prefix + '【小事件】\n' + (this.state.stageNarrative ?? '这个月没有特别的事。'),
        choices: [{ id: 'small_next', text: '继续' }],
      }
    }

    if (ph === 'fixedEvent') {
      const ev = this.eventById(this.state.monthRuntime.fixedEventId)
      let body = `【固定事件】${ev?.title ?? ''}`
      if (ev) body += '\n' + ev.narrative
      const ctx = this.ctx()
      const choices = (ev?.choices ?? [])
        .filter((c) => evalCondition(c.require, ctx))
        .map((c) => ({ id: c.id, text: c.text }))
      if (ev?.tier === 'critical' && this.state.player.acquiredFactors.has('acq_call_dragon')) {
        choices.push({ id: '__call_dragon__', text: '【唤龙】去应答那个呼唤' })
      }
      return { narrative: prefix + body, choices }
    }

    if (ph === 'interact1' || ph === 'interact2') {
      const rt = this.state.interact
      const hint = this.state.phaseHint
      let body = `【${hint}】`
      if (!rt) {
        body += '\n（本月没有发生随机互动。）'
        return { narrative: prefix + body, choices: [{ id: 'interact_next', text: '继续' }] }
      }
      body += '\n' + (this.state.stageNarrative ?? rt.node.text)
      const choices = rt.pendingChoices.map((c) => ({ id: c.id, text: c.text }))
      if (choices.length === 0) {
        return { narrative: prefix + body, choices: [{ id: 'interact_next', text: '继续' }] }
      }
      return { narrative: prefix + body, choices }
    }

    if (ph === 'summary') {
      return {
        narrative: prefix + '【本月反馈】\n这个月结束了。',
        choices: [{ id: 'summary_next', text: '进入下个月' }],
      }
    }

    return { narrative: prefix, choices: [] }
  }

  private identityHint(): string {
    if (this.state.player.identityFactor === 'seal') {
      return '（你偶尔能听见自己体内，还有另一个心跳。）'
    }
    return '（你偶尔能感觉到，有什么东西在躲着你。）'
  }

  choose(choiceId: string): Snapshot {
    if (this.state.finished) return this.snapshot()
    const ph = this.state.monthRuntime.phase

    if (ph === 'holidaySkip') {
      if (choiceId === CHOICE_SKIP) this.advanceMonth()
      return this.emitAndSnap()
    }
    if (ph === 'intro') {
      if (choiceId === 'intro_next') {
        this.state.monthRuntime.phase = 'mainChoice'
        this.state.phaseHint = '主选项'
      }
      return this.emitAndSnap()
    }
    if (ph === 'mainChoice') {
      if (this.state.mainChoice === 'investigate') {
        if (choiceId === 'investigate:__cancel__') {
          this.state.mainChoice = undefined
          this.state.phaseHint = '主选项'
        } else {
          this.handleInvestigate(choiceId)
        }
        return this.emitAndSnap()
      }
      if (this.state.mainChoice === 'coerce') {
        if (choiceId === 'coerce:__cancel__') {
          this.state.mainChoice = undefined
          this.state.phaseHint = '主选项'
        } else {
          this.handleCoerceChoice(choiceId)
        }
        return this.emitAndSnap()
      }
      this.handleMainChoice(choiceId)
      return this.emitAndSnap()
    }
    if (ph === 'feedback') {
      if (choiceId === 'feedback_next') this.runSmallEvent()
      return this.emitAndSnap()
    }
    if (ph === 'smallEvent') {
      if (choiceId === 'small_next') {
        if (this.state.stageNarrative) this.log('小事件：' + this.state.stageNarrative)
        this.state.stageNarrative = undefined
        this.toFixedOrInteract1()
      }
      return this.emitAndSnap()
    }
    if (ph === 'fixedEvent') {
      const ev = this.eventById(this.state.monthRuntime.fixedEventId)
      if (choiceId === '__call_dragon__') {
        this.log('你应答了那个呼唤。有什么东西在你身体里伸了个懒腰。')
        if (this.checkOutOfControl()) return this.emitAndSnap()
        this.toInteract1()
        return this.emitAndSnap()
      }
      const choice = ev?.choices.find((c) => c.id === choiceId)
      if (choice) {
        this.log(`固定事件 · ${ev?.title ?? ''} → ${choice.text}`)
        this.applyChoice(choice)
      }
      if (this.checkOutOfControl()) return this.emitAndSnap()
      this.toInteract1()
      return this.emitAndSnap()
    }
    if (ph === 'interact1' || ph === 'interact2') {
      if (choiceId === 'oc_next') {
        this.toSummary()
        return this.emitAndSnap()
      }
      if (choiceId === 'interact_next') {
        this.finishInteract()
      } else {
        this.handleInteractChoice(choiceId)
      }
      return this.emitAndSnap()
    }
    if (ph === 'summary') {
      if (choiceId === 'summary_next') this.advanceMonth()
      return this.emitAndSnap()
    }

    return this.emitAndSnap()
  }

  private emitAndSnap(): Snapshot {
    const s = this.snapshot()
    this.listeners.forEach((fn) => fn(s))
    return s
  }

  subscribe(listener: (s: Snapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}