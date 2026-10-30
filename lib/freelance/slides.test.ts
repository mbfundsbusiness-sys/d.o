import { describe, expect, it } from 'vitest';
import { docHtmlToSlides, docTextToSlides, tidyTitle } from '@/lib/freelance/slides';

const TEXT = `Omors Mentorship

Chapter 1
Lesson 1- Intro to price algo
Price is delivered through algorithm.
• Bank of England-GBP
• Federal Reserve- USD
The market seeks liquidity.

Weekly Commentary 1-
Try to avoid trading Mondays and Fridays.

Chapter 1 - (self-ratings)
Lesson 1- intro to price algo 5/5
Lesson 2- intro to 10y 5/5

Weekly com 20-
Asia ranges and london slops

Chapter 6- OHLC & OLHC
OLHC- Open Low High Close`;

describe('notes to slides', () => {
  const slides = docTextToSlides(TEXT);
  it('makes one slide per lesson and commentary, grouped by chapter, words unchanged', () => {
    expect(slides.map((s) => [s.section, s.title])).toEqual([
      [null, 'Omors Mentorship'],
      ['Chapter 1', 'Lesson 1 - Intro to price algo'],
      ['Chapter 1', 'Weekly Commentary 1'],
      ['Chapter 1', 'Chapter 1 self-ratings'],
      ['Chapter 1', 'Weekly Commentary 20'],
      ['Chapter 6', 'OHLC & OLHC'],
    ]);
    expect(slides[1].body).toBe('Price is delivered through algorithm.\n\n- Bank of England-GBP\n- Federal Reserve- USD\n\nThe market seeks liquidity.');
  });
  it('keeps the self-ratings list on one slide', () => {
    expect(slides[3].body).toBe('Lesson 1- intro to price algo 5/5\n\nLesson 2- intro to 10y 5/5');
  });
  it('reads mammoth html, keeping images in place', () => {
    const html = '<p>Chapter 2</p><p><strong>Lesson 3- Orderblocks</strong></p><ul><li>Bodies, not wicks</li></ul><p><img src="storage:u/images/a/0001.png" /></p><p>Examples &amp; more</p>';
    expect(docHtmlToSlides(html)).toEqual([
      { section: 'Chapter 2', title: 'Lesson 3 - Orderblocks', body: '- Bodies, not wicks\n\n![](storage:u/images/a/0001.png)\n\nExamples & more' },
    ]);
  });
  it('tidies titles', () => {
    expect(tidyTitle('Weekly comm 35- How to frame trade')).toBe('Weekly Commentary 35 - How to frame trade');
    expect(tidyTitle('Element One- The fib')).toBe('Element One - The fib');
  });
});
