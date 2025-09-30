import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PDFFooterComponent } from './pdf-footer.component';

describe('FooterComponent', () => {
  let component: PDFFooterComponent;
  let fixture: ComponentFixture<PDFFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PDFFooterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PDFFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
