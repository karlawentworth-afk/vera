interface VeraLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showChameleon?: boolean
}

const SIZES = {
  sm: { text: 'text-xl', dot: 'w-2 h-2', chameleon: 24 },
  md: { text: 'text-2xl', dot: 'w-2.5 h-2.5', chameleon: 32 },
  lg: { text: 'text-4xl', dot: 'w-4 h-4', chameleon: 40 },
}

export function VeraLogo({ size = 'md', showChameleon = true }: VeraLogoProps) {
  const s = SIZES[size]
  return (
    <div className="flex items-center gap-2">
      {showChameleon && (
        <img
          src="/chameleon.png"
          alt=""
          style={{ height: `${s.chameleon}px`, width: 'auto' }}
        />
      )}
      <div className="flex gap-0.5">
        <div className={`${s.dot} rounded-full bg-vera-pink`} />
        <div className={`${s.dot} rounded-full bg-vera-cyan`} />
        <div className={`${s.dot} rounded-full bg-vera-green`} />
        <div className={`${s.dot} rounded-full bg-vera-yellow`} />
      </div>
      <span className={`${s.text} font-light tracking-tight text-gray-900`}>vera</span>
    </div>
  )
}
