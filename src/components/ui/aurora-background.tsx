import type { HTMLAttributes } from 'react';

type AuroraBackgroundProps = HTMLAttributes<HTMLDivElement> & {
  showRadialGradient?: boolean;
};

export function AuroraBackground({
  className = '',
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`aurora-background${showRadialGradient ? ' aurora-background-radial' : ''}${
        className ? ` ${className}` : ''
      }`}
      {...props}
    >
      <div className="aurora-background__beam" />
    </div>
  );
}
