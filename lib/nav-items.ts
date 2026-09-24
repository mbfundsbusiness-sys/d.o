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
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Today', icon: LayoutDashboard },
  { href: '/app/todo', label: 'To-do', icon: ListTodo },
  { href: '/app/schedule', label: 'Schedule', icon: CalendarClock },
  { href: '/app/roadmap', label: 'Roadmap', icon: Map },
  { href: '/app/working', label: 'Working', icon: Briefcase },
  { href: '/app/learning', label: 'Learning', icon: GraduationCap },
  { href: '/app/invest', label: 'Invest', icon: TrendingUp },
  { href: '/app/ghostwriter', label: 'Ghostwriter', icon: Feather },
  { href: '/app/prayer', label: 'Prayer', icon: Moon },
  { href: '/app/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

// Never hideable — losing access to Today or Settings would strand the user.
export const ALWAYS_VISIBLE_HREFS = ['/app', '/app/settings'];
