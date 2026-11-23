import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Unit_id } from '@core/models/enums';
import { Product } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { ShipmentStore } from '@features/shipments/store/shipment.store';
import { ShipmentDetailComponent } from './shipment-detail.component';

function product(id: number, unit_id = Unit_id.M3): Product {
  return {
    id,
    name: `7.5x15x40${id}`,
    unit_id,
    size_id: 0,
    thickness: 7.5,
    width: 15,
    length: 400,
    m2_util: 0,
    m2_brut: 0,
    piece_per_pack: 0,
  };
}

describe('ShipmentDetailComponent', () => {
  let component: ShipmentDetailComponent;
  let fixture: ComponentFixture<ShipmentDetailComponent>;
  const save = vi.fn();
  const products = [product(1), product(2), product(3, Unit_id.M2)];

  beforeEach(async () => {
    save.mockReset().mockResolvedValue(null);
    await TestBed.configureTestingModule({
      imports: [ShipmentDetailComponent],
      providers: [
        {
          provide: ProductStore,
          useValue: {
            productsEntities: signal(products),
            productsEntityMap: signal(Object.fromEntries(products.map((p) => [p.id, p]))),
            fetchStocks: vi.fn(),
          },
        },
        {
          provide: ShipmentStore,
          useValue: {
            current: signal(null),
            sortings: signal([]),
            isBusy: signal(false),
            clearCurrent: vi.fn(),
            loadShipment: vi.fn(),
            loadSortings: vi.fn(),
            save,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShipmentDetailComponent);
    fixture.componentRef.setInput('id', 'new');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts a new draft with one empty line', () => {
    expect(component.isNew()).toBe(true);
    expect(component.isDraft()).toBe(true);
    expect(component.lines()).toHaveLength(1);
    expect(component.canSave()).toBe(false);
  });

  it('adds an empty line after a product is picked and totals the m³', () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    component.setQuantity(key, '49');

    expect(component.lines()).toHaveLength(2);
    expect(component.draftPieces()).toBe(49);
    expect(component.draftM3()).toBeCloseTo(49 * 0.045, 6);
  });

  it('offers no M2 products', () => {
    component.setQuery(component.lines()[0].key, '7');
    expect(component.options().map((p) => p.id)).toEqual([1, 2]);
  });

  it('needs a name and valid quantities before saving', async () => {
    const key = component.lines()[0].key;
    component.selectProduct(key, products[0]);
    expect(component.canSave()).toBe(false);

    component.name.set('Kamion 1');
    component.setQuantity(key, '0');
    expect(component.canSave()).toBe(false);

    component.setQuantity(key, '20');
    expect(component.canSave()).toBe(true);

    await component.saveDraft();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kamion 1' }),
      [{ product_id: 1, quantity: 20 }],
    );
  });
});
