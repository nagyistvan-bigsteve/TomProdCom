import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfferOverviewPageComponent } from './offer-overview-page.component';

describe('OfferOverviewPageComponent', () => {
  let component: OfferOverviewPageComponent;
  let fixture: ComponentFixture<OfferOverviewPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfferOverviewPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfferOverviewPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
