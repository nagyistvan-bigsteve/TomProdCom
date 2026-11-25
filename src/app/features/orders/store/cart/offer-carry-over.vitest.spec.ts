import { describe, it, expect } from 'vitest';
import { OrderResponse } from '@core/models/models';
import {
  carriedDeliveryDate,
  carryOverDecision,
  commentWithoutAutoLines,
  offerCarryOver,
} from './offer-carry-over';

function makeOffer(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 65,
    sortOrder: 0,
    clientId: 3,
    dateOrderPlaced: new Date(2026, 10, 24, 10),
    expectedDelivery: new Date(2026, 11, 1, 6),
    dateOrderDelivered: null as unknown as Date,
    untilDeliveryDate: false,
    forFirstHour: false,
    totalAmount: 680,
    totalAmountFinal: 650,
    totalQuantity: 0,
    paidAmount: 0,
    deliveryFee: 25,
    comment: 'Taxare inversa - fără TVA\nSună înainte\nTransport: 25 RON\n',
    voucher: '30',
    operator: { id: 'u1', name: 'Ana' },
    delivery_address: 'Str. Lunga 1',
    justOffer: true,
    ...overrides,
  };
}

const today = new Date(2026, 10, 24, 15);

describe('commentWithoutAutoLines', () => {
  it('drops the TVA and transport lines the overview adds again', () => {
    expect(commentWithoutAutoLines('Taxare inversa - fără TVA\nSună înainte\nTransport: 25 RON\n')).toBe(
      'Sună înainte',
    );
  });

  it('keeps everything else and handles an empty comment', () => {
    expect(commentWithoutAutoLines('Livrare la poartă\nTransport gratuit')).toBe(
      'Livrare la poartă\nTransport gratuit',
    );
    expect(commentWithoutAutoLines(null)).toBe('');
    expect(commentWithoutAutoLines('')).toBe('');
  });
});

describe('offerCarryOver', () => {
  it('carries the fee, voucher, address, comment and a future delivery date', () => {
    const carry = offerCarryOver(makeOffer(), true, today);

    expect(carry).toEqual({
      offerId: 65,
      clientId: 3,
      deleteOnSave: true,
      deliveryFee: 25,
      expectedDelivery: '2026-12-01',
      voucher: '30',
      deliveryAddress: 'Str. Lunga 1',
      comment: 'Sună înainte',
    });
  });

  it('keeps a delivery date of today', () => {
    const carry = offerCarryOver(makeOffer({ expectedDelivery: new Date(2026, 10, 24, 6) }), false, today);
    expect(carry.expectedDelivery).toBe('2026-11-24');
  });

  it('drops a delivery date in the past, so the default applies', () => {
    const carry = offerCarryOver(makeOffer({ expectedDelivery: new Date(2026, 10, 20, 6) }), false, today);
    expect(carry.expectedDelivery).toBeNull();
    expect(carriedDeliveryDate(carry)).toBeNull();
  });

  it('copes with an offer without fee, voucher or address', () => {
    const carry = offerCarryOver(
      makeOffer({
        deliveryFee: null as unknown as number,
        voucher: null as unknown as string,
        delivery_address: null as unknown as string,
        comment: null as unknown as string,
        expectedDelivery: null as unknown as Date,
      }),
      false,
      today,
    );
    expect(carry).toMatchObject({
      deliveryFee: 0,
      voucher: '',
      deliveryAddress: '',
      comment: '',
      expectedDelivery: null,
    });
  });
});

describe('carryOverDecision', () => {
  const carry = offerCarryOver(makeOffer(), true, today);

  it('applies for the offer\'s own client', () => {
    expect(carryOverDecision(carry, 3)).toBe('apply');
  });

  it('drops it once another client is chosen, so the offer is not deleted by an unrelated order', () => {
    expect(carryOverDecision(carry, 14)).toBe('drop');
  });

  it('waits while no client is selected (e.g. after a reload)', () => {
    expect(carryOverDecision(carry, -1)).toBe('wait');
    expect(carryOverDecision(carry, null)).toBe('wait');
  });

  it('drops a carry-over saved before it knew its client', () => {
    const { clientId: _, ...withoutClient } = carry;
    expect(carryOverDecision(withoutClient as typeof carry, 3)).toBe('drop');
  });

  it('has nothing to decide without a carry-over', () => {
    expect(carryOverDecision(null, 3)).toBe('none');
  });
});

describe('carriedDeliveryDate', () => {
  it('turns the stored day back into a local date', () => {
    const date = carriedDeliveryDate(offerCarryOver(makeOffer(), false, today))!;
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 12, 1]);
  });
});
