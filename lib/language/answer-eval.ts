// Deterministic answer evaluation for the lesson player. Per the spec: not
// exact string matching, but not full AI judgement either for Phase 2 —
// normalize, check against the correct answer and any acceptable
// alternatives, and tolerate a single-character typo (insert/delete/
// substitute) as a "minor error" rather than marking it wrong outright.

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.!?¡¿,;:]+$/g, '') // trailing punctuation
    .replace(/\s+/g, ' ');
}

/** Levenshtein edit distance, capped early once it exceeds `max` (small inputs, fine to compute in full). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

export type EvalResult = { correct: boolean; minorError: boolean };

export function evaluateAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptableAnswers: string[],
  questionType: 'multiple_choice' | 'translation' | 'fill_blank'
): EvalResult {
  const candidates = [correctAnswer, ...acceptableAnswers].map(normalize);
  const given = normalize(userAnswer);

  if (candidates.includes(given)) {
    return { correct: true, minorError: false };
  }

  // Multiple choice must match one of the fixed options exactly — no typo
  // tolerance (the user picked, they didn't type).
  if (questionType === 'multiple_choice') {
    return { correct: false, minorError: false };
  }

  // Typo tolerance: within edit-distance 1 of any candidate, and the
  // candidate isn't trivially short (avoids "a" matching "I" etc.).
  for (const candidate of candidates) {
    if (candidate.length >= 3 && editDistance(given, candidate) <= 1) {
      return { correct: true, minorError: true };
    }
  }

  return { correct: false, minorError: false };
}
