// Mastery levels per the spec's thresholds.
export function masteryLabel(score: number): string {
  if (score >= 90) return 'Mastered';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Competent';
  if (score >= 40) return 'Developing';
  if (score >= 20) return 'Familiar';
  return 'Not started';
}

// Spaced-repetition interval schedule (days), correct-answer side.
const INTERVAL_SCHEDULE = [1, 3, 7, 14, 30, 60];

export function nextIntervalDays(currentIntervalDays: number): number {
  const idx = INTERVAL_SCHEDULE.indexOf(currentIntervalDays);
  if (idx === -1 || idx === INTERVAL_SCHEDULE.length - 1) {
    // Already past the last defined step (or an unrecognised value) —
    // keep growing, capped, rather than resetting.
    return Math.min(currentIntervalDays * 2, 120);
  }
  return INTERVAL_SCHEDULE[idx + 1];
}

export type MasteryUpdate = {
  mastery: number;
  successfulRecalls: number;
  intervalDays: number;
  nextReviewAt: string;
};

/**
 * First-pass mastery: capped at 60 ("Developing") — a single successful
 * lesson attempt is not mastery, per the spec (5 easy questions right
 * should not mean 100%). Mastery only grows further through successful
 * spaced review below.
 */
export function initialMastery(accuracy: number): MasteryUpdate {
  const mastery = Math.min(60, Math.round(accuracy * 100));
  const intervalDays = INTERVAL_SCHEDULE[0];
  const nextReviewAt = new Date(Date.now() + intervalDays * 86_400_000).toISOString();
  return { mastery, successfulRecalls: 0, intervalDays, nextReviewAt };
}

/**
 * Applies one review outcome to an existing mastery record. A pass advances
 * the interval and nudges mastery up (capped at 100, and slower the closer
 * to mastered — repeated success required, not one lucky review). A failed
 * review resets the interval to the start and knocks mastery down —
 * "repeated mistakes increase review frequency" per the spec.
 */
export function applyReview(
  current: { mastery: number; successfulRecalls: number; intervalDays: number },
  passed: boolean
): MasteryUpdate {
  if (passed) {
    const intervalDays = nextIntervalDays(current.intervalDays);
    const successfulRecalls = current.successfulRecalls + 1;
    const gain = Math.max(3, 12 - successfulRecalls); // diminishing gains as recalls build up
    const mastery = Math.min(100, current.mastery + gain);
    const nextReviewAt = new Date(Date.now() + intervalDays * 86_400_000).toISOString();
    return { mastery, successfulRecalls, intervalDays, nextReviewAt };
  }

  const intervalDays = INTERVAL_SCHEDULE[0];
  const mastery = Math.max(0, current.mastery - 15);
  const nextReviewAt = new Date(Date.now() + intervalDays * 86_400_000).toISOString();
  return { mastery, successfulRecalls: 0, intervalDays, nextReviewAt };
}
