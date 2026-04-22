import type { PettyCashWeekPreClosure } from '../types';

export function isWeekPreClosed(
    custodianId: string,
    weekStr: string,
    preClosures: PettyCashWeekPreClosure[] | undefined
): boolean {
    return (preClosures ?? []).some(
        (p) => p.custodianId === custodianId && String(p.weekNumber) === String(weekStr)
    );
}
