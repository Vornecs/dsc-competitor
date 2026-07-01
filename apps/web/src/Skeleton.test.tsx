import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('renders a skeleton element with default classes', () => {
    render(<Skeleton />);
    const element = screen.getByTestId('skeleton');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('skeleton');
  });

  it('applies custom dimensions via inline styles', () => {
    render(<Skeleton width="100px" height="20px" />);
    const element = screen.getByTestId('skeleton');
    expect(element).toHaveStyle({
      width: '100px',
      height: '20px',
    });
  });

  it('merges custom class names', () => {
    render(<Skeleton className="custom-class" />);
    const element = screen.getByTestId('skeleton');
    expect(element).toHaveClass('skeleton');
    expect(element).toHaveClass('custom-class');
  });
});
