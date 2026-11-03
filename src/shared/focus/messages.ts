import type { ActivitySignal, FocusEvidence, FocusState, Reminder, ReminderAction } from './types'

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  if (totalMinutes > 0) return `${totalMinutes} 分钟`
  return `${Math.floor(ms / 1000)} 秒`
}

export function buildReminder(
  reason: Reminder['reason'],
  evidence: FocusEvidence,
  appName: string | null,
  windowTitle: string | null
): Reminder {
  const appLabel = appName?.replace(/\.exe$/i, '') ?? windowTitle?.slice(0, 32) ?? '这个窗口'
  const minutes = evidence.gazeAwayMs ? Math.max(1, Math.round(evidence.gazeAwayMs / 60_000)) : 0

  switch (reason) {
    case 'blocked-app':
      return {
        reason,
        title: '注意力跑偏了',
        body: `你在「${appLabel}」已经停留了一会儿。要回来继续吗？`,
        evidence
      }
    case 'gaze-away':
      return {
        reason,
        title: '视线离开屏幕',
        body: minutes > 0 ? `目光离开屏幕约 ${minutes} 分钟了，还在学吗？` : '目光离开屏幕了，还在学吗？',
        evidence
      }
    case 'idle':
      return {
        reason,
        title: '好像停下来了',
        body: '键盘和鼠标都安静了一会儿。是在看书，还是卡住了？',
        evidence
      }
    case 'no-face':
      return {
        reason,
        title: '你离开了',
        body: '计时先暂停，回来我们再继续。',
        evidence
      }
    default:
      return {
        reason,
        title: '还在学习吗',
        body: '需要我帮你把注意力拉回来吗？',
        evidence
      }
  }
}

export function buildReturnedMessage(focusedMs: number): string {
  const total = formatDuration(focusedMs)
  return total === '0 秒' ? '欢迎回来，我们继续。' : `欢迎回来，已经累计专注 ${total}。`
}

export function buildAwayMessage(): string {
  return '你离开了，计时先暂停。回来我会继续陪你。'
}

export function buildStartMessage(): string {
  return '学习模式已开始。先定一个小目标，我会安静陪着你。'
}

export function reminderActionsFor(action: ReminderAction): ReminderAction {
  return action
}

export function activityEvidence(activity: ActivitySignal): FocusEvidence {
  return {
    appName: activity.appName,
    windowTitle: activity.windowTitle,
    idleSeconds: activity.idleSeconds
  }
}

export function stateLabel(state: FocusState): string {
  switch (state) {
    case 'focused':
      return '专注中'
    case 'distracted':
      return '有点分心'
    case 'away':
      return '离开了'
    case 'paused':
      return '已暂停'
    default:
      return '准备中'
  }
}
