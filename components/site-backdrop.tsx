'use client';

import Iridescence from '@/components/iridescence';

export function SiteBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 opacity-40" aria-hidden>
      <Iridescence color={[0.5, 0.5, 0.5]} speed={0.6} amplitude={0.1} mouseReact={false} />
    </div>
  );
}
