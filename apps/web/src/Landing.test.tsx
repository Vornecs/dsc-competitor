import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Landing from './Landing';

describe('Landing', () => {
  it('renders all layout elements correctly', () => {
    const handleSignIn = vi.fn();
    render(<Landing onSignIn={handleSignIn} />);

    // Nav elements
    expect(screen.getByRole('heading', { level: 1, name: 'Cove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();

    // Hero elements
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your space. Your friends.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Private voice and text communities, no ads, no algorithms, no noise.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Early Access →' })).toBeInTheDocument();

    // Features
    expect(screen.getByRole('heading', { level: 3, name: 'Voice that works' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Low-latency spatial audio that makes you feel like you are in the same room.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 3, name: 'Spaces that feel like yours' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Organize your discussions with customizable channels and flexible permissions.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 3, name: 'Privacy by default' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No advertising, no data-mining, and no algorithmic feeds to distract you.'),
    ).toBeInTheDocument();

    // Footer
    expect(screen.getByText('Built for friends, not engagement.')).toBeInTheDocument();
  });

  it('calls onSignIn when buttons are clicked', () => {
    const handleSignIn = vi.fn();
    render(<Landing onSignIn={handleSignIn} />);

    // Click Sign In button in nav
    const signInBtn = screen.getByRole('button', { name: 'Sign In' });
    fireEvent.click(signInBtn);
    expect(handleSignIn).toHaveBeenCalledTimes(1);

    // Click Get Early Access button in hero
    const getAccessBtn = screen.getByRole('button', { name: 'Get Early Access →' });
    fireEvent.click(getAccessBtn);
    expect(handleSignIn).toHaveBeenCalledTimes(2);
  });
});
