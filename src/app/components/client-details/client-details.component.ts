import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { Client } from '../../models/models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { ClientsService } from '../../services/query-services/client.service';
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
  ],
  templateUrl: './client-details.component.html',
  styleUrl: './client-details.component.scss',
})
export class ClientDetailsComponent implements OnInit {
  @ViewChild('editClientDialog') editClientDialog!: TemplateRef<any>;

  readonly #destroyRef = inject(DestroyRef);
  readonly #clientService = inject(ClientsService);
  readonly #router = inject(Router);
  readonly dialog = inject(MatDialog);

  selectedClient: Client | null = null;

  clientForm: FormGroup | null = this.selectedClient
    ? inject(FormBuilder).group({
        id: [this.selectedClient.id],
        name: [this.selectedClient.name, Validators.required],
        type: [this.selectedClient.type, Validators.required],
        phone: [this.selectedClient.phone, Validators.required],
        address: [this.selectedClient.address],
        delivery_address: [this.selectedClient.delivery_address],
        code: [this.selectedClient.code],
        other_details: [this.selectedClient.other_details],
      })
    : null;

  ngOnInit(): void {
    if (sessionStorage.getItem('current-client')) {
      this.selectedClient = JSON.parse(
        sessionStorage.getItem('current-client')!
      );
    }
  }

  goToClientPage(): void {
    this.#router.navigate(['offer/client']);
  }

  openEditDialog(client: Client) {
    const dialogRef = this.dialog.open(EditClientDialogComponent, {
      width: '400px',
      data: { client },
    });

    dialogRef.afterClosed().subscribe((updatedClient) => {
      if (updatedClient) {
        this.#clientService.updateClient(updatedClient).subscribe(() => {});
      }
    });
  }
}
