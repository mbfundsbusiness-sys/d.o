'use client';

import { useState } from 'react';
import GridScan from '@/components/backdrop/grid-scan';

// The app's only backdrop. The scan beam steps round the six tertiary colours of
// the colour wheel, one colour per sweep, changing as each new sweep starts.

export const TERTIARY_COLOURS = [
  '#ff6b3d', // red-orange
  '#ffb02e', // yellow-orange
  '#a3e635', // yellow-green
  '#2dd4bf', // blue-green
  '#818cf8', // blue-violet
  '#e879f9', // red-violet
] as const;

export function SiteBackdrop() {
  const [i, setI] = useState(0);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <GridScan
        linesColor="#4d4757"
        scanColor={TERTIARY_COLOURS[i]}
        cells={8}
        depth={3}
        scanDuration={2.4}
        scanDelay={1.6}
        clickEffect="ping"
        lineThickness={1}
        lineStyle="solid"
        depthFade={0.6}
        shading={0.7}
        reflection={0.35}
        points
        scanDirection="forward"
        scanWidth={1}
        trail={0.5}
        glow={0.6}
        parallax={1}
        autoScan
        interactive
        enableWebcam={false}
        showPreview
        intro
        lightMode={false}
        onSweep={(n) => setI(n % TERTIARY_COLOURS.length)}
      />
    </div>
  );
}
