import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComingWaresComponent } from './coming-wares.component';

describe('ComingProductsComponent', () => {
  let component: ComingWaresComponent;
  let fixture: ComponentFixture<ComingWaresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComingWaresComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComingWaresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
