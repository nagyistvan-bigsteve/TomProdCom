import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangePricesComponent } from './change-prices.component';

describe('ChangePricesComponent', () => {
  let component: ChangePricesComponent;
  let fixture: ComponentFixture<ChangePricesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangePricesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChangePricesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
