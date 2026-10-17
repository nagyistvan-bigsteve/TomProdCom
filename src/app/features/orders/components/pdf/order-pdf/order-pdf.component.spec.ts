import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderResponse } from '@core/models/models';
import { ClientStore } from '@features/clients/store/client.store';
import { OrderPdfComponent } from './order-pdf.component';

describe('OrderPdfComponent', () => {
  let component: OrderPdfComponent;
  let fixture: ComponentFixture<OrderPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderPdfComponent],
      // The PDF is only rendered once the order's client is loaded
      providers: [
        {
          provide: ClientStore,
          useValue: {
            clientsEntityMap: signal({
              1: { id: 1, name: 'Test client', type: 2, client_phones: [] },
            }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderPdfComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isPrinting', false);
    fixture.componentRef.setInput('order', {
      id: 1,
      clientId: 1,
      dateOrderPlaced: new Date(),
      totalAmount: 0,
      totalAmountFinal: 0,
      totalQuantity: 0,
    } as unknown as OrderResponse);
    fixture.componentRef.setInput('orderItems', []);
    fixture.componentRef.setInput('justOffer', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
