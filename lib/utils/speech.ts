// Text-to-speech for hearing a word/phrase read aloud, via the browser's
// built-in SpeechSynthesis API — no backend call, no API key, works offline
// in most browsers once voices are installed.

const LANG_CODES: Record<string, string> = {
  spanish: 'es-ES',
  french: 'fr-FR',
  german: 'de-DE',
  arabic: 'ar-SA',
  japanese: 'ja-JP',
  mandarin: 'zh-CN',
  chinese: 'zh-CN',
  italian: 'it-IT',
  portuguese: 'pt-PT',
  korean: 'ko-KR',
  russian: 'ru-RU',
  turkish: 'tr-TR',
  dutch: 'nl-NL',
  greek: 'el-GR',
  hindi: 'hi-IN',
  polish: 'pl-PL',
  swedish: 'sv-SE',
};

export function langNameToCode(language: string): string {
  return LANG_CODES[language.trim().toLowerCase()] ?? 'en-US';
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak `text` in the given language. Cancels any speech already in progress
 * first, since overlapping utterances are confusing rather than useful.
 */
export function speak(text: string, language: string) {
  if (!isSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langNameToCode(language);
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
