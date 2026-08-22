import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComingWaresDetailsComponent } from './coming-wares-details.component';

describe('ComingWaresDetailsComponent', () => {
  let component: ComingWaresDetailsComponent;
  let fixture: ComponentFixture<ComingWaresDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComingWaresDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComingWaresDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
