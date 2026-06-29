import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { demoBootstrap } from '@competitor/contracts';
import { App, reconcileSavedMessage } from './App';

describe('application shell', () => {
  it('renders the four-region community experience', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: 'Spaces' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'campfire' })).toBeInTheDocument();
    expect(screen.getByLabelText('Channel privacy')).toHaveTextContent('Managed conversation');
    expect(screen.getByRole('button', { name: 'Close context panel' })).toBeInTheDocument();
  });

  it('switches channels and explains sealed-mode limits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /backstage/i }));
    expect(screen.getByLabelText('Channel privacy')).toHaveTextContent('Sealed conversation');
    expect(screen.getByText(/reviewed MLS adapter/i)).toBeInTheDocument();
  });

  it('exposes density and theme controls with accessible names', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('Density'), 'compact');
    await user.selectOptions(screen.getByLabelText('Theme'), 'contrast');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.theme).toBe('contrast');
  });

  it('reconciles an optimistic send without duplicating a gateway event', () => {
    const saved = demoBootstrap.messages[0]!;
    const optimistic = { ...saved, id: 'optimistic-1' };

    expect(reconcileSavedMessage([optimistic], optimistic.id, saved)).toEqual([saved]);
    expect(reconcileSavedMessage([optimistic, saved], optimistic.id, saved)).toEqual([saved]);
  });
});
