import type { ScheduleBlock, UserSettings } from '@/lib/supabase/client';
import { londonNow } from '@/lib/utils/dates';
import { effectiveBlocksForDay } from '@/lib/schedule/effective';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

// Standard Europe/London VTIMEZONE definition (BST/GMT, last-Sunday rules).
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/London',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:BST',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:GMT',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');

const RRULE_BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Next occurrence (today included) of `dow` as a Date holding just Y/M/D, UTC-anchored. */
function nextDateForDow(dow: number): { y: number; m: number; d: number } {
  const now = londonNow();
  const [y, m, d] = now.dateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const delta = (dow - now.dayOfWeek + 7) % 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateTime(y: number, m: number, d: number, hhmm: string): string {
  const [h, min] = hhmm.split(':');
  return `${y}${pad(m)}${pad(d)}T${h.padStart(2, '0')}${(min ?? '00').padStart(2, '0')}00`;
}

function utcStamp(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Build an iCalendar (.ics) file with one weekly-recurring VEVENT per schedule
 * block, including the derived Friday Jummah block. All times are Europe/London.
 */
export function buildScheduleIcs(blocks: ScheduleBlock[], settings: UserSettings | null): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dedication Optimiser//Schedule//EN',
    'CALSCALE:GREGORIAN',
    VTIMEZONE,
  ];

  const stamp = utcStamp();

  for (const dow of DAYS) {
    const dayBlocks = effectiveBlocksForDay(blocks, settings, dow);
    const { y, m, d } = nextDateForDow(dow);

    for (const block of dayBlocks) {
      const uid = `${block.derived ? 'jummah' : block.id}-${dow}@dedication-optimiser`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Europe/London:${localDateTime(y, m, d, block.start_time)}`,
        `DTEND;TZID=Europe/London:${localDateTime(y, m, d, block.end_time)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${RRULE_BYDAY[dow]}`,
        `SUMMARY:${escapeText(block.label)}`,
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
