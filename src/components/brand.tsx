export function AtlasMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <ellipse
        cx="24"
        cy="24"
        rx="17"
        ry="9"
        transform="rotate(-40 24 24)"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <ellipse
        cx="24"
        cy="24"
        rx="17"
        ry="9"
        transform="rotate(40 24 24)"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="24" cy="24" r="4.5" fill="currentColor" />
      <circle
        cx="39"
        cy="16"
        r="3"
        fill="currentColor"
        stroke="var(--color-surface)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
import type { SVGProps } from 'react';
export function Github({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.32c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}
