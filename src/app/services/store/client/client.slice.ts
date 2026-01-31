export interface ClientSlice {
  readonly currentClientId: number;
}

export const initialClientSlice: ClientSlice = {
  currentClientId: -1,
};
