import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Category, Unit_id } from '@core/models/enums';
import { GradedStock, Product } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { SelectedProductComponent } from './selected-product.component';

const product: Product = {
  id: 1,
  name: '7.5x15x400',
  unit_id: Unit_id.M3,
  size_id: 0,
  thickness: 7.5,
  width: 15,
  length: 400,
  m2_util: 0,
  m2_brut: 0,
  piece_per_pack: 0,
};

const grades = (a: number): Record<number, GradedStock> => ({
  1: {
    [Category.A]: { id: 11, product_id: 1, category_id: Category.A, stock: a, booked_stock: 0 },
    [Category.AB]: { id: 13, product_id: 1, category_id: Category.AB, stock: 49, booked_stock: 0 },
  },
});

describe('SelectedProductComponent', () => {
  let component: SelectedProductComponent;
  let fixture: ComponentFixture<SelectedProductComponent>;
  const stocksByProduct = signal(grades(40));

  beforeEach(async () => {
    stocksByProduct.set(grades(40));
    await TestBed.configureTestingModule({
      imports: [SelectedProductComponent],
      providers: [
        {
          provide: ProductStore,
          useValue: {
            stocksByProduct,
            pricesForSelectedProduct: signal([]),
            setSelectedProduct: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectedProductComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedProduct', product);
    fixture.detectChanges();
  });

  it('shows the stock of the grade a T item is taken from (A)', () => {
    component.selectedCategory = Category.T;
    expect(component.currentStock?.category_id).toBe(Category.A);

    component.selectedCategory = Category.AB;
    expect(component.currentStock?.category_id).toBe(Category.AB);
  });

  it('follows a stock reload instead of keeping the value from when it was picked', () => {
    expect(component.currentStock?.stock).toBe(40);
    stocksByProduct.set(grades(12));
    expect(component.currentStock?.stock).toBe(12);
  });
});
