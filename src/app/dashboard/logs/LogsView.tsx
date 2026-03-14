// @ts-nocheck
'use client';

import React from 'react';
import { InteractiveLogsTable } from '@/components/ui/interactive-logs-table-shadcnui';

interface Props {
  [key: string]: any;
}

export default function LogsView(_props: Props) {
  return (
                <div className="flex-1 flex flex-col h-full">
                  <InteractiveLogsTable />
                </div>
  );
}
