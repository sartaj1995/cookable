/**
 * Inline SVG icons. Deliberately not an icon package - there are six of them and
 * they all inherit `currentColor`, so a dependency would cost more than it saves.
 * Every icon is decorative here: the meaning is always carried by adjacent text,
 * so they are hidden from screen readers.
 */

interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
})

/** In your kitchen. */
export function IconCheck({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/** Swapped for something else. */
export function IconSwap({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </svg>
  )
}

/** Needed, not there. */
export function IconAlert({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 7v6M12 17h.01" />
    </svg>
  )
}

/** Optional, being left out. */
export function IconSkip({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 12h12" />
    </svg>
  )
}

export function IconClose({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

/** Category expand / collapse. Rotated with CSS when open. */
export function IconChevron({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
