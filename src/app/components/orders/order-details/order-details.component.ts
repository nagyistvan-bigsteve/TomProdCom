import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {
  OrderItemsResponse,
  OrderResponse,
  Price2,
  Product,
  ProductItems,
  Products,
} from '../../../models/models';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { OrdersService } from '../../../services/query-services/orders.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { useProductStore } from '../../../services/store/product-store';
import { ProductsService } from '../../../services/query-services/products.service';
import { Category, ClientType, Unit_id } from '../../../models/enums';
import { ClientsService } from '../../../services/query-services/client.service';
import { Router } from '@angular/router';
import { useClientStore } from '../../../services/store/client-store';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ProductUtil } from '../../../services/utils/product.util';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PDFHeaderComponent } from '../../pdf/pdf-header/pdf-header.component';
import { PDFFooterComponent } from '../../pdf/pdf-footer/pdf-footer.component';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FilterUtil } from '../../../services/utils/filter.util';

@Component({
  selector: 'app-order-details',
  imports: [
    MatIconModule,
    MatButtonModule,
    CommonModule,
    MatDividerModule,
    TranslateModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PDFHeaderComponent,
    PDFFooterComponent,
    MatChipsModule,
    MatAutocompleteModule,
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
  @ViewChild('input') input: ElementRef<HTMLInputElement> | null = null;
  @ViewChild('confirmDeliveredDialog')
  confirmDeliveredDialog!: TemplateRef<any>;
  @ViewChild('confirmTransformOfferDialog')
  confirmTransformOfferDialog!: TemplateRef<any>;
  @ViewChild('confirmTransformExactOfferDialog')
  confirmTransformExactOfferDialog!: TemplateRef<any>;
  @ViewChild('editOfferDialog')
  editOfferDialog!: TemplateRef<any>;

  @Output() closeDetails = new EventEmitter<void>();

  @Input() order: OrderResponse | undefined;
  @Input() justOffers: boolean = false;

  orderItems: OrderItemsResponse[] | undefined;
  deleteOffer: boolean = false;
  selectedOffer: OrderItemsResponse | null = null;

  selectedCategory: Category = Category.A;
  categoryEnum = Category;
  myControl = new FormControl('');

  selectedProduct: any = {
    id: null,
    name: '',
    unit_id: null,
    size_id: null,
    length: null,
    thickness: null,
    width: null,
    m2_brut: null,
    m2_util: null,
    piece_per_pack: null,
  };
  isProductSelectet: boolean = false;
  products: Products = [];
  filteredOptions: Products = [];
  selectedProductQuantity: number = 1;
  selectedProductPrice: Price2[] | undefined;
  enableCategory: { enable: boolean; category: Category }[] = [
    { enable: false, category: Category.A },
    {
      enable: false,
      category: Category.AB,
    },
    {
      enable: false,
      category: Category.B,
    },
    {
      enable: false,
      category: Category.T,
    },
  ];
  isPrinting = signal(false);
  isLoading = signal(false);

  orderComment: string = '';

  private readonly productStore = inject(useProductStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderService = inject(OrdersService);
  private readonly productService = inject(ProductsService);
  private readonly productUtil = inject(ProductUtil);
  private readonly clientService = inject(ClientsService);
  private readonly clientStore = inject(useClientStore);
  private readonly router = inject(Router);
  private readonly changeDetection = inject(ChangeDetectorRef);
  private filterUtil = inject(FilterUtil);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private _dialog = inject(MatDialog);

  ngOnInit(): void {
    this.fetchOrderItems();
    this.fetchProducts();
    this.orderComment = this.order!.comment;
  }

  fetchProducts(): void {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.products = products;
      });
  }

  fetchOrderItems(): void {
    this.orderService
      .getOrderItemsById(this.order?.id as number)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orderItems) => {
        this.orderItems = orderItems.sort((a, b) => a.id - b.id);
      });
  }

  callNumber(phone: string) {
    window.location.href = `tel:${phone}`;
  }

  openInMapsApp(address: string) {
    window.location.href = `geo:0,0?q=${encodeURIComponent(address)}`;
  }

  async print() {
    try {
      this.isLoading.set(true);
      this.isPrinting.set(true);
      this.changeDetection.detectChanges();

      const {
        headerElement,
        contentElement,
        footerElement,
        dataContainerElement,
        tableElement,
      } = await this.getPdfElements();

      const {
        headerCanvas,
        contentCanvas,
        footerCanvas,
        dataContainerCanvas,
        tableCanvas,
      } = await this.capturePrintElements(
        headerElement,
        contentElement,
        footerElement,
        dataContainerElement,
        tableElement
      );

      const {
        pdfWidth,
        pdfHeight,
        margin,
        headerHeightMM,
        footerHeightMM,
        availableHeight,
        contentWidthMM,
        totalPages,
        dataContainerHeightMM,
        tableHeightMM,
      } = this.createPDFDimensions(
        headerCanvas,
        contentCanvas,
        footerCanvas,
        dataContainerCanvas,
        tableCanvas
      );

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const headerImgData = headerCanvas.toDataURL('image/png');
      const footerImgData = footerCanvas.toDataURL('image/png');

      // Add pages
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (pageNum > 1) {
          pdf.addPage();
        }

        // Add header
        pdf.addImage(headerImgData, 'PNG', 0, 0, pdfWidth, headerHeightMM);

        const rowHeightMM =
          (tableHeightMM - 2.5) / (this.orderItems!.length + 2);

        let extraMargin =
          rowHeightMM +
          2.5 -
          (availableHeight - dataContainerHeightMM) /
            (this.orderItems!.length + 2);

        if (availableHeight >= tableHeightMM + dataContainerHeightMM) {
          extraMargin = 0;
        }

        // Calculate content position for this page
        const contentYOffset = (pageNum - 1) * availableHeight - extraMargin;
        const sourceY = (contentYOffset * contentCanvas.width) / contentWidthMM;
        const sourceHeight =
          (availableHeight * contentCanvas.width) / contentWidthMM;

        // Create a temporary canvas for this page's content slice
        const pageCanvas = document.createElement('canvas');
        const ctx = pageCanvas.getContext('2d');

        pageCanvas.width = contentCanvas.width;
        pageCanvas.height = Math.min(
          sourceHeight,
          contentCanvas.height - sourceY
        );

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

          ctx.drawImage(
            contentCanvas,
            0,
            sourceY,
            contentCanvas.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
          );

          const pageContentImg = pageCanvas.toDataURL('image/png');
          const pageContentHeight =
            (pageCanvas.height * contentWidthMM) / pageCanvas.width;

          // Add content for this page
          pdf.addImage(
            pageContentImg,
            'PNG',
            margin,
            headerHeightMM - 7.5,
            contentWidthMM,
            pageContentHeight
          );
        }

        // Add footer
        const footerY = pdfHeight - footerHeightMM - margin;
        pdf.addImage(
          footerImgData,
          'PNG',
          margin,
          footerY,
          pdfWidth - margin * 2,
          footerHeightMM
        );

        // Add page number in bottom right corner
        pdf.setFontSize(15);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `${pageNum}/${totalPages}`,
          pdfWidth - margin - 15,
          pdfHeight - margin - 3,
          { align: 'right' }
        );
      }

      // Detect if iOS/Safari
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );

      if (isIOS || isSafari) {
        // For iOS/Safari: Use native share/print
        this.printPDFiOS(pdf);
      } else {
        // For other browsers: Use iframe method
        this.printPDFStandard(pdf);
      }

      this.isPrinting.set(false);
      this.changeDetection.detectChanges();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      this.isLoading.set(false);
      this.isPrinting.set(false);
      this.changeDetection.detectChanges();
    }
  }

  private printPDFiOS(pdf: jsPDF) {
    // For iOS: Open PDF in new tab (iOS will show native share/print options)
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Open in new window - iOS will handle it natively
    const printWindow = window.open(pdfUrl, '_blank');

    if (!printWindow) {
      // Fallback: download if popup blocked
      const orderType = this.justOffers ? 'offer' : 'order';
      const filename = `${orderType}_${
        this.order?.id
      }_${new Date().getTime()}.pdf`;
      pdf.save(filename);
    }

    // Cleanup after delay (user should have opened it by then)
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 10000);
  }

  private printPDFStandard(pdf: jsPDF) {
    // Convert PDF to blob and open print dialog
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Create hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    iframe.onload = () => {
      // Give the PDF time to load in the iframe
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          // Clean up after a delay (to allow print dialog to open)
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(pdfUrl);
          }, 120000);
        } catch (error) {
          console.error('Print error:', error);
          // Fallback: download the PDF
          document.body.removeChild(iframe);
          URL.revokeObjectURL(pdfUrl);

          const orderType = this.justOffers ? 'offer' : 'order';
          const filename = `${orderType}_#${this.order?.id}.pdf`;
          pdf.save(filename);

          alert('Could not open print dialog. PDF downloaded instead.');
        }
      }, 250);
    };

    iframe.src = pdfUrl;
  }

  private async getPdfElements(): Promise<{
    headerElement: HTMLElement;
    contentElement: HTMLElement;
    footerElement: HTMLElement;
    dataContainerElement: HTMLElement;
    tableElement: HTMLElement;
  }> {
    await this.delay(500);

    const headerElement = document.getElementById('print-header');
    const contentElement = document.getElementById('print-content');
    const footerElement = document.getElementById('print-footer');
    const dataContainerElement = document.querySelector(
      '.data-container'
    ) as HTMLElement;
    const tableElement = document.querySelector(
      '.table-breaked'
    ) as HTMLElement;

    if (
      !headerElement ||
      !contentElement ||
      !footerElement ||
      !dataContainerElement ||
      !tableElement
    ) {
      throw new Error('Required elements not found');
    }

    return {
      headerElement,
      contentElement,
      footerElement,
      dataContainerElement,
      tableElement,
    };
  }

  private async capturePrintElements(
    headerElement: HTMLElement,
    contentElement: HTMLElement,
    footerElement: HTMLElement,
    dataContainerElement: HTMLElement,
    tableElement: HTMLElement
  ): Promise<{
    headerCanvas: HTMLCanvasElement;
    contentCanvas: HTMLCanvasElement;
    footerCanvas: HTMLCanvasElement;
    dataContainerCanvas: HTMLCanvasElement;
    tableCanvas: HTMLCanvasElement;
  }> {
    const headerCanvas = await html2canvas(headerElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const footerCanvas = await html2canvas(footerElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const contentCanvas = await html2canvas(contentElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const dataContainerCanvas = await html2canvas(dataContainerElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const tableCanvas = await html2canvas(tableElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    return {
      headerCanvas,
      contentCanvas,
      footerCanvas,
      dataContainerCanvas,
      tableCanvas,
    };
  }

  private createPDFDimensions(
    headerCanvas: HTMLCanvasElement,
    contentCanvas: HTMLCanvasElement,
    footerCanvas: HTMLCanvasElement,
    dataContainerCanvas: HTMLCanvasElement,
    tableCanvas: HTMLCanvasElement
  ): {
    pdfWidth: number;
    pdfHeight: number;
    margin: number;
    headerHeightMM: number;
    footerHeightMM: number;
    availableHeight: number;
    contentWidthMM: number;
    totalPages: number;
    dataContainerHeightMM: number;
    tableHeightMM: number;
  } {
    // A4 dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;

    // Calculate header and footer heights in mm
    const headerHeightMM =
      (headerCanvas.height * pdfWidth) / headerCanvas.width;
    const footerHeightMM =
      (footerCanvas.height * pdfWidth) / footerCanvas.width;

    // Available content height per page
    const availableHeight =
      pdfHeight - headerHeightMM - footerHeightMM - margin;

    // Calculate content dimensions
    const contentWidthMM = pdfWidth - margin * 2;
    const contentHeightMM =
      (contentCanvas.height * contentWidthMM) / contentCanvas.width;

    const dataContainerHeightMM =
      (dataContainerCanvas.height * contentWidthMM) / dataContainerCanvas.width;

    const tableHeightMM =
      (tableCanvas.height * contentWidthMM) / tableCanvas.width;

    // Calculate number of pages needed
    const totalPages = Math.ceil(contentHeightMM / availableHeight);

    return {
      pdfWidth,
      pdfHeight,
      margin,
      headerHeightMM,
      footerHeightMM,
      availableHeight,
      contentWidthMM,
      totalPages,
      dataContainerHeightMM,
      tableHeightMM,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  translate(key: string, params?: any): string {
    return this.translateService.instant(key, params);
  }

  closeDetailsComponent() {
    this.closeDetails.emit();
  }

  openEditDialog(): void {
    const dialogRef = this._dialog.open(this.editOfferDialog, {
      width: '350px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.updateOrderComment(this.orderComment);
        }
      });
  }

  addOrderItem(): void {
    const { price, packsNeeded, extraPiecesNeeded, totalPiecesNeeded } =
      this.productUtil.calculatePrice(
        this.selectedProduct,
        this.findExistingCategories()!,
        this.selectedProductQuantity,
        true
      );

    let packsPieces = '';

    if (totalPiecesNeeded) {
      packsPieces =
        packsNeeded || extraPiecesNeeded
          ? (packsNeeded ? packsNeeded + 'p' : '0p') +
            (extraPiecesNeeded ? ' + ' + extraPiecesNeeded + 'b' : '')
          : '';

      this.selectedProductQuantity =
        totalPiecesNeeded *
        (this.selectedProduct.m2_brut / this.selectedProduct.piece_per_pack);
    }

    this.orderService
      .addOrderItem(this.order!, {
        product: this.selectedProduct,
        orderId: this.order!.id,
        quantity: this.selectedProductQuantity,
        category: { name: this.selectedCategory.toString() },
        price,
        packsPieces,
      })
      .then((result) => {
        if (result) {
          this.fetchOrderItems();
          setTimeout(() => {
            const total = this.getUpdateOrderTotals();
            this.orderService.updateOrderTotals(
              this.order!.id,
              total.totalAmount,
              total.totalAmountFinal,
              total.totalQuantity
            );
          }, 250);
        }
      });
  }

  deleteOrderItem(item: OrderItemsResponse): void {
    this.orderService.deleteOrderItem(item).then((result) => {
      if (result) {
        this.fetchOrderItems();
        setTimeout(() => {
          const total = this.getUpdateOrderTotals();
          this.orderService.updateOrderTotals(
            this.order!.id,
            total.totalAmount,
            total.totalAmountFinal,
            total.totalQuantity
          );
        }, 250);
      }
    });
  }

  optionSelected(product: Product): void {
    this.isProductSelectet = true;
    this.selectedProduct = product;

    this.productService
      .getPrices(product)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((prices) => {
        if (prices) {
          this.selectedProductPrice = prices;
          this.findExistingCategories();
        }
      });
  }

  findExistingCategories(): undefined | number {
    const isClientPJ: boolean = this.order?.client.type === ClientType.PJ;

    if (!this.selectedProductPrice || !this.selectedProductPrice!.length) {
      return;
    }

    this.enableCategory.forEach((categoryItem) => {
      categoryItem.enable = this.selectedProductPrice!.find(
        (price) => price.category_id === categoryItem.category
      )?.price
        ? true
        : false;
    });

    const price = this.selectedProductPrice!.find(
      (price) => price.category_id === this.selectedCategory
    );

    if (price) {
      if (isClientPJ) {
        if (price.product_id) {
          if (price.unit_id === Unit_id.BOUNDLE) {
            return price.price - 5;
          }
          if (price.unit_id === Unit_id.M3) {
            return price.price - 100;
          }
        } else {
          if (price.unit_id === Unit_id.M3) {
            return price.price - 100;
          }
        }
      }
      return price?.price ? price.price : undefined;
    }
    return undefined;
  }

  filter(): void {
    this.filteredOptions = this.filterUtil.productFilter(
      this.input,
      this.products
    );
  }

  displayProductLabel(product: Product): string {
    return product ? product.name : '';
  }

  private updateOrderComment(newComment: string) {
    this.orderService.updateOrderComment(this.order!.id, newComment);
  }

  updateItemStatus(id: number, status: boolean, index: number) {
    this.orderService.orderItemStatusUpdate(id, status).then((status) => {
      if (!status) {
        this.translateService
          .get(['SNACKBAR.GENERAL.UPDATE_ERROR', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.GENERAL.UPDATE_ERROR'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 }
            );
          });
        return;
      }
      this.orderItems![index].itemStatus = status;
    });
  }

  transformExactOfferToOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmTransformExactOfferDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.orderService.transformOfferToOrder(order.id).then(() => {
            this.router.navigate(['orders']);
          });
        }
      });
  }

  transformOfferToOrder(order: OrderResponse): void {
    const dialogRef = this._dialog.open(this.confirmTransformOfferDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          const productIds: number[] = this.orderItems!.map(
            (item) => item.product.id
          );
          this.clientService.getClientById(order.client.id).then((client) => {
            if (!client) {
              return;
            }
            this.productService
              .getProductsByIds(productIds)
              .then((products) => {
                if (!products) {
                  return;
                }
                const productItems: ProductItems = this.orderItems!.map(
                  (item) => {
                    return {
                      product: products.find(
                        (product) => product.id === item.product.id
                      )!,
                      quantity: item.quantity,
                      price: item.price,
                      category:
                        Category[item.category.name as keyof typeof Category],
                    };
                  }
                );
                this.clientStore.setClient(client);
                this.productStore.setProductItems(productItems);
                if (this.deleteOffer) {
                  this.orderService.deleteOrder(order.id);
                }
                this.router.navigate(['offer/overview']);
              });
          });
        }
      });
  }

  confirmDelivered(id: number): void {
    const dialogRef = this._dialog.open(this.confirmDeliveredDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.orderIsDelivered(id);
        }
      });
  }

  orderIsDelivered(id: number) {
    this.orderService.orderIsDelivered(id).then((status) => {
      if (status) {
        this.translateService
          .get(['SNACKBAR.ORDER.UPDATE_SUCCESS', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.ORDER.UPDATE_SUCCESS'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 }
            );
          });
        this.closeDetails.emit();
      } else {
        this.translateService
          .get(['SNACKBAR.GENERAL.UPDATE_ERROR', 'SNACKBAR.BUTTONS.CLOSE'])
          .subscribe((translations) => {
            this.snackBar.open(
              translations['SNACKBAR.GENERAL.UPDATE_ERROR'],
              translations['SNACKBAR.BUTTONS.CLOSE'],
              { duration: 3000 }
            );
          });
      }
    });
  }

  isPercentageVoucher(voucher: string): boolean {
    return voucher.includes('%');
  }

  private getUpdateOrderTotals(): {
    totalAmount: number;
    totalAmountFinal: number;
    totalQuantity: number;
  } {
    let totalQuantity = 0;
    let totalAmount = 0;

    this.orderItems?.forEach((item) => {
      totalAmount += item.price;
      totalQuantity +=
        item.product.unit_id !== Unit_id.M2 ? this.getTotalMQ(item) : 0;
    });

    let totalAmountFinal = totalAmount;

    if (this.order?.voucher) {
      totalAmountFinal = this.getVoucher(totalAmount);
    }

    return { totalAmount, totalAmountFinal, totalQuantity };
  }

  getVoucher(totalAmount: number): number {
    let total = totalAmount;
    if (this.order?.voucher.includes('-')) {
      this.order.voucher = this.order?.voucher.replace('-', '');
    }
    if (this.order?.voucher.includes('%')) {
      const discountPercent =
        parseFloat(this.order.voucher.replace('%', '')) / 100;
      total -= total * discountPercent;
    } else {
      const discountValue = parseFloat(this.order!.voucher);
      if (!isNaN(discountValue)) {
        total -= discountValue;
      }
    }

    return total;
  }

  getCategoryId(name: string): number {
    return Category[name as keyof typeof Category];
  }

  getTotalMQ(item: OrderItemsResponse): number {
    if (item.packsPieces) {
      return 0;
    }

    if (item.product.width) {
      let quntity = +new Intl.NumberFormat('en-US', {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }).format(
        ((item.product.width * item.product.thickness * item.product.length) /
          1000000) *
          item.quantity
      );

      if (item.product.unit_id === Unit_id.BOUNDLE) {
        quntity = quntity * 10;
      }

      return quntity;
    } else {
      return item.quantity;
    }
  }
}
