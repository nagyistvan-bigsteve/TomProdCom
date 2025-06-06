import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApproveUserComponent } from './approve-user.component';

describe('ApproveUserComponent', () => {
  let component: ApproveUserComponent;
  let fixture: ComponentFixture<ApproveUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApproveUserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApproveUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
