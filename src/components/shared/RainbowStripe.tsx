const COLORS = [
  '#E5187A', // pink
  '#8E2882', // purple
  '#1B4F9E', // blue
  '#1FA1D6', // cyan
  '#0F8F4D', // green
  '#F4D31E', // yellow
  '#EE7C24', // orange
  '#D9211E', // red
]

export function RainbowStripe({ height = 4 }: { height?: number }) {
  return (
    <div className="flex w-full" style={{ height: `${height}px` }}>
      {COLORS.map((color, i) => (
        <div key={i} style={{ background: color, flex: 1 }} />
      ))}
    </div>
  )
}
