import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ComingWaresService } from '../../../services/query-services/coming-wares.service';
import { ComingWaresItemResponse } from '../../../models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { ENTER_AND_LEAVE_ANIMATION } from '../../../models/animations';
import { ProductsService } from '../../../services/query-services/products.service';
import { Category } from '../../../models/enums';
import { StocksService } from '../../../services/query-services/stocks.service';

@Component({
  selector: 'app-coming-wares-details',
  imports: [
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatDividerModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
    MatDialogModule,
    MatFormFieldModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
  ],
  templateUrl: './coming-wares-details.component.html',
  styleUrl: './coming-wares-details.component.scss',
  animations: ENTER_AND_LEAVE_ANIMATION,
})
export class ComingWaresDetailsComponent {
  @ViewChild('commentDialog') commentDialogTemplate!: TemplateRef<any>;
  @ViewChild('confirmDeleteDialog') confirmDeleteTemplate!: TemplateRef<any>;
  @ViewChild('confirmSubmitDialog') confirmSubmitTemplate!: TemplateRef<any>;

  id = signal(0);
  isVerified = signal(false);
  isLoading = signal(true);
  commentText = signal('');
  selectedItemId = signal<number | null>(null);

  comingWaresItems = signal<ComingWaresItemResponse[]>([]);
  readonly #location = inject(Location);
  readonly #route = inject(ActivatedRoute);
  readonly #comingWaresService = inject(ComingWaresService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #dialog = inject(MatDialog);
  readonly #stocksService = inject(StocksService);

  itemsForOrder = computed(() =>
    this.comingWaresItems()
      .filter((item) => item.for_order)
      .sort((a, b) => a.id - b.id),
  );

  itemsForStock = computed(() =>
    this.comingWaresItems()
      .filter((item) => !item.for_order)
      .sort((a, b) => a.id - b.id),
  );

  ngOnInit(): void {
    this.isLoading.set(true);
    this.id.set(+this.#route.snapshot.paramMap.get('id')!);
    this.isVerified.set(
      this.#route.snapshot.paramMap.get('verified')! === 'true',
    );

    this.#comingWaresService
      .getComingWaresItemsById(this.id())
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((items) => {
        this.isLoading.set(false);
        this.comingWaresItems.set(items);
      });
  }

  submitWares(): void {
    const dialogRef = this.#dialog.open(this.confirmSubmitTemplate, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.#comingWaresService.verifyComingWares(this.id()).then(() => {
            this.comingWaresItems().forEach((item) => {
              if (!item.for_order && item.is_correct) {
                this.#stocksService.addToProductStock(
                  item.product.id,
                  item.quantity,
                );
              }
            });

            this.#location.back();
          });
        }
      });
  }

  deleteWares(): void {
    const dialogRef = this.#dialog.open(this.confirmDeleteTemplate, {
      width: '300px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((result) => {
        if (result === true) {
          this.#comingWaresService.deleteComingWares(this.id()).then(() => {
            this.#location.back();
          });
        }
      });
  }

  cycleStatus(item: any) {
    let isCorrect: boolean | null = null;
    if (item.is_correct === null) {
      isCorrect = true;
    } else if (item.is_correct === true) {
      isCorrect = false;
    } else {
      isCorrect = null;
    }

    this.commentText.set(item.comment);
    this.updateItemStatus(item.id, isCorrect);
  }

  updateItemStatus(id: number, isCorrect: boolean | null): void {
    this.#comingWaresService.itemIsCorrect(id, isCorrect);

    if (isCorrect === false) {
      this.selectedItemId.set(id);
      this.openCommentDialog();
    }

    this.comingWaresItems.update((currentItems) =>
      currentItems.map((item) =>
        item.id === id ? { ...item, is_correct: isCorrect } : item,
      ),
    );
  }

  saveComment(dialogRef: MatDialogRef<any>): void {
    this.#comingWaresService
      .addCommentOnItem(this.selectedItemId()!, this.commentText())
      .then((response) => {
        if (response) {
          this.comingWaresItems.update((currentItems) =>
            currentItems.map((item) =>
              item.id === this.selectedItemId()
                ? { ...item, comment: this.commentText() }
                : item,
            ),
          );
        }

        this.commentText.set('');
        this.selectedItemId.set(null);
      });

    dialogRef.close();
  }

  openCommentDialog(): void {
    this.#dialog.open(this.commentDialogTemplate, {
      data: {},
      disableClose: true,
    });
  }

  isAnyItemUnset(): boolean {
    return this.comingWaresItems().some((item) => item.is_correct === null);
  }
}
