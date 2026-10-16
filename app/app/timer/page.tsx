import { redirect } from 'next/navigation';

// The timer now lives on the dashboard's Today's Anchors card.
export default function TimerPage() {
  redirect('/app');
}
