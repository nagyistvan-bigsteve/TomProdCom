import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderPdfComponent } from './order-pdf.component';

describe('OrderPdfComponent', () => {
  let component: OrderPdfComponent;
  let fixture: ComponentFixture<OrderPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderPdfComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
