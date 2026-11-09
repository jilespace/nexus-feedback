// Landing-only icon set (kept out of the page component so Landing.tsx stays lean.

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function ArrowRightIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

export function ArrowUpRightIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
    </svg>
  );
}

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <path d="m3 8.5 3 3L13 4.5" />
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.88 2.34.67.07-.52.28-.88.51-1.08-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5A2 2 0 0 1 4.5 2.5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.6 2.8a.5.5 0 0 1-.9-.4V12.5h-1a2 2 0 0 1-2-2v-6Z"
        fill="white"
        fillOpacity="0.94"
      />
      <circle cx="6.2" cy="7.5" r="0.9" fill="#3D5AFE" />
      <circle cx="9" cy="7.5" r="0.9" fill="#3D5AFE" />
      <circle cx="11.8" cy="7.5" r="0.9" fill="#3D5AFE" />
    </svg>
  );
}

export function InboxIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 9.5 3.8 3.8A1.5 1.5 0 0 1 5.2 3h5.6a1.5 1.5 0 0 1 1.4.8L14 9.5" />
      <path d="M2 9.5h3.2l.9 1.7h3.8l.9-1.7H14v2.7a1.4 1.4 0 0 1-1.4 1.3H3.4A1.4 1.4 0 0 1 2 12.2V9.5Z" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 13.5v-3M6.2 13.5V7.4M9.8 13.5V9.6M13.5 13.5V4" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2.4 13.2c0-2 1.6-3.4 3.6-3.4s3.6 1.4 3.6 3.4" />
      <path d="M11 4.4a2 2 0 0 1 0 3.6M12 9.9c1.3.3 2.2 1.4 2.2 2.9" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 2 3.5 3.7v3.9c0 2.7 1.8 5 4.5 6.4 2.7-1.4 4.5-3.7 4.5-6.4V3.7L8 2Z" />
      <path d="m5.9 8 1.5 1.5 2.9-3" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...iconProps} width={12} height={12}>
      <rect x="3.2" y="7" width="9.6" height="6" rx="1.4" />
      <path d="M5.3 7V5.4a2.7 2.7 0 0 1 5.4 0V7" />
    </svg>
  );
}

export function DatabaseIcon() {
  return (
    <svg {...iconProps}>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v3.7c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 7.7v3.6c0 1.1 2.2 2 5 2s5-.9 5-2V7.7" />
    </svg>
  );
}

export function TerminalIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2.2" y="3" width="11.6" height="10" rx="1.6" />
      <path d="m5 6.5 2 1.7-2 1.7M8.4 10h2.6" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="5.5" cy="10.5" r="2.6" />
      <path d="m7.4 8.7 5.3-5.3M10.4 5.7l1.6 1.6M12.1 4l1.6 1.6" />
    </svg>
  );
}