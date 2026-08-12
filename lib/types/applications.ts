import type { JobApplicationStatus } from '@/lib/supabase/client';

export const STATUS_ORDER: JobApplicationStatus[] = [
  'researching',
  'applied',
  'phone_screen',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
];

export const STATUS_LABELS: Record<JobApplicationStatus, string> = {
  researching: 'Researching',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
