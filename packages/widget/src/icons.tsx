import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function ChatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M21 3L10.5 13.5M21 3l-6.5 18-4-8-8-4z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} strokeWidth={2.4} {...props}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </svg>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="nf-spin" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
    </svg>
  );
}
