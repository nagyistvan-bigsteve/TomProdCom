import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShipmentsComponent } from './shipments.component';

describe('ShipmentsComponent', () => {
  let component: ShipmentsComponent;
  let fixture: ComponentFixture<ShipmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShipmentsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShipmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with an empty draft list', () => {
    expect(component).toBeTruthy();
    expect(component.cards()).toEqual([]);
  });
});
