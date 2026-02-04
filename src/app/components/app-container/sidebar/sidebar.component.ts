import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { useAuthStore } from '../../../services/store/auth-store';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, TranslateModule, MatDividerModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() isOpen = false;
  @Output() closeEvent = new EventEmitter<void>();

  private router = inject(Router);
  readonly authStore = inject(useAuthStore);

  navigateTo(path: string): void {
    this.router.navigate([path]);
    this.closeSidebar();
  }

  closeSidebar(): void {
    this.closeEvent.emit();
  }
}
