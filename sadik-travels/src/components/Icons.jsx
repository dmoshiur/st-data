/**
 * Inline SVG icon set.
 *
 * Emoji icons render differently on every OS and look unprofessional in an
 * admin tool, so every glyph here is a stroke-based vector that inherits
 * `currentColor` — one code path, identical everywhere.
 */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
}

export function Icon({ name, size = 18, className = '', ...rest }) {
  const P = PATHS[name] || PATHS.dot
  return (
    <svg {...base} width={size} height={size} className={`icon ${className}`} {...rest}>
      {P}
    </svg>
  )
}

const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  funders: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6.2" />
      <path d="M17.5 14.6A5.5 5.5 0 0 1 21 20" />
    </>
  ),
  donations: (
    <>
      <path d="M12 20.5s-7.5-4.3-7.5-9.4A4.1 4.1 0 0 1 12 8.6a4.1 4.1 0 0 1 7.5 2.5c0 5.1-7.5 9.4-7.5 9.4Z" />
    </>
  ),
  admins: (
    <>
      <path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.6 7 9.4 4.1-1.8 7-5.2 7-9.4V6l-7-2.8Z" />
      <path d="m9.4 12.1 1.9 1.9 3.4-3.6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13" />
      <path d="M5.5 12h13" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8V20Z" />
      <path d="m13.6 6.6 3.8 3.8" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
      <path d="M10.3 10v7M13.7 10v7" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  chevronLeft: <path d="m14.5 5-7 7 7 7" />,
  chevronRight: <path d="m9.5 5 7 7-7 7" />,
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5Z" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4.5h3.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10.5 8 6.5 12l4 4" />
      <path d="M6.5 12H16" />
    </>
  ),
  cloud: (
    <>
      <path d="M7.5 18.5h9.8a3.7 3.7 0 0 0 .3-7.4 5.3 5.3 0 0 0-10.2-1.3 3.9 3.9 0 0 0 .1 8.7Z" />
    </>
  ),
  cloudOff: (
    <>
      <path d="M7.5 18.5h9.8a3.7 3.7 0 0 0 2-6.8" />
      <path d="M15.2 6.6a5.3 5.3 0 0 0-7.8 4.2" />
      <path d="M4.2 11.9a3.9 3.9 0 0 0 1.6 6.4" />
      <path d="m4 4 16 16" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.6 2.9 20h18.2L12 4.6Z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V4h10v5" />
      <path d="M7 18H5.5A1.5 1.5 0 0 1 4 16.5V11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5.5A1.5 1.5 0 0 1 18.5 18H17" />
      <rect x="7" y="14" width="10" height="6.5" rx="1" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 7 8.2 6 8.2-6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="3.5" />
      <path d="m10.6 11.6 8-8" />
      <path d="m15.6 6.6 2.4 2.4" />
      <path d="m18 4.2 2.4 2.4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5a8 8 0 1 0-1.9 6.1" />
      <path d="M20 5.5v6h-6" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3.5" />,
}
