import React from 'react';

export interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width, height, className = '' }: SkeletonProps) {
  const style: React.CSSProperties = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      data-testid="skeleton"
    />
  );
}

export default Skeleton;
