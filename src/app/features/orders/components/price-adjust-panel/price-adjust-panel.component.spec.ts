import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { Category, Size_id, Unit_id } from '@core/models/enums';
import { PriceRow } from '@features/orders/store/order-details/order-price-rows';
import { PriceAdjustPanelComponent } from './price-adjust-panel.component';

describe('PriceAdjustPanelComponent', () => {
  let fixture: ComponentFixture<PriceAdjustPanelComponent>;
  let component: PriceAdjustPanelComponent;

  const general: PriceRow = {
    unit: Unit_id.M3,
    category: Category.A,
    size: Size_id.NORMAL,
    price: 1500,
    discount: -100,
  };
  const product: PriceRow = { ...general, productId: 7, discount: 0 };
  const mixed: PriceRow = { ...general, category: Category.B, mixed: true, discount: 0 };

  function render(rows: PriceRow[], perProduct = false) {
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('perProduct', perProduct);
    fixture.componentRef.setInput('productNames', { 7: '2.5x15x400' });
    fixture.detectChanges();
  }

  const priceRows = () =>
    fixture.nativeElement.querySelectorAll('.price-row') as NodeListOf<HTMLElement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceAdjustPanelComponent, TranslateModule.forRoot()],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(PriceAdjustPanelComponent);
    component = fixture.componentInstance;
  });

  it('shows every row when per product is off', () => {
    render([general, product]);
    expect(priceRows().length).toBe(2);
  });

  it('shows only product rows when per product is on', () => {
    render([general, product], true);
    expect(priceRows().length).toBe(1);
    expect(priceRows()[0].textContent).toContain('2.5x15x400');
  });

  it('shows the final price and leaves the input empty for a mixed row', () => {
    render([general, mixed]);
    const inputs = fixture.nativeElement.querySelectorAll('input[type=number]');

    expect(priceRows()[0].querySelector('.final')?.textContent).toContain('1,400.00');
    expect(priceRows()[1].querySelector('.mixed-info')).not.toBeNull();
    expect(priceRows()[1].querySelector('.final')).toBeNull();

    return fixture.whenStable().then(() => {
      expect((inputs[1] as HTMLInputElement).value).toBe('');
    });
  });

  it('emits the row index and the typed price', () => {
    render([general, product]);
    const emitted: { index: number; price: number | null }[] = [];
    component.finalPriceChange.subscribe((e) => emitted.push(e));

    const input = fixture.nativeElement.querySelectorAll('input[type=number]')[1] as HTMLInputElement;
    input.value = '1250';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual([{ index: 1, price: 1250 }]);
  });

  it('emits when the per product checkbox is toggled', () => {
    render([general]);
    let toggled = 0;
    component.perProductChange.subscribe(() => toggled++);

    (fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement).click();

    expect(toggled).toBe(1);
  });
});
