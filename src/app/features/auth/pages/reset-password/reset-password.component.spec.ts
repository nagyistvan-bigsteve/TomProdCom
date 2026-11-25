import { ComponentFixture, TestBed } from '@angular/core/testing';

import { hasRecoveryParams, ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers the way back to login when opened without a recovery link', async () => {
    // The test URL has no ?code= / #access_token= and there is no session
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(component.linkMissing()).toBe(true);
    expect(fixture.nativeElement.querySelector('.back-btn')).toBeTruthy();
  });
});

describe('hasRecoveryParams', () => {
  it('sees a PKCE code or an implicit access token', () => {
    expect(hasRecoveryParams('?code=abc', '')).toBe(true);
    expect(hasRecoveryParams('', '#access_token=x&type=recovery')).toBe(true);
  });

  it('counts a refused link or no link as missing', () => {
    expect(hasRecoveryParams('', '')).toBe(false);
    expect(hasRecoveryParams('?error=access_denied&code=abc', '')).toBe(false);
    expect(hasRecoveryParams('', '#error=otp_expired')).toBe(false);
  });
});
