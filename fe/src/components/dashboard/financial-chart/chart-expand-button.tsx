'use client';

import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ChartExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      title="Phóng to toàn màn hình"
    >
      <Maximize2 className="h-4 w-4" />
      <span className="hidden sm:inline ml-1.5">Phóng to</span>
    </Button>
  );
}
