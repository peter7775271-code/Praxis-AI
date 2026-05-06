export type ChangelogEntry = {
  date: string;
  title: string;
  detail?: string;
};

export const DASHBOARD_CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-05-06',
    title: 'Dashboard refresh.',
  },
  {
    date: '2026-05-05',
    title: 'Added question tokens tracking.',
  },
];
