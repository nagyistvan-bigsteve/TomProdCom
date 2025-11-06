import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
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
import { Category, Unit_id } from '../../../models/enums';
import { ClientsService } from '../../../services/query-services/client.service';
import { Router } from '@angular/router';
import { useClientStore } from '../../../services/store/client-store';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ProductUtil } from '../../../services/utils/product.util';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PDFHeaderComponent } from '../../pdf/pdf-header/pdf-header.component';
import { PDFFooterComponent } from '../../pdf/pdf-footer/pdf-footer.component';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  ],
  templateUrl: './order-details.component.html',
  styleUrl: './order-details.component.scss',
})
export class OrderDetailsComponent implements OnInit {
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
  showPrice: boolean = false;
  editMode: boolean = false;
  selectedOffer: OrderItemsResponse | null = null;

  editForm: FormGroup | null = null;
  categories: { value: Category; label: string }[] = [];

  isPrinting = signal(false);
  isLoading = signal(false);

  private readonly productStore = inject(useProductStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderService = inject(OrdersService);
  private readonly productService = inject(ProductsService);
  private readonly productUtil = inject(ProductUtil);
  private readonly clientService = inject(ClientsService);
  private readonly clientStore = inject(useClientStore);
  private readonly router = inject(Router);
  private readonly changeDetection = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private translateService = inject(TranslateService);
  private _dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  ngOnInit(): void {
    this.fetchOrderItems();
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
        contentHeightMM,
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

        const extraMargin =
          rowHeightMM +
          2.5 -
          (availableHeight - dataContainerHeightMM) /
            (this.orderItems!.length + 2);

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

      // Convert PDF to blob and open print dialog
      const pdfBlob = pdf.output('blob');

      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Open in new window/tab and trigger print
      const printWindow = window.open(pdfUrl, '_blank');

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();

          // Clean up after printing
          printWindow.onafterprint = () => {
            URL.revokeObjectURL(pdfUrl);
            printWindow.close();
          };
        };
      } else {
        // Fallback: if popup blocked, download the PDF
        const orderType = this.justOffers ? 'offer' : 'order';
        const filename = `${orderType}_#${this.order?.id}.pdf`;
        pdf.save(filename);

        alert(
          'Popup blocked. PDF downloaded instead. Please allow popups for direct printing.'
        );
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
    contentHeightMM: number;
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
      contentHeightMM,
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

  editItem(item: OrderItemsResponse, order: OrderResponse) {
    this.productService.getProductsByIds([item.product.id]).then((product) => {
      if (product) {
        this.productService
          .getPrices(product[0])
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((prices) => {
            this.categories = prices.map((value) => ({
              value: value.category_id,
              label: Category[value.category_id],
            }));

            this.selectedOffer = item;
            this.openEditDialog(order, item, product[0], prices);
          });
      }
    });
  }

  openEditDialog(
    order: OrderResponse,
    item: OrderItemsResponse,
    product: Product,
    prices: Price2[]
  ): void {
    this.editForm = this.fb.group({
      quantity: [item.quantity, [Validators.required, Validators.min(0)]],
      category: [this.getCategoryId(item.category.name), Validators.required],
    });

    const dialogRef = this._dialog.open(this.editOfferDialog, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          const price = prices.find(
            (price) => price.category_id === this.editForm?.value.category
          )!.price;
          const newPrice = this.productUtil.calculatePrice(
            product,
            price,
            this.editForm?.value.quantity,
            true
          );

          const category = this.editForm?.value.category;
          const quantity = +this.editForm?.value.quantity;

          const newOrderPrice = order.totalAmount - item.price + newPrice.price;
          let newOrderPriceFinal = newOrderPrice;

          const { unit_id, width, thickness, length } = product;

          let totalQuantity = order.totalQuantity;

          if (unit_id !== Unit_id.M2 && unit_id !== Unit_id.BUC) {
            const volumeM3 = (width * thickness * length) / 1_000_000;
            const multiplier = unit_id === Unit_id.BOUNDLE ? 10 : 1;

            totalQuantity =
              totalQuantity - item.quantity * volumeM3 * multiplier;
            totalQuantity = totalQuantity + quantity * volumeM3 * multiplier;
          }

          if (order.voucher && order.voucher.includes('%')) {
            const discountPercent =
              parseFloat(order.voucher.replace('%', '')) / 100;
            newOrderPriceFinal -= newOrderPrice * discountPercent;
          } else {
            const discountValue = parseFloat(order.voucher);
            if (!isNaN(discountValue)) {
              newOrderPriceFinal -= discountValue;
            }
          }

          if (product.unit_id === Unit_id.M2) {
            const packsPieces =
              (newPrice.packsNeeded ? `${newPrice.packsNeeded}p` : '') +
              (newPrice.extraPiecesNeeded
                ? ` + ${newPrice.extraPiecesNeeded}b`
                : '');

            this.orderService
              .editOrderItem(
                item.id,
                order.id,
                {
                  category_id: category,
                  quantity: newPrice.totalPiecesNeeded * (product.m2_brut / 10),
                  packs_pieces: packsPieces,
                  price: newPrice.price,
                },
                {
                  total_amount: newOrderPrice,
                  total_amount_final: newOrderPriceFinal,
                }
              )
              .then((response) => {
                if (response) {
                  this.fetchOrderItems();
                }
              });
          } else {
            this.orderService
              .editOrderItem(
                item.id,
                order.id,
                {
                  category_id: category,
                  quantity,
                  price: newPrice.price,
                },
                {
                  total_quantity: totalQuantity,
                  total_amount: newOrderPrice,
                  total_amount_final: newOrderPriceFinal,
                }
              )
              .then((response) => {
                if (response) {
                  this.fetchOrderItems();
                }
              });
          }
          this.selectedOffer = null;
        }
      });
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

  getCategoryId(name: string): number {
    return Category[name as keyof typeof Category];
  }

  getTotalMQ(item: OrderItemsResponse): string {
    if (item.packsPieces) {
      return '-';
    }

    if (item.product.width) {
      let quntity = new Intl.NumberFormat('en-US', {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }).format(
        ((item.product.width * item.product.thickness * item.product.length) /
          1000000) *
          item.quantity
      );

      return quntity + 'm³';
    } else {
      return item.quantity + 'm³';
    }
  }
}
