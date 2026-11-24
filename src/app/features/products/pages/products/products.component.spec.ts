import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Category, Unit_id } from '@core/models/enums';
import { GradedStock, Product, Stock } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { invalidStockDrafts, ProductsComponent, stockChanges } from './products.component';

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
  const setStocks = vi.fn();

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
    setStocks.mockReset().mockResolvedValue('saved');
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        {
          provide: ProductStore,
          useValue: {
            productsEntities: signal(products),
            stocksByProduct: signal(stocksByProduct),
            isBusy: signal(false),
            loadFailed: signal(false),
            fetchStocks: vi.fn(),
            fetchProducts: vi.fn(),
            setStocks,
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

  it('saves only the grades that changed, with the value the edit started from', async () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(card, 12, '7');
    component.setDraft(card, 13, '49');
    await component.saveEdit(card);

    expect(setStocks).toHaveBeenCalledTimes(1);
    expect(setStocks).toHaveBeenCalledWith([{ id: 12, expected: 9, stock: 7 }]);
    expect(component.editingId()).toBeNull();
  });

  it('does not write 0 for an emptied field', async () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(card, 12, '7');
    component.setDraft(card, 12, '');
    await component.saveEdit(card);

    expect(setStocks).not.toHaveBeenCalled();
    expect(component.editingId()).toBeNull();
  });

  it('keeps the edit open and drops the typed values when someone changed the stock meanwhile', async () => {
    setStocks.mockResolvedValue('conflict');
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(card, 12, '7');
    await component.saveEdit(card);

    expect(component.editingId()).toBe(card.id);
    expect(component.draft()).toEqual({});
  });

  it('keeps the edit open and shows a message for a negative or fractional value', async () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(card, 11, '-3');
    component.setDraft(card, 12, '2.5');
    await component.saveEdit(card);
    fixture.detectChanges();

    expect(setStocks).not.toHaveBeenCalled();
    expect(component.editingId()).toBe(card.id);
    expect(component.invalidStockIds()).toEqual([11, 12]);
    expect(fixture.nativeElement.querySelector('.invalid-hint')).not.toBeNull();

    component.setDraft(card, 11, '5');
    expect(component.invalidStockIds()).toEqual([12]);
  });

  it('takes m³ and saves the nearest whole pieces', async () => {
    // 7.5×15×400 = 0.045 m³ a piece
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setEditInM3(true);
    expect(component.editValue(card.grades[1])).toBe('0,405'); // B: 9 pieces
    component.setDraft(card, 12, '1'); // 22.2 pieces
    await component.saveEdit(card);

    expect(setStocks).toHaveBeenCalledWith([{ id: 12, expected: 9, stock: 22 }]);
  });

  it('drops typed values when switching the unit, and starts a new edit in pieces', () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setDraft(card, 12, '7');
    component.setEditInM3(true);
    expect(component.draft()).toEqual({});

    component.toggleEdit(card); // close
    component.toggleEdit(card); // open again
    expect(component.editInM3()).toBe(false);
  });

  it('refuses a negative m³ without sending anything', async () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setEditInM3(true);
    component.setDraft(card, 12, '-1');
    await component.saveEdit(card);

    expect(setStocks).not.toHaveBeenCalled();
    expect(component.invalidStockIds()).toEqual([12]);
  });

  it('accepts a decimal comma and refuses m³ that rounds to 0 pieces instead of wiping the stock', async () => {
    const card = component.cards()[0];
    component.toggleEdit(card);
    component.setEditInM3(true);
    component.setDraft(card, 11, '0,9'); // A: 20 pieces
    component.setDraft(card, 12, '0.02'); // B: 0.44 piece
    await component.saveEdit(card);

    expect(setStocks).not.toHaveBeenCalled();
    expect(component.invalidStockIds()).toEqual([12]);

    component.setDraft(card, 12, '0'); // a real 0 is fine
    await component.saveEdit(card);
    expect(setStocks).toHaveBeenCalledWith([
      { id: 11, expected: 40, stock: 20 },
      { id: 12, expected: 9, stock: 0 },
    ]);
  });

  it('rebuilds the fields after switching, so no typed text stays behind', () => {
    const card = component.cards()[1]; // 7.5×15×800, AB only: 10 pieces = 0.9 m³
    component.toggleEdit(card);
    fixture.detectChanges();
    const input = () => fixture.nativeElement.querySelector('.stock-edit-field input') as HTMLInputElement;
    input().value = '7';
    component.setEditInM3(true);
    fixture.detectChanges();
    expect(input().value).toBe('0,9');
  });

  it('offers the unit switch only for products counted in pieces with dimensions', () => {
    const card = component.cards()[0];
    expect(component.canTypeM3(card)).toBe(true);
    expect(component.canTypeM3({ ...card, product: { ...card.product, unit_id: Unit_id.BUC } })).toBe(false);
  });
});

describe('stockChanges', () => {
  const grades = [{ stock: stock(1, 1, Category.A, 40) }, { stock: stock(2, 1, Category.B, 9) }];

  it('sends the starting value as expected, not the current one', () => {
    // A was 38 when the edit opened, has been reloaded to 40 since
    expect(stockChanges(grades, { 1: 50 }, { 1: 38, 2: 9 })).toEqual([
      { id: 1, expected: 38, stock: 50 },
    ]);
  });

  it('skips unchanged, negative and non-numeric values', () => {
    expect(stockChanges(grades, { 1: 40, 2: -1 }, {})).toEqual([]);
    expect(stockChanges(grades, { 2: Number.NaN }, {})).toEqual([]);
  });
});

describe('invalidStockDrafts', () => {
  const grades = [{ stock: stock(1, 1, Category.A, 40) }, { stock: stock(2, 1, Category.B, 9) }];

  it('flags negative and non-numeric values, not untouched fields', () => {
    expect(invalidStockDrafts(grades, { 1: -3 }, true)).toEqual([1]);
    expect(invalidStockDrafts(grades, { 2: Number.NaN }, false)).toEqual([2]);
    expect(invalidStockDrafts(grades, {}, true)).toEqual([]);
  });

  it('flags fractions only for products counted in whole pieces', () => {
    expect(invalidStockDrafts(grades, { 1: 8.5, 2: 3 }, true)).toEqual([1]);
    expect(invalidStockDrafts(grades, { 1: 8.5 }, false)).toEqual([]);
  });
});

describe('ProductsComponent without products', () => {
  it('offers a retry after a failed load instead of spinning forever', async () => {
    const fetchProducts = vi.fn();
    const fetchStocks = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        {
          provide: ProductStore,
          useValue: {
            productsEntities: signal([]),
            stocksByProduct: signal({}),
            isBusy: signal(false),
            loadFailed: signal(true),
            fetchStocks,
            fetchProducts,
            setStocks: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-spinner')).toBeNull();

    el.querySelector<HTMLButtonElement>('.loading-state button')!.click();
    expect(fetchProducts).toHaveBeenCalled();
    expect(fetchStocks).toHaveBeenCalledTimes(2); // on open, and the retry
  });
});
