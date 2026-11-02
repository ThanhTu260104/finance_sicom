'use client';

import type { ReactNode } from 'react';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import { Card, CardContent } from '@/components/ui/card';

export function CollapsibleTableCard({
  title,
  description,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-3 sm:p-4">
        <CollapsibleSection
          title={title}
          description={description}
          defaultOpen={defaultOpen}
        >
          {children}
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}
