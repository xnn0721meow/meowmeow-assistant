import type { FocusState } from '@shared/focus/types'

interface MascotProps {
  state: FocusState
  cameraUnavailable?: boolean
}

export function Mascot({ state, cameraUnavailable = false }: MascotProps) {
  const away = state === 'away'
  const distracted = state === 'distracted'
  const paused = state === 'paused'

  return (
    <svg
      className="mascot-svg"
      viewBox="0 0 200 200"
      role="img"
      aria-label={`学习伴侣状态：${state}`}
    >
      <ellipse cx="100" cy="184" rx="54" ry="7" className="mascot-shadow" />

      <g className="mascot-tail">
        <path
          d="M158 132 C182 124 194 140 180 156 C172 165 160 162 156 152 C162 158 170 156 172 149 C176 142 170 136 158 140 Z"
          className="mascot-body-fill"
        />
      </g>

      <g className="mascot-ears">
        <path d="M62 66 C54 46 58 32 70 24 C80 34 88 48 91 60 Z" className="mascot-body-fill" />
        <path d="M70 48 C67 40 68 35 72 31 C76 37 79 42 80 49 Z" className="mascot-ear-inner" />
        <path d="M138 66 C146 46 142 32 130 24 C120 34 112 48 109 60 Z" className="mascot-body-fill" />
        <path d="M130 48 C133 40 132 35 128 31 C124 37 121 42 120 49 Z" className="mascot-ear-inner" />
      </g>

      <g className="mascot-body">
        <path
          d="M100 42 C142 42 166 72 164 112 C162 152 136 174 100 174 C64 174 38 152 36 112 C34 72 58 42 100 42 Z"
          className="mascot-body-fill"
        />
        <ellipse cx="100" cy="148" rx="38" ry="24" className="mascot-belly" />

        <g className="mascot-sprout">
          <path d="M100 42 C100 30 100 24 100 18" className="mascot-stem" />
          <path d="M100 28 C90 28 84 22 84 15 C94 15 100 20 100 28 Z" className="mascot-leaf" />
          <path d="M100 22 C109 22 116 16 116 9 C106 9 100 14 100 22 Z" className="mascot-leaf" />
        </g>

        <ellipse cx="58" cy="120" rx="9" ry="5" className="mascot-cheek" />
        <ellipse cx="142" cy="120" rx="9" ry="5" className="mascot-cheek" />

        {away ? (
          <g className="mascot-eyes">
            <path d="M68 106 Q78 114 88 106" className="mascot-eye-line" />
            <path d="M112 106 Q122 114 132 106" className="mascot-eye-line" />
          </g>
        ) : paused ? (
          <g className="mascot-eyes">
            <path d="M68 108 Q78 102 88 108" className="mascot-eye-line" />
            <path d="M112 108 Q122 102 132 108" className="mascot-eye-line" />
          </g>
        ) : (
          <g className="mascot-eyes">
            <ellipse cx="78" cy="105" rx="6.5" ry="9.5" className="mascot-eye" />
            <ellipse cx="122" cy="105" rx="6.5" ry="9.5" className="mascot-eye" />
            <circle cx="80" cy="101" r="2.2" className="mascot-eye-highlight" />
            <circle cx="124" cy="101" r="2.2" className="mascot-eye-highlight" />
          </g>
        )}

        {distracted ? (
          <path d="M88 130 Q95 122 101 130 T114 130" className="mascot-mouth" />
        ) : away ? (
          <ellipse cx="100" cy="131" rx="5" ry="6" className="mascot-mouth-fill" />
        ) : paused ? (
          <path d="M92 131 L108 131" className="mascot-mouth" />
        ) : (
          <path d="M88 127 Q100 138 112 127" className="mascot-mouth" />
        )}

        {distracted && (
          <g className="mascot-sweat">
            <path d="M151 91 C151 91 145 99 145 104 C145 109 150 111 153 108 C157 104 153 96 151 91 Z" />
          </g>
        )}

        {cameraUnavailable && (
          <g className="mascot-camera-badge">
            <circle cx="160" cy="64" r="10" />
            <path d="M155 59 L165 69 M165 59 L155 69" />
          </g>
        )}
      </g>

      {away && (
        <g className="mascot-zzz">
          <text x="150" y="58">z</text>
          <text x="162" y="44" className="mascot-zzz-small">z</text>
        </g>
      )}
    </svg>
  )
}
