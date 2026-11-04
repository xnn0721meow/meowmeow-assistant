import type { Reminder, ReminderAction } from '@shared/focus/types'
import type { StoryChapter } from '@shared/pomodoro/types'

export interface StoryMoment {
  chapter: StoryChapter
  index: number
}

interface SpeechBubbleProps {
  reminder: Reminder | null
  story: StoryMoment | null
  message: string | null
  onAction: (action: ReminderAction) => void
  onDismiss: () => void
}

export function SpeechBubble({
  reminder,
  story,
  message,
  onAction,
  onDismiss
}: SpeechBubbleProps) {
  if (!reminder && !story && !message) return null

  return (
    <div className="speech-bubble interactive" role="status" aria-live="polite">
      <button className="bubble-close" aria-label="关闭提示" onClick={onDismiss}>
        ×
      </button>

      {reminder ? (
        <>
          <div className="bubble-title">{reminder.title}</div>
          <div className="bubble-body">{reminder.body}</div>
          <div className="bubble-actions">
            <button className="bubble-action primary" onClick={() => onAction('returned')}>
              回来了
            </button>
            <button className="bubble-action" onClick={() => onAction('snooze')}>
              再 5 分钟
            </button>
            <button className="bubble-action ghost" onClick={() => onAction('end-session')}>
              今天到这
            </button>
          </div>
        </>
      ) : story ? (
        <>
          <div className="bubble-tag">新的故事 · 第 {story.index} 段</div>
          <div className="bubble-title">{story.chapter.title}</div>
          <div className="bubble-body story-text">{story.chapter.text}</div>
          {message && <div className="bubble-note">{message}</div>}
          <div className="bubble-actions">
            <button className="bubble-action primary" onClick={onDismiss}>
              收下这段故事
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bubble-body">{message}</div>
          <div className="bubble-actions">
            <button className="bubble-action primary" onClick={onDismiss}>
              知道了
            </button>
          </div>
        </>
      )}

      <div className="bubble-tail" aria-hidden="true" />
    </div>
  )
}
