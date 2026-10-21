// A small hand-drawn icon set so the app needs no icon library.
const paths = {
  records: <><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M7 5h10M9.5 2.5h5" /></>,
  friends: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" /></>,
  notices: <><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>,
  scores: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  vote: <><path d="M4 13h16v7H4z" /><path d="m8.5 9.5 2.5 2.5 5-5.5" /></>,
  pen: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  install: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  exit: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
}

export type IconName = keyof typeof paths

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
}

// The On Record disc: a vinyl with a volt label and a coral "recording" light.
export function Disc({ size = 36, spinning = true }: { size?: number; spinning?: boolean }) {
  return <svg className={`disc${spinning ? ' spinning' : ''}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="23" fill="#17141f" />
    <circle cx="24" cy="24" r="18.5" fill="none" stroke="#3a3548" strokeWidth="1" />
    <circle cx="24" cy="24" r="15" fill="none" stroke="#3a3548" strokeWidth="1" />
    <path d="M10 17a16 16 0 0 1 9-8" fill="none" stroke="#8d86a3" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="24" cy="24" r="9" fill="#c6f432" />
    <circle cx="24" cy="24" r="2.2" fill="#17141f" />
    <circle cx="30" cy="20" r="2" fill="#ff6a3d" />
  </svg>
}
