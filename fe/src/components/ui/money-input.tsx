'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  formatGroupedNumber,
  parseGroupedNumber,
} from '@/lib/number-format';
import { cn } from '@/lib/utils';

type MoneyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value?: string;
  /** Emits normalized numeric string without grouping (e.g. "7500000000") */
  onChange?: (value: string) => void;
  maxDecimals?: number;
};

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    { value = '', onChange, onBlur, maxDecimals = 2, className, ...props },
    ref,
  ) => {
    const [display, setDisplay] = React.useState(() =>
      formatGroupedNumber(value, maxDecimals),
    );

    React.useEffect(() => {
      const next = formatGroupedNumber(value, maxDecimals);
      setDisplay((prev) => {
        const prevParsed = parseGroupedNumber(prev);
        const valueParsed = parseGroupedNumber(value);
        return prevParsed === valueParsed ? prev : next;
      });
    }, [value, maxDecimals]);

    return (
      <Input
        {...props}
        ref={ref}
        inputMode="decimal"
        className={cn('tabular-nums', className)}
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          setDisplay(raw);
          const parsed = parseGroupedNumber(raw);
          onChange?.(parsed);
        }}
        onBlur={(e) => {
          const parsed = parseGroupedNumber(display);
          setDisplay(formatGroupedNumber(parsed, maxDecimals));
          onChange?.(parsed);
          onBlur?.(e);
        }}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
