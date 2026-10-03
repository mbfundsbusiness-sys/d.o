import {
  LayoutDashboard,
  Map,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Sparkles,
  Moon,
  Feather,
  CalendarClock,
  Settings,
  ListTodo,
  Flame,
  Send,
  Timer,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/anchors', label: 'Daily Anchors', icon: Flame },
  { href: '/app/jobs', label: 'Job Pipeline', icon: Send },
  { href: '/app/working', label: 'Working', icon: Briefcase },
  { href: '/app/learning', label: 'Learning', icon: GraduationCap },
  { href: '/app/invest', label: 'Invest', icon: TrendingUp },
  { href: '/app/prayer', label: 'Prayer', icon: Moon },
  { href: '/app/timer', label: 'Timer', icon: Timer },
  { href: '/app/todo', label: 'To-do', icon: ListTodo },
  { href: '/app/schedule', label: 'Schedule', icon: CalendarClock },
  { href: '/app/roadmap', label: 'Roadmap', icon: Map },
  { href: '/app/ghostwriter', label: 'Ghostwriter', icon: Feather },
  { href: '/app/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

// Never hideable — losing access to Dashboard or Settings would strand the user.
export const ALWAYS_VISIBLE_HREFS = ['/app', '/app/settings'];

// The 4 items that get their own slot in the mobile bottom tab bar;
// everything else (including Settings) lives behind "More".
export const MOBILE_PRIMARY_HREFS = ['/app', '/app/anchors', '/app/working', '/app/jobs'];
