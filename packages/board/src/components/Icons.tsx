import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function StrokeIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 4.5 18.5 13h-13L12 4.5Z" fill="currentColor" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </StrokeIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </StrokeIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="m15.8 15.8 4 4" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </StrokeIcon>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.63-.31-3.76-.87L4 21l1.37-4.24A8.5 8.5 0 1 1 20.5 12Z" />
    </StrokeIcon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 1.75" />
    </StrokeIcon>
  );
}

export function TrendingUpIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M3.5 16.5 9 11l4 4 7.5-8.5" />
      <path d="M15.25 6.5H20.5V12" />
    </StrokeIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </StrokeIcon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.75v5" />
      <path d="M12 16.25h.01" />
    </StrokeIcon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2M12 19.25v2M4.75 12h-2M21.25 12h-2M5.9 5.9 4.5 4.5M19.5 19.5l-1.4-1.4M18.1 5.9l1.4-1.4M4.5 19.5l1.4-1.4" />
    </StrokeIcon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M20 13.5A8.25 8.25 0 0 1 10.5 4a8.25 8.25 0 1 0 9.5 9.5Z" />
    </StrokeIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M3.9 9.5h16.2M3.9 14.5h16.2" />
      <path d="M12 3.75c-4.5 4.6-4.5 11.9 0 16.5 4.5-4.6 4.5-11.9 0-16.5Z" />
    </StrokeIcon>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M4 14.5h4.1l1.2 2.25h5.4l1.2-2.25H20" />
      <path d="M4 14.5V7.25A2.25 2.25 0 0 1 6.25 5h11.5A2.25 2.25 0 0 1 20 7.25v7.25m0 0v2A2.25 2.25 0 0 1 17.75 19H6.25A2.25 2.25 0 0 1 4 16.5v-2Z" />
    </StrokeIcon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Z" />
      <path d="m4.5 12.5 7.5 4 7.5-4" />
      <path d="m4.5 16.5 7.5 4 7.5-4" />
    </StrokeIcon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1 12 3.5Z" />
      <path d="M18.5 4v3M17 5.5h3" />
    </StrokeIcon>
  );
}

export function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <StrokeIcon className={className ? `animate-spin ${className}` : 'animate-spin'} {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </StrokeIcon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M4 4h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-4.9 4.9a1.5 1.5 0 0 1-2.1 0L4 11.2V4Z" />
      <path d="M8 8h.01" />
    </StrokeIcon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="17.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="m8.75 10.75 6.5-3.5M8.75 13.25l6.5 3.5" />
    </StrokeIcon>
  );
}
