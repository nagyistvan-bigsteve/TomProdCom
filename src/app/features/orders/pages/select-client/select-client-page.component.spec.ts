import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectClientPageComponent } from './select-client-page.component';

describe('SelectClientPageComponent', () => {
  let component: SelectClientPageComponent;
  let fixture: ComponentFixture<SelectClientPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectClientPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectClientPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
