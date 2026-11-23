import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Category, Unit_id } from '@core/models/enums';
import { GradedStock, Product, Stock } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { ProductsComponent } from './products.component';

function product(id: number, length: number, unit_id = Unit_id.M3): Product {
  return {
    id,
    name: `7.5x15x${length}`,
    unit_id,
    size_id: 0,
    thickness: 7.5,
    width: 15,
    length,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
  };
}

function stock(id: number, product_id: number, category_id: Stock['category_id'], value: number, booked = 0): Stock {
  return { id, product_id, category_id, stock: value, booked_stock: booked };
}

describe('ProductsComponent', () => {
  let component: ProductsComponent;
  let fixture: ComponentFixture<ProductsComponent>;
  const updateStock = vi.fn();

  const products = [product(1, 400), product(2, 800), product(3, 400, Unit_id.M2)];
  const stocksByProduct: Record<number, GradedStock> = {
    1: {
      [Category.A]: stock(11, 1, Category.A, 40, 45),
      [Category.B]: stock(12, 1, Category.B, 9),
      [Category.AB]: stock(13, 1, Category.AB, 49),
    },
    2: { [Category.AB]: stock(21, 2, Category.AB, 10) },
    3: { [Category.AB]: stock(31, 3, Category.AB, 5) },
  };

  beforeEach(async () => {
    updateStock.mockClear();
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        {
          provide: ProductStore,
          useValue: {
            productsEntities: signal(products),
            stocksByProduct: signal(stocksByProduct),
            fetchStocks: vi.fn(),
            updateStock,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows A, B and AB for products up to 7 m and only AB above, no M2', () => {
    const cards = component.cards();
    expect(cards.map((c) => c.id)).toEqual([1, 2]);
    expect(cards[0].grades.map((g) => g.category)).toEqual([Category.A, Category.B, Category.AB]);
    expect(cards[0].total).toBe(98);
    expect(cards[1].grades.map((g) => g.category)).toEqual([Category.AB]);
  });

  it('offers sorting only for gradable products with AB stock', () => {
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.product-card');
    expect(cards[0].querySelector('.sort-ab-btn')).not.toBeNull();
    expect(cards[1].querySelector('.sort-ab-btn')).toBeNull();
  });

  it('marks a negative available count and filters on it', () => {
    expect(fixture.nativeElement.querySelectorAll('.stock-negative').length).toBe(1);
    expect(component.counts()).toEqual({ toSort: 1, negative: 1 });

    component.stockFilter.set('negative');
    expect(component.visibleCards().map((c) => c.id)).toEqual([1]);
  });

  it('saves only the grades that changed', () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(12, '7');
    component.setDraft(13, '49');
    component.saveEdit(card);

    expect(updateStock).toHaveBeenCalledTimes(1);
    expect(updateStock).toHaveBeenCalledWith({ id: 12, stock: 7 });
    expect(component.editingId()).toBeNull();
  });

  it('does not write 0 for an emptied field', () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(12, '7');
    component.setDraft(12, '');
    component.saveEdit(card);

    expect(updateStock).not.toHaveBeenCalled();
  });
});
