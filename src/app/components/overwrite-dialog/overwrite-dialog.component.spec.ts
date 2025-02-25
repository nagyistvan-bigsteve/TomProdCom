import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverwriteDialogComponent } from './overwrite-dialog.component';

describe('OverwriteDialogComponent', () => {
  let component: OverwriteDialogComponent;
  let fixture: ComponentFixture<OverwriteDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverwriteDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OverwriteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
