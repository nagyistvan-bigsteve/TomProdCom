import { signalStoreFeature, withComputed, withState } from "@ngrx/signals";
import { initialBusySlice } from "./with-busy.slice";
import { computed } from "@angular/core";

export function withBusy() {
    return signalStoreFeature(
        withState(initialBusySlice),
        withComputed(store => ({
            isBusy: computed(() => store.pendingCount() > 0),
            isIdle: computed(() => store.pendingCount() === 0)
        }))
    )
}
