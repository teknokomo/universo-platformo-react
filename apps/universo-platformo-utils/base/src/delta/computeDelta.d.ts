import type { ComponentSnapshotMap } from '@universo-platformo/types';
export declare function computeDelta(prev: Readonly<Record<string, Partial<ComponentSnapshotMap>>>, next: Readonly<Record<string, Partial<ComponentSnapshotMap>>>, baseTick: number, nextTick: number): {
    tick: number;
    baseTick: number;
    added: any[] | undefined;
    updated: any[] | undefined;
    removed: string[] | undefined;
};
