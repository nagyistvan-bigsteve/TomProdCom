import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { Category, Unit_id } from '@core/models/enums';
import { Product } from '@core/models/models';
import { ProductStore } from '@features/products/store/product.store';
import { SortingsService } from '@features/products/services/sortings.service';
import { SortingDialogComponent } from './sorting-dialog.component';

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

describe('SortingDialogComponent', () => {
  let component: SortingDialogComponent;
  let fixture: ComponentFixture<SortingDialogComponent>;
  const close = vi.fn();
  const recordSorting = vi.fn();

  beforeEach(async () => {
    close.mockClear();
    recordSorting.mockReset().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [SortingDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { product, shipmentId: 7 } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: SortingsService, useValue: { recordSorting } },
        {
          provide: ProductStore,
          useValue: {
            stocksByProduct: signal({
              1: { [Category.AB]: { id: 3, product_id: 1, category_id: Category.AB, stock: 49, booked_stock: 0 } },
            }),
            fetchStocks: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SortingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts empty and cannot be saved', () => {
    expect(component.abStock()).toBe(49);
    expect(component.error()).toBe('EMPTY');
  });

  it('puts the rest into A', () => {
    component.b.set(9);
    component.restToA();
    expect(component.a()).toBe(40);
    expect(component.remainingAb()).toBe(0);
    expect(component.error()).toBeNull();
  });

  it('refuses more than the AB stock', async () => {
    component.a.set(45);
    component.waste.set(5);
    expect(component.error()).toBe('MORE_THAN_AB');
    await component.save();
    expect(recordSorting).not.toHaveBeenCalled();
  });

  it('records the sorting against the shipment and closes', async () => {
    component.a.set(40);
    component.b.set(8);
    component.waste.set(1);
    await component.save();

    expect(recordSorting).toHaveBeenCalledWith({
      productId: 1,
      a: 40,
      b: 8,
      waste: 1,
      shipmentId: 7,
      comment: '',
    });
    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open when the database refuses', async () => {
    recordSorting.mockResolvedValue(false);
    component.a.set(1);
    await component.save();
    expect(close).not.toHaveBeenCalled();
  });
});
