import {
  LayoutDashboard,
  Map,
  Languages,
  Sparkles,
  Wallet,
  Moon,
  CandlestickChart,
  Bot,
  Dumbbell,
  Feather,
  BookOpen,
  CalendarClock,
  Settings,
  ShieldCheck,
  Gift,
  ListTodo,
  GraduationCap,
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
  { href: '/app/trading', label: 'Trading', icon: CandlestickChart },
  { href: '/app/gym', label: 'Gym', icon: Dumbbell },
  { href: '/app/language', label: 'Language', icon: Languages },
  { href: '/app/reading', label: 'Reading', icon: BookOpen },
  { href: '/app/course', label: 'Course', icon: ShieldCheck },
  { href: '/app/courses', label: 'My Courses', icon: GraduationCap },
  { href: '/app/ghostwriter', label: 'Ghostwriter', icon: Feather },
  { href: '/app/finance', label: 'Finance', icon: Wallet },
  { href: '/app/wishlist', label: 'Wishlist', icon: Gift },
  { href: '/app/prayer', label: 'Prayer', icon: Moon },
  { href: '/app/botcouncil', label: 'BotCouncil', icon: Bot },
  { href: '/app/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

// Never hideable — losing access to Today or Settings would strand the user.
export const ALWAYS_VISIBLE_HREFS = ['/app', '/app/settings'];
