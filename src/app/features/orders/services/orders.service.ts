import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';
import { unwrapResult } from '@core/services/supabase-result.util';
import {
  Client,
  ExactOrderItem,
  OrderItemsResponse,
  OrderResponse,
  ProductItems,
} from '@core/models/models';
import { from, map, Observable } from 'rxjs';
import { mapOrderRow, ORDER_SELECT, OrderRow } from './order.mapper';
import { OrderTotals } from '@features/orders/store/order-details/order-details.computed';

/** A new line item as the add_order_item database function expects it. */
export interface NewOrderItem {
  product_id: number;
  quantity: number;
  category_id: number;
  price: number;
  packs_pieces: string;
}

export type OrderItemChanges = Partial<Omit<NewOrderItem, 'product_id'>>;

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private supabaseService = inject(SupabaseService);

  getOrders(justOffers: boolean): Observable<OrderResponse[]> {
    return from(
      this.supabaseService.client
        .from('orders')
        .select(ORDER_SELECT)
        .eq('just_offer', justOffers)
        .is('deleted_at', null),
    ).pipe(map(this.toOrders));
  }

  getDeletedOrders(): Observable<OrderResponse[]> {
    return from(
      this.supabaseService.client
        .from('orders')
        .select(ORDER_SELECT)
        .not('deleted_at', 'is', null),
    ).pipe(map(this.toOrders));
  }

  getClientOrders(clientId: number): Observable<OrderResponse[]> {
    return from(
      this.supabaseService.client
        .from('orders')
        .select(ORDER_SELECT)
        .eq('just_offer', false)
        .eq('client_id', clientId)
        .is('deleted_at', null),
    ).pipe(map(this.toOrders));
  }

  getOrderById(id: number): Observable<OrderResponse> {
    return from(
      this.supabaseService.client
        .from('orders')
        .select(ORDER_SELECT)
        .eq('id', id)
        .single(),
    ).pipe(map((result) => mapOrderRow(unwrapResult(result) as OrderRow)));
  }

  private toOrders(result: { data: unknown; error: unknown }): OrderResponse[] {
    const rows = (unwrapResult(result) ?? []) as OrderRow[];
    return rows.map(mapOrderRow);
  }

  async saveAdminSortOrder(orders: OrderResponse[]): Promise<boolean> {
    const updates = orders.map((order, index) => ({
      id: order.id,
      sort_order: index,
    }));

    const { error } = await this.supabaseService.client.rpc(
      'update_order_sort_orders',
      { items: updates },
    );

    if (error) {
      console.error('Failed to update the order', error);
      return false;
    }

    return true;
  }

  getOrderItemsById(id: number): Observable<OrderItemsResponse[]> {
    return from(
      this.supabaseService.client
        .from('order_items')
        .select(
          `id, 
          product:product_id!inner (id, name, unit_id, width, length, thickness), 
          quantity,
          order_id,
          category:category_id!inner (name), 
          price, 
          item_status,
          packs_pieces`,
        )
        .eq('order_id', id),
    ).pipe(
      map((result) => {
        return (unwrapResult(result) ?? []).map(
          (orderItem): OrderItemsResponse => ({
            id: orderItem.id,
            product: Array.isArray(orderItem.product)
              ? orderItem.product[0]
              : orderItem.product || {
                  id: 0,
                  name: '',
                  unit_id: 0,
                  width: 0,
                  length: 0,
                  thickness: 0,
                },
            orderId: orderItem.order_id,
            quantity: +orderItem.quantity,
            category: Array.isArray(orderItem.category)
              ? orderItem.category[0]
              : orderItem.category || { name: '' },
            price: orderItem.price,
            itemStatus: orderItem.item_status,
            packsPieces: orderItem.packs_pieces,
          }),
        );
      }),
    );
  }

  // Line-item changes save the item and the order totals in one transaction.
  // The caller computes the totals for the item list after the change
  // (orderTotals in @features/orders/store/order-details).

  async addOrderItem(
    orderId: number,
    item: NewOrderItem,
    totals: OrderTotals,
  ): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc('add_order_item', {
      p_order_id: orderId,
      p_item: item,
      p_totals: this.toTotalsRow(totals),
    });

    if (error) {
      console.error('Failed to add the order item', error);
      return false;
    }

    return true;
  }

  async updateOrderItem(
    itemId: number,
    changes: OrderItemChanges,
    totals: OrderTotals,
  ): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'update_order_item',
      {
        p_item_id: itemId,
        p_changes: changes,
        p_totals: this.toTotalsRow(totals),
      },
    );

    if (error) {
      console.error('Failed to update the order item', error);
      return false;
    }

    return true;
  }

  /** New line totals for several items of one order (the price dialog). */
  async updateOrderItemPrices(
    orderId: number,
    items: { id: number; price: number }[],
    totals: OrderTotals,
  ): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'update_order_item_prices',
      {
        p_order_id: orderId,
        p_items: items,
        p_totals: this.toTotalsRow(totals),
      },
    );

    if (error) {
      console.error('Failed to update the order item prices', error);
      return false;
    }

    return true;
  }

  async deleteOrderItem(itemId: number, totals: OrderTotals): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'delete_order_item',
      { p_item_id: itemId, p_totals: this.toTotalsRow(totals) },
    );

    if (error) {
      console.error('Failed to delete the order item', error);
      return false;
    }

    return true;
  }

  private toTotalsRow(totals: OrderTotals) {
    return {
      total_amount: totals.totalAmount,
      total_amount_final: totals.totalAmountFinal,
      total_quantity: totals.totalQuantity,
    };
  }

  /** Saves the comment, the voucher and the final amount in one request. */
  async updateOrderCommentAndVoucher(
    id: number,
    comment: string,
    voucher: string,
    totalAmountFinal: number,
  ): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('orders')
      .update({ comment, voucher, total_amount_final: totalAmountFinal })
      .eq('id', id);

    if (error) {
      console.error('Failed to update the comment and voucher, ', error);
      return false;
    }

    return true;
  }

  async transformOfferToOrder(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('orders')
      .update({ just_offer: false })
      .eq('id', id);

    if (error) {
      console.error('Failed to transform offer to order, ', error);
      return false;
    }

    return true;
  }

  async orderIsPaid(id: number, paid_amount: number): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('orders')
      .update({ paid_amount })
      .eq('id', id);

    if (error) {
      console.error('Failed to add the paid amount, ', error);
      return false;
    }

    return true;
  }

  async orderIsDelivered(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'mark_order_delivered',
      { p_order_id: id },
    );

    if (error) {
      console.error('Failed to finish the order, ', error);
      return false;
    }

    return true;
  }

  async orderItemStatusUpdate(id: number, status: boolean): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('order_items')
      .update({ item_status: status })
      .eq('id', id);

    if (error) {
      console.error('Failed update item status, ', error);
      return false;
    }

    return true;
  }

  async setDeletionForOrder(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('orders')
      .update({ deleted_at: new Date() })
      .eq('id', id);

    if (error) {
      console.error('Failed to set deletion date for order, ', error);
      return false;
    }

    return true;
  }

  async restoreDeletedOrder(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('orders')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) {
      console.error('Failed to restore order, ', error);
      return false;
    }

    return true;
  }

  async permanentlyDeleteOrder(id: number): Promise<boolean> {
    const { error } = await this.supabaseService.client.rpc(
      'delete_order_permanently',
      { p_order_id: id },
    );

    if (error) {
      console.error('Failed to permanently delete order:', error);
      return false;
    }

    return true;
  }

  async placeOrder(
    productItems: ProductItems,
    totalPrice: number,
    finalPrice: number,
    voucher: string,
    client: Client,
    operator_id: string,
    comment: string,
    expected_delivery: Date,
    until_delivery_date: boolean,
    for_first_hour: boolean,
    total_quantity: number,
    just_offer: boolean,
    delivery_address: string,
    delivery_fee: number,
  ): Promise<boolean> {
    const items: Omit<ExactOrderItem, 'order_id'>[] = productItems.map(
      (item) => ({
        product_id: item.product.id,
        quantity: +item.quantity,
        category_id: item.category,
        price: item.price,
        packs_pieces:
          item.packsNeeded || item.extraPiecesNeeded
            ? (item.packsNeeded ? item.packsNeeded + 'p' : '0p') +
              (item.extraPiecesNeeded
                ? ' + ' + item.extraPiecesNeeded + 'b'
                : '')
            : '',
      }),
    );

    // One transaction: the order and its items are saved together or not at all
    const { error } = await this.supabaseService.client.rpc('place_order', {
      p_order: {
        client_id: client.id,
        operator_id,
        expected_delivery,
        until_delivery_date,
        for_first_hour,
        total_amount: totalPrice,
        total_amount_final: finalPrice,
        voucher,
        comment,
        total_quantity,
        just_offer,
        delivery_address,
        delivery_fee,
      },
      p_items: items,
    });

    if (error) {
      console.error('Failed to save the order', error);
      return false;
    }

    return true;
  }
}
