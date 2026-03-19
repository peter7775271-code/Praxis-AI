'use client';

import { Suspense } from 'react';
import DashboardApp from '../../DashboardApp';

export default function DashboardSettingsDevPage() {
  return (
    <Suspense
      fallback={(
        <div style={{ padding: 24 }}>
          Loading dev settings...
        </div>
      )}
    >
      <DashboardApp initialViewMode="settings-dev" />
    </Suspense>
  );
}

