import { describe, it, expect } from 'vitest';

function getItemScale(hoveredIndex: number | null, itemIndex: number): number {
  if (hoveredIndex === null) return 1;
  const distance = Math.abs(itemIndex - hoveredIndex);
  if (distance === 0) return 1.3;
  if (distance === 1) return 1.15;
  if (distance === 2) return 1.05;
  return 1;
}

describe('getItemScale', () => {
  it('returns 1 for all items when nothing is hovered', () => {
    expect(getItemScale(null, 0)).toBe(1);
    expect(getItemScale(null, 5)).toBe(1);
  });

  it('returns 1.3 for the hovered item itself', () => {
    expect(getItemScale(3, 3)).toBe(1.3);
  });

  it('returns 1.15 for adjacent items (distance 1)', () => {
    expect(getItemScale(3, 2)).toBe(1.15);
    expect(getItemScale(3, 4)).toBe(1.15);
  });

  it('returns 1.05 for items at distance 2', () => {
    expect(getItemScale(3, 1)).toBe(1.05);
    expect(getItemScale(3, 5)).toBe(1.05);
  });

  it('returns 1 for items at distance 3+', () => {
    expect(getItemScale(3, 0)).toBe(1);
    expect(getItemScale(3, 6)).toBe(1);
  });
});
