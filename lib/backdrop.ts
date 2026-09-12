export type BackdropId = 'aurora' | 'sunset' | 'ocean' | 'forest' | 'candy' | 'mono' | 'none';

export const BACKDROP_PRESETS: { id: BackdropId; label: string; swatch: string[] }[] = [
  { id: 'aurora', label: 'Aurora', swatch: ['hsl(205,90%,60%)', 'hsl(280,75%,65%)', 'hsl(190,85%,55%)', 'hsl(325,75%,60%)'] },
  { id: 'sunset', label: 'Sunset', swatch: ['hsl(15,90%,60%)', 'hsl(340,75%,65%)', 'hsl(30,85%,55%)', 'hsl(275,75%,60%)'] },
  { id: 'ocean', label: 'Ocean', swatch: ['hsl(200,90%,60%)', 'hsl(185,75%,65%)', 'hsl(220,85%,55%)', 'hsl(165,75%,60%)'] },
  { id: 'forest', label: 'Forest', swatch: ['hsl(130,90%,60%)', 'hsl(90,75%,65%)', 'hsl(155,85%,55%)', 'hsl(45,75%,60%)'] },
  { id: 'candy', label: 'Candy', swatch: ['hsl(330,90%,60%)', 'hsl(260,75%,65%)', 'hsl(190,85%,55%)', 'hsl(30,75%,60%)'] },
  { id: 'mono', label: 'Mono', swatch: ['hsl(0,0%,70%)', 'hsl(0,0%,60%)', 'hsl(0,0%,50%)', 'hsl(0,0%,40%)'] },
  { id: 'none', label: 'Flat', swatch: [] },
];

const STORAGE_KEY = 'backdrop';
const DEFAULT_BACKDROP: BackdropId = 'aurora';

export function isBackdropId(value: unknown): value is BackdropId {
  return typeof value === 'string' && BACKDROP_PRESETS.some((p) => p.id === value);
}

export function getStoredBackdrop(): BackdropId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isBackdropId(v)) return v;
  } catch {
    // ignore — localStorage unavailable
  }
  return DEFAULT_BACKDROP;
}

/** Applies a backdrop to the page immediately and remembers it for next load. */
export function applyBackdrop(id: BackdropId) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.backdrop = id;
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

/** Inline script source, run before paint in the root layout to avoid a flash of the default backdrop. */
export const BACKDROP_INIT_SCRIPT = `
try {
  var b = localStorage.getItem('${STORAGE_KEY}');
  if (b) document.documentElement.setAttribute('data-backdrop', b);
} catch (e) {}
`;
