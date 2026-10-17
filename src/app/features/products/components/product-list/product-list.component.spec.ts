import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductSelectComponent } from './product-list.component';

describe('ProductSelectComponent', () => {
  let component: ProductSelectComponent;
  let fixture: ComponentFixture<ProductSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
