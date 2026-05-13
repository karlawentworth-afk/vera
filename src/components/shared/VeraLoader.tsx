const RAINBOW = ['#E5187A', '#8E2882', '#1B4F9E', '#1FA1D6', '#0F8F4D', '#F4D31E', '#EE7C24', '#D9211E']
const DOTS = ['#E5187A', '#1FA1D6', '#0F8F4D', '#F4D31E']

const SIZES = { sm: 24, md: 48, lg: 96 }

interface VeraLoaderProps {
  variant?: 'ring' | 'dots'
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function VeraLoader({ variant = 'ring', size = 'md', text }: VeraLoaderProps) {
  const px = SIZES[size]

  if (variant === 'dots') {
    const dotSize = px / 4
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1" style={{ height: dotSize }}>
          {DOTS.map((color, i) => (
            <div
              key={i}
              className="rounded-full vera-dot-pulse"
              style={{
                width: dotSize,
                height: dotSize,
                background: color,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        {text && <p className="text-xs text-gray-400">{text}</p>}
        <style>{`
          @keyframes veraDotPulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          .vera-dot-pulse {
            animation: veraDotPulse 1.2s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .vera-dot-pulse { animation: none; opacity: 0.7; transform: none; }
          }
        `}</style>
      </div>
    )
  }

  // Ring variant
  const strokeWidth = px / 12
  const radius = (px - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const segmentLength = circumference / RAINBOW.length

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={px}
        height={px}
        className="vera-ring-spin"
        style={{ animationDuration: '1.5s' }}
      >
        {RAINBOW.map((color, i) => {
          const offset = circumference - (i * segmentLength)
          return (
            <circle
              key={i}
              cx={px / 2}
              cy={px / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength * 0.85} ${circumference - segmentLength * 0.85}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      {text && <p className="text-xs text-gray-400">{text}</p>}
      <style>{`
        @keyframes veraRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .vera-ring-spin {
          animation: veraRingSpin 1.5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vera-ring-spin { animation: none; }
        }
      `}</style>
    </div>
  )
}
