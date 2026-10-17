/** The order id from a `?orderId=` query parameter, or null if missing or invalid. */
export function parseOrderId(value: string | null | undefined): number | null {
  if (!value) return null;

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
