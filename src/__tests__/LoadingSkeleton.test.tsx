import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders session type without crashing', () => {
    const { container } = render(<LoadingSkeleton type="session" />);
    expect(container).toBeTruthy();
    expect(container.querySelector('.skeleton-session')).toBeTruthy();
  });

  it('renders dag type without crashing', () => {
    const { container } = render(<LoadingSkeleton type="dag" />);
    expect(container).toBeTruthy();
    expect(container.querySelector('.skeleton-dag')).toBeTruthy();
  });

  it('session skeleton renders multiple items', () => {
    const { container } = render(<LoadingSkeleton type="session" />);
    const items = container.querySelectorAll('.skeleton-session__item');
    expect(items.length).toBe(5); // [80, 65, 75, 60, 70]
  });

  it('dag skeleton renders agent node', () => {
    const { container } = render(<LoadingSkeleton type="dag" />);
    expect(container.querySelector('.skeleton-dag__agent')).toBeTruthy();
  });

  it('dag skeleton renders chains', () => {
    const { container } = render(<LoadingSkeleton type="dag" />);
    const chains = container.querySelectorAll('.skeleton-dag__chain');
    expect(chains.length).toBe(2);
  });
});
