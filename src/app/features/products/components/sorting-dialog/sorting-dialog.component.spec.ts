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
    expect(component.remaining()).toBe(0);
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

describe('SortingDialogComponent from a truck', () => {
  let component: SortingDialogComponent;
  let fixture: ComponentFixture<SortingDialogComponent>;
  const recordSorting = vi.fn();

  beforeEach(async () => {
    recordSorting.mockReset().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [SortingDialogComponent],
      providers: [
        // AB holds 49 pieces in total, 20 of them are still unsorted on this truck
        { provide: MAT_DIALOG_DATA, useValue: { product, shipmentId: 7, truckRemaining: 20 } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
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

  it('shows what is left on the truck, not the whole AB stock', () => {
    expect(component.fromTruck()).toBe(true);
    expect(component.available()).toBe(20);
    expect(fixture.nativeElement.textContent).toContain('20');
    expect(fixture.nativeElement.textContent).not.toContain('49');
  });

  it('puts the truck remainder into A', () => {
    component.b.set(5);
    component.restToA();
    expect(component.a()).toBe(15);
    expect(component.remaining()).toBe(0);
    expect(component.error()).toBeNull();
  });

  it('refuses more than is left on the truck', async () => {
    component.a.set(21);
    expect(component.error()).toBe('MORE_THAN_TRUCK');
    await component.save();
    expect(recordSorting).not.toHaveBeenCalled();
  });
});

describe('SortingDialogComponent from the products page', () => {
  let component: SortingDialogComponent;
  let fixture: ComponentFixture<SortingDialogComponent>;
  let resolveSave: (ok: boolean) => void;
  const dialogRef = { close: vi.fn(), disableClose: false };
  const recordSorting = vi.fn();
  const trucksWithRemaining = vi.fn();

  beforeEach(async () => {
    dialogRef.close.mockClear();
    dialogRef.disableClose = false;
    recordSorting.mockReset().mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveSave = resolve)),
    );
    trucksWithRemaining.mockReset().mockResolvedValue([
      { id: 9, name: 'Truck 9', arrived_on: '2026-11-20', received: 30, sorted: 10, remaining: 20 },
    ]);
    await TestBed.configureTestingModule({
      imports: [SortingDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { product } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: SortingsService, useValue: { recordSorting, trucksWithRemaining } },
        {
          provide: ProductStore,
          useValue: {
            // 49 AB pieces, 40 of them ordered by customers: 9 free
            stocksByProduct: signal({
              1: { [Category.AB]: { id: 3, product_id: 1, category_id: Category.AB, stock: 49, booked_stock: 40 } },
            }),
            fetchStocks: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SortingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('counts against the whole AB stock until a truck is picked', () => {
    expect(trucksWithRemaining).toHaveBeenCalledWith(1);
    expect(component.trucks()).toHaveLength(1);
    expect(component.fromTruck()).toBe(false);
    expect(component.available()).toBe(49);
  });

  it('switches to the picked truck and sends its id', async () => {
    component.pickedTruckId.set(9);
    expect(component.fromTruck()).toBe(true);
    expect(component.available()).toBe(20);

    component.a.set(21);
    expect(component.error()).toBe('MORE_THAN_TRUCK');

    component.a.set(5);
    const saving = component.save();
    resolveSave(true);
    await saving;
    expect(recordSorting).toHaveBeenCalledWith(expect.objectContaining({ shipmentId: 9, a: 5 }));
  });

  it('warns, but allows, sorting AB pieces that customers ordered', () => {
    component.a.set(12);
    expect(component.error()).toBeNull();
    expect(component.bookedTaken()).toBe(3);
    expect(component.abFreeAfter()).toBe(-3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.warning-text')).not.toBeNull();
  });

  it('cannot be closed while saving', async () => {
    component.a.set(1);
    const saving = component.save();
    expect(dialogRef.disableClose).toBe(true);
    component.cancel();
    expect(dialogRef.close).not.toHaveBeenCalled();

    resolveSave(true);
    await saving;
    expect(dialogRef.disableClose).toBe(false);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
