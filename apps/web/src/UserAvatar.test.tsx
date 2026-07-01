import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UserAvatar from './UserAvatar';

describe('UserAvatar', () => {
  it('renders image when src is provided', () => {
    render(<UserAvatar src="https://example.com/avatar.png" name="Alice" />);
    const img = screen.getByRole('img', { name: 'Alice' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('renders initials when src is not provided', () => {
    render(<UserAvatar name="Bob" />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('handles name initials correctly for spaces and lowercase names', () => {
    render(<UserAvatar name=" charlie " />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { rerender } = render(<UserAvatar name="Alice" size="sm" />);
    expect(screen.getByLabelText("Alice's avatar")).toHaveClass('user-avatar--sm');

    rerender(<UserAvatar name="Alice" size="md" />);
    expect(screen.getByLabelText("Alice's avatar")).toHaveClass('user-avatar--md');

    rerender(<UserAvatar name="Alice" size="lg" />);
    expect(screen.getByLabelText("Alice's avatar")).toHaveClass('user-avatar--lg');
  });

  it('renders status dot when status is provided', () => {
    render(<UserAvatar name="Alice" status="online" />);
    const statusDot = screen.getByRole('status', { name: 'online' });
    expect(statusDot).toBeInTheDocument();
    expect(statusDot).toHaveClass('user-avatar-status--online');
  });
});
