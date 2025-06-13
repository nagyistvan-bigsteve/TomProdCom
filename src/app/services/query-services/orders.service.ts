import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import {
  Client,
  ExactOrderItem,
  OrderItemsResponse,
  OrderResponse,
  ProductItems,
} from '../../models/models';
import { catchError, from, map, Observable, of, switchMap, take } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private supabaseService = inject(SupabaseService);

  getOrders(justOffers: boolean): Observable<OrderResponse[]> {
    return from(
      this.supabaseService.client
        .from('orders')
        .select(
          `id,
    client:client_id ( id, name, delivery_address, type, address, code, phone, other_details ),
    date_order_placed,
    expected_delivery,
    date_order_delivered,
    until_delivery_date,
    total_quantity,
    for_first_hour,
    total_amount,
    total_amount_final,
    paid_amount,
    comment,
    voucher,
    operator:operator_id ( id, name )
    `
        )
        .eq('just_offer', justOffers)
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(
          (order): OrderResponse => ({
            id: order.id,
            client: Array.isArray(order.client)
              ? order.client[0]
              : order.client || {
                  id: 0,
                  name: '',
                  delivery_address: '',
                  type: 1,
                  address: '',
                  code: '',
                  phone: '',
                  other_details: '',
                },
            operator: Array.isArray(order.operator)
              ? order.operator[0]
              : order.operator || { id: 0, name: '' },
            dateOrderPlaced: order.date_order_placed,
            untilDeliveryDate: order.until_delivery_date,
            forFirstHour: order.for_first_hour,
            expectedDelivery: order.expected_delivery,
            dateOrderDelivered: order.date_order_delivered,
            totalAmount: order.total_amount,
            totalAmountFinal: order.total_amount_final,
            totalQuantity: order.total_quantity,
            paidAmount: order.paid_amount,
            comment: order.comment,
            voucher: order.voucher,
          })
        )
      ),
      catchError((error) => {
        console.error('Error fetching orders:', error);
        return of([]);
      })
    );
  }

  getOrderItemsById(id: number): Observable<OrderItemsResponse[]> {
    return from(
      this.supabaseService.client
        .from('order_items')
        .select(
          `id, 
          product:product_id!inner (id, name, unit_id), 
          quantity,
          order_id,
          category:category_id!inner (name), 
          price, 
          item_status,
          packs_pieces`
        )
        .eq('order_id', id)
    ).pipe(
      map(({ data }) => {
        return (data ?? []).map(
          (orderItem): OrderItemsResponse => ({
            id: orderItem.id,
            product: Array.isArray(orderItem.product)
              ? orderItem.product[0]
              : orderItem.product || { id: 0, name: '', unit_id: 0 },
            orderId: orderItem.order_id,
            quantity: orderItem.quantity,
            category: Array.isArray(orderItem.category)
              ? orderItem.category[0]
              : orderItem.category || { name: '' },
            price: orderItem.price,
            itemStatus: orderItem.item_status,
            packsPieces: orderItem.packs_pieces,
          })
        );
      }),
      catchError((error) => {
        console.error('Error fatching order items:', error);
        return of([]);
      })
    );
  }

  async editOrderItem(
    id: number,
    order_id: number,
    item: Partial<{
      category_id: number;
      quantity: number;
      packs_pieces: string;
      price: number;
    }>,
    order: Partial<{
      total_amount: number;
      total_amount_final: number;
      total_quantity: number;
    }>
  ): Promise<boolean> {
    const { error: itemError } = await this.supabaseService.client
      .from('order_items')
      .update(item)
      .eq('id', id);

    if (itemError) {
      console.error('Failed to update  order item', itemError);
      return false;
    }

    const { error: orderError } = await this.supabaseService.client
      .from('orders')
      .update(order)
      .eq('id', order_id);

    if (orderError) {
      console.error('Failed to update order', orderError);
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
    const currentDate = new Date();

    const { error } = await this.supabaseService.client
      .from('orders')
      .update({ date_order_delivered: currentDate })
      .eq('id', id);

    await this.supabaseService.client
      .from('order_items')
      .update({ item_status: true })
      .eq('order_id', id);

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

  async deleteOrder(id: number) {
    this.getOrderItemsById(id)
      .pipe(
        take(1),
        switchMap(() => {
          return from(
            this.supabaseService.client
              .from('order_items')
              .delete()
              .eq('order_id', id)
          );
        }),
        switchMap(() => {
          return from(
            this.supabaseService.client.from('orders').delete().eq('id', id)
          );
        }),
        catchError((error) => {
          console.error('Error deleting order or items:', error);
          return of(null);
        })
      )
      .subscribe();
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
    just_offer: boolean
  ) {
    const currentDate = new Date();

    const { data } = await this.supabaseService.client
      .from('orders')
      .insert({
        client_id: client.id,
        date_order_placed: currentDate,
        expected_delivery,
        until_delivery_date,
        for_first_hour,
        total_amount: totalPrice,
        total_amount_final: finalPrice,
        voucher,
        comment,
        operator_id,
        total_quantity,
        just_offer,
      })
      .select()
      .single();

    if (data) {
      const exactOrderItems: ExactOrderItem[] = productItems.map((item) => ({
        product_id: item.product.id,
        order_id: data.id,
        quantity: item.quantity,
        category_id: item.category,
        price: item.price,
        packs_pieces:
          item.packsNeeded || item.extraPiecesNeeded
            ? (item.packsNeeded ? item.packsNeeded + 'p' : '0p') +
              (item.extraPiecesNeeded
                ? ' + ' + item.extraPiecesNeeded + 'b'
                : '')
            : '',
      }));

      await this.supabaseService.client
        .from('order_items')
        .insert(exactOrderItems);
    }
  }
}
