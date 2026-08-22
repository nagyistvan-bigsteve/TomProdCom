import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateComingWaresDialogComponent } from './create-coming-wares-dialog.component';

describe('CreateComingWaresComponent', () => {
  let component: CreateComingWaresDialogComponent;
  let fixture: ComponentFixture<CreateComingWaresDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateComingWaresDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateComingWaresDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
