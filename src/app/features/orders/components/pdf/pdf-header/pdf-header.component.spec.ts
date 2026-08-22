import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PDFHeaderComponent } from './pdf-header.component';

describe('HeaderComponent', () => {
  let component: PDFHeaderComponent;
  let fixture: ComponentFixture<PDFHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PDFHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PDFHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
