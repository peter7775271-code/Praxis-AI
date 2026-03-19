import { Suspense } from 'react';
import DashboardApp from '../DashboardApp';

export default function DashboardSettingsPage() {
  return (
    <Suspense
      fallback={(
        <div style={{ padding: 24 }}>
          Loading settings...
        </div>
      )}
    >
      <DashboardApp initialViewMode="settings" />
    </Suspense>
  );
}
