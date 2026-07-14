import { initials } from '../lib/format'

type Props = {
  name: string
  color: string
  size?: number
}

export default function Avatar({ name, color, size = 44 }: Props) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
