import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PDFHeaderComponent } from './pdf-header.component';

describe('HeaderComponent', () => {
  let component: PDFHeaderComponent;
  let fixture: ComponentFixture<PDFHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PDFHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PDFHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('justOffer', false);
    fixture.componentRef.setInput('id', 1);
    fixture.componentRef.setInput('deliveryDate', null);
    fixture.componentRef.setInput('orderDate', new Date());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
