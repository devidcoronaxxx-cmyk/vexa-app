export default function LandingStar({ size = 32 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ flexShrink: 0 }}>
      {rays.map(a => (
        <line key={a} x1="20" y1="17.5" x2="20" y2="3.5" stroke="#d97757" strokeWidth="2.7" strokeLinecap="round" transform={`rotate(${a} 20 20)`} />
      ))}
    </svg>
  )
}
