import type { TimeSyncSample, TimeSyncState } from '@universo-platformo/types';
export declare function createTimeSyncEstimator(windowSize?: number, emaAlpha?: number): {
    addSample(sample: TimeSyncSample): void;
    getState(): TimeSyncState;
};
