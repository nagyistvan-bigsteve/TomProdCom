export interface BusySlice {
    // Number of calls in flight; several can overlap (e.g. parallel fetches on init)
    readonly pendingCount: number;
}

export const initialBusySlice: BusySlice = {
    pendingCount: 0,
};
