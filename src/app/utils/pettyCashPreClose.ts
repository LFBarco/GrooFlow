import type { PettyCashWeekPreClosure } from '../types';
import { weekKeyMatches } from './pettyCashWeekKey';

export function isWeekPreClosed(
    custodianId: string,
    weekStr: string,
    preClosures: PettyCashWeekPreClosure[] | undefined
): boolean {
    return (preClosures ?? []).some(
        (p) => p.custodianId === custodianId && weekKeyMatches(p.weekNumber, weekStr)
    );
}
