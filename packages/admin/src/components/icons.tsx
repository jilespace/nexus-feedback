import { clsx } from 'clsx';

interface IconProps {
  active?: boolean;
  className?: string;
}

export function DashboardIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="2" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function FeedbackIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <path d="M3 4.5C3 3.67 3.67 3 4.5 3h9c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H7l-3 2.5V13H4.5C3.67 13 3 12.33 3 11.5v-7z" fill="currentColor" opacity="0.7" />
      <circle cx="6.5" cy="8" r="0.75" fill="white" />
      <circle cx="9" cy="8" r="0.75" fill="white" />
      <circle cx="11.5" cy="8" r="0.75" fill="white" />
    </svg>
  );
}

export function AppsIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <rect x="3" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="10" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="3" y="10" width="5" height="5" rx="1" fill="currentColor" opacity="0.5" />
      <circle cx="12.5" cy="12.5" r="2" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function MembersIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <circle cx="7" cy="6" r="2.5" fill="currentColor" opacity="0.8" />
      <path d="M3 14c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="currentColor" opacity="0.5" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" opacity="0.5" />
      <path d="M12 10c1.7 0 3 1.3 3 3" stroke="currentColor" strokeWidth="1.2" opacity="0.4" fill="none" />
    </svg>
  );
}

export function TagsIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <path d="M3 4a1 1 0 011-1h4.586a1 1 0 01.707.293l5.414 5.414a1 1 0 010 1.414l-4.586 4.586a1 1 0 01-1.414 0L3.293 9.293A1 1 0 013 8.586V4z" fill="currentColor" opacity="0.7" />
      <circle cx="6" cy="6" r="1" fill="white" />
    </svg>
  );
}

export function ChangelogNavIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <rect x="3" y="2" width="12" height="14" rx="2" fill="currentColor" opacity="0.7" />
      <path d="M6 6h6M6 9h5M6 12h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <path d="M9 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" fill="currentColor" opacity="0.7" />
      <path d="M14.7 7.1l-.9-.5a5.5 5.5 0 000-1.2l.9-.5a.5.5 0 00.2-.6l-.8-1.4a.5.5 0 00-.6-.2l-.9.5a5.5 5.5 0 00-1-.6V1.5a.5.5 0 00-.5-.5h-1.6a.5.5 0 00-.5.5v1a5.5 5.5 0 00-1 .6l-.9-.5a.5.5 0 00-.6.2l-.8 1.4a.5.5 0 00.2.6l.9.5a5.5 5.5 0 000 1.2l-.9.5a.5.5 0 00-.2.6l.8 1.4a.5.5 0 00.6.2l.9-.5a5.5 5.5 0 001 .6v1a.5.5 0 00.5.5h1.6a.5.5 0 00.5-.5v-1a5.5 5.5 0 001-.6l.9.5a.5.5 0 00.6-.2l.8-1.4a.5.5 0 00-.2-.6z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
    </svg>
  );
}

export function SystemConfigIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <rect x="3" y="4" width="12" height="10" rx="2" fill="currentColor" opacity="0.3" />
      <path d="M6 7h6M6 9.5h4M6 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={clsx('text-gray-400', className)}>
      <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M10.5 11.5L14 8l-3.5-3.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13.5 8.5a5.5 5.5 0 01-7.5-5c0-.5 0-1 .1-1.5A5.5 5.5 0 108 14a5.5 5.5 0 005.5-5.5z" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={clsx('text-gray-400', className)}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 4L6 8l4 4" />
    </svg>
  );
}

// Stat card icons
export function AuditLogsIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={clsx(active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', className)}>
      <path d="M3 4h12M3 9h12M3 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ResponseTimeIcon({ active, className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={clsx('shrink-0', active ? 'text-brand-600 dark:text-brand-400' : undefined, className)}>
      <path d="M10 4.2a5.8 5.8 0 1 1-5.6 7.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.4 7.6 4.6 11l3.2-1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 7v3.2l2 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TotalIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={clsx('shrink-0', className)}>
      <path d="M3.5 6.6 10 3.2l6.5 3.4L10 10 3.5 6.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m3.5 10.4 6.5 3.4 6.5-3.4M3.5 14.1l6.5 3.4 6.5-3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OpenIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={clsx('shrink-0', className)}>
      <path d="M3.2 11.5V7.2A2.2 2.2 0 0 1 5.4 5h9.2a2.2 2.2 0 0 1 2.2 2.2v4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m3.2 11.5 1.9 3.6h9.8l1.9-3.6M8 11.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProgressIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={clsx('shrink-0', className)}>
      <circle cx="10" cy="10" r="6.8" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
      <path d="M10 3.2a6.8 6.8 0 0 1 6.8 6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 6.6V10l2.4 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResolvedIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={clsx('shrink-0', className)}>
      <circle cx="10" cy="10" r="6.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7 10.2 2 2 4-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClosedIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className={clsx('shrink-0', className)}>
      <circle cx="10" cy="10" r="6.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7.6 7.6 4.8 4.8M12.4 7.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function HelpIcon({ className }: IconProps) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      className={clsx('shrink-0 text-gray-400 dark:text-gray-500', className)}
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.1 7.9a1.95 1.95 0 013.8.7c0 1.35-1.9 1.65-1.9 3.05"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.2" r="0.95" fill="currentColor" />
    </svg>
  );
}
