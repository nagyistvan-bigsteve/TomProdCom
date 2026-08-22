import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WaitToApproveComponent } from './wait-to-approve.component';

describe('WaitToApproveComponent', () => {
  let component: WaitToApproveComponent;
  let fixture: ComponentFixture<WaitToApproveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaitToApproveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WaitToApproveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
