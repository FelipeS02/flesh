import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TRANSFER_RATE_BP } from '@/modules/catalog/client';
import { MARQUEE_REPEATS, PromoMarquee } from '../promo-marquee';

describe('PromoMarquee', () => {
  it('states the transfer discount the pricing policy actually applies', () => {
    render(<PromoMarquee />);

    const percent = TRANSFER_RATE_BP / 100;

    expect(
      screen.getAllByText(`${percent}% off extra transferencias`).length,
    ).toBeGreaterThan(0);
  });

  it('announces the copy once even though the lane is drawn twice', () => {
    const { container } = render(<PromoMarquee />);

    const lanes = container.querySelectorAll('[data-marquee-lane]');

    expect(lanes).toHaveLength(2);
    expect(lanes[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(lanes[1]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('repeats the copy within one lane, so a desktop band is never half empty', () => {
    const { container } = render(<PromoMarquee />);

    const lane = container.querySelector<HTMLElement>('[data-marquee-lane]')!;

    // The seam is a -50% travel across two identical lanes, so ONE lane has
    // to be at least as wide as the viewport or the band runs out of copy
    // before it runs out of screen. A single pass is ~400px: enough for a
    // phone, and about a quarter of a laptop.
    expect(
      within(lane).getAllByText(`${TRANSFER_RATE_BP / 100}% off extra transferencias`),
    ).toHaveLength(MARQUEE_REPEATS);
    expect(MARQUEE_REPEATS).toBeGreaterThan(1);
  });

  it('separates the messages with the FLESH mark rather than with punctuation', () => {
    const { container } = render(<PromoMarquee />);

    const lane = container.querySelector('[data-marquee-lane]');

    expect(lane?.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(lane?.textContent).not.toContain('—');
  });

  it("collapses and fades against the header's own scroll progress", () => {
    const { container } = render(<PromoMarquee />);

    const band = container.querySelector('[data-promo-marquee]');

    // jsdom resolves no `calc()` against a custom property, so the binding
    // itself is what there is to assert — the arithmetic is the browser's.
    expect(band?.className).toContain('--header-scroll-progress');
  });

  it('stops drifting for a visitor who asked for reduced motion', () => {
    const { container } = render(<PromoMarquee />);

    const track = container.querySelector('[data-marquee-track]');

    expect(track?.className).toContain('motion-reduce:animate-none');
  });
});
