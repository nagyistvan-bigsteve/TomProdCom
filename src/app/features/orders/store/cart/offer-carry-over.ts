import { OrderResponse } from '@core/models/models';

/**
 * What "Creare comandă" (load an offer into the cart) carries into the offer
 * overview besides the items, prices and client, and which offer the new
 * order replaces. Kept with the cart, so a reload does not lose it.
 */
export interface OfferCarryOver {
  readonly offerId: number;
  /** "Șterge oferta" was ticked: place_order soft-deletes the offer with the new order. */
  readonly deleteOnSave: boolean;
  readonly deliveryFee: number;
  /** ISO date (yyyy-mm-dd), or null to use the default (today + 3 days). */
  readonly expectedDelivery: string | null;
  readonly voucher: string;
  readonly deliveryAddress: string;
  readonly comment: string;
}

/** The TVA line the overview adds by itself for a reverse-charge client. */
export const TVA_COMMENT_LINE = 'Taxare inversa - fără TVA';

/**
 * The offer's comment without the lines the overview adds again when the order
 * is saved: the TVA line and "Transport: N RON" (from the transport fee field).
 */
export function commentWithoutAutoLines(comment: string | null | undefined): string {
  return (comment ?? '')
    .split('\n')
    .filter((line) => {
      const text = line.trim();
      return text !== TVA_COMMENT_LINE && !/^Transport: .* RON$/.test(text);
    })
    .join('\n')
    .trim();
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The carry-over for an offer. Its expected delivery is kept unless it is
 * already in the past (or unreadable), then the overview's default applies.
 */
export function offerCarryOver(
  offer: OrderResponse,
  deleteOnSave: boolean,
  today: Date,
): OfferCarryOver {
  const expected = offer.expectedDelivery ? new Date(offer.expectedDelivery) : null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const keepDate = !!expected && !isNaN(expected.getTime()) && expected >= startOfToday;

  return {
    offerId: offer.id,
    deleteOnSave,
    deliveryFee: offer.deliveryFee ?? 0,
    expectedDelivery: keepDate ? isoDay(expected!) : null,
    voucher: offer.voucher ?? '',
    deliveryAddress: offer.delivery_address ?? '',
    comment: commentWithoutAutoLines(offer.comment),
  };
}

/** The carried-over expected delivery as a local date, or null for the default. */
export function carriedDeliveryDate(carry: OfferCarryOver): Date | null {
  if (!carry.expectedDelivery) return null;
  const [year, month, day] = carry.expectedDelivery.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}
