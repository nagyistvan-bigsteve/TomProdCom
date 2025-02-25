import { AfterViewChecked, Component, Input } from '@angular/core';
import { ProductItem } from '../../models/models';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDividerModule } from '@angular/material/divider';
import {
  CdkDragMove,
  CdkDragRelease,
  DragDropModule,
} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-selected-product-list',
  imports: [CommonModule, TranslateModule, MatDividerModule, DragDropModule],
  templateUrl: './selected-product-list.component.html',
  styleUrl: './selected-product-list.component.scss',
})
export class SelectedProductListComponent implements AfterViewChecked {
  @Input({ required: true }) productList: ProductItem[] = [];
  dragStates: { reachedThreshold: boolean }[] = [];
  ngAfterViewChecked(): void {
    this.dragStates = this.productList.map(() => ({
      reachedThreshold: false,
    }));
  }

  private readonly DELETION_THRESHOLD = 100; // pixels to trigger deletion

  onDragMove(event: CdkDragMove, index: number) {
    const xOffset = Math.abs(event.distance.x);
    this.dragStates[index].reachedThreshold = xOffset > this.DELETION_THRESHOLD;
  }

  onDragReleased(event: CdkDragRelease, index: number) {
    const element = event.source.element.nativeElement;
    const xOffset = Math.abs(
      element.getBoundingClientRect().x - event.source.getFreeDragPosition().x
    );

    if (xOffset > this.DELETION_THRESHOLD) {
      // Delete the item
      this.productList = this.productList.filter((_, i) => i !== index);
      this.dragStates = this.dragStates.filter((_, i) => i !== index);
    } else {
      // Reset the drag position
      event.source.reset();
    }

    // Reset threshold state
    if (this.dragStates[index]) {
      this.dragStates[index].reachedThreshold = false;
    }
  }
}
