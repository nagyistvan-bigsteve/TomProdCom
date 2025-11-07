import { CommonModule } from '@angular/common';
import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { Client } from '../../../models/models';
import { MatListModule } from '@angular/material/list';
import { ClientsService } from '../../../services/query-services/client.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { EditClientDialogComponent } from '../edit-client-dialog/edit-client-dialog.component';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { useClientStore } from '../../../services/store/client-store';
import { take } from 'rxjs';

@Component({
  selector: 'app-client-details',
  imports: [
    CommonModule,
    TranslateModule,
    MatAccordion,
    MatExpansionModule,
    MatListModule,
    MatDialogModule,
    MatIconModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatOptionModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './client-details.component.html',
  styleUrl: './client-details.component.scss',
})
export class ClientDetailsComponent {
  @ViewChild('editClientDialog') editClientDialog!: TemplateRef<any>;

  private clientService = inject(ClientsService);
  private router = inject(Router);
  readonly dialog = inject(MatDialog);
  readonly clientStore = inject(useClientStore);

  clientForm: FormGroup | null = this.clientStore.client()
    ? inject(FormBuilder).group({
        id: [this.clientStore.client()?.id],
        name: [this.clientStore.client()?.name, Validators.required],
        type: [this.clientStore.client()?.type, Validators.required],
        phone: [this.clientStore.client()?.phone, Validators.required],
        address: [this.clientStore.client()?.address],
        code: [this.clientStore.client()?.code],
        other_details: [this.clientStore.client()?.other_details],
      })
    : null;

  goToClientPage(): void {
    this.router.navigate(['offer/client']);
  }

  openEditDialog(client: Client | null) {
    const dialogRef = this.dialog.open(EditClientDialogComponent, {
      width: '400px',
      data: { client },
    });

    dialogRef.afterClosed().subscribe((updatedClient) => {
      if (updatedClient) {
        this.clientStore.updateClient(updatedClient);
        this.clientService
          .updateClient(updatedClient)
          .pipe(take(1))
          .subscribe();
      }
    });
  }
}
