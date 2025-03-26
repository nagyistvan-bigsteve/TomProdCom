import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedProductListComponent } from './selected-product-list.component';

describe('SelectedProductListComponent', () => {
  let component: SelectedProductListComponent;
  let fixture: ComponentFixture<SelectedProductListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectedProductListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectedProductListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
