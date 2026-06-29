import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = '', ...props }: IconButtonProps) {
  return (
    <button
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Avatar({
  initials,
  status,
  size = 'medium',
}: {
  initials: string;
  status?: string;
  size?: 'small' | 'medium' | 'large';
}) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      <span>{initials}</span>
      {status && <i className={`presence presence--${status}`} />}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'good' | 'quiet' | 'warning';
  children: ReactNode;
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
