'use client';

import GridScan from '@/components/backdrop/grid-scan';

/** The app's only backdrop (signed-in pages). The scan beam takes the current assistant's colour. */
export function SiteBackdrop({ colour }: { colour: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <GridScan
        linesColor="#4d4757"
        scanColor={colour}
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
      />
    </div>
  );
}
