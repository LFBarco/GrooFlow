import React from 'react';
import { Skeleton } from './skeleton';
import { TableRow, TableCell } from './table';

interface TableSkeletonRowsProps {
  columnsCount: number;
  rowsCount?: number;
  hasCheckbox?: boolean;
  className?: string;
}

export function TableSkeletonRows({
  columnsCount,
  rowsCount = 5,
  hasCheckbox = false,
  className = '',
}: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rowsCount }).map((_, rIdx) => (
        <TableRow key={`table-skel-row-${rIdx}`} className={`border-b border-border/40 hover:bg-transparent ${className}`}>
          {hasCheckbox && (
            <TableCell className="w-10 p-4 align-middle">
              <Skeleton className="h-4 w-4 rounded" />
            </TableCell>
          )}
          {Array.from({ length: columnsCount }).map((_, cIdx) => (
            <TableCell key={`table-skel-cell-${rIdx}-${cIdx}`} className="p-4 align-middle">
              <Skeleton
                className="h-4 rounded bg-slate-300/40 dark:bg-slate-700/50"
                style={{
                  width: `${Math.max(35, 85 - ((cIdx * 19 + rIdx * 11) % 45))}%`,
                }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
