import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/services/toast.service';
import { LogoutButtonComponent } from '../../shared/ui/logout-button/logout-button.component';

@Component({
  selector: 'app-add-item',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoutButtonComponent],
  templateUrl: './add-item.component.html',
  styleUrl: './add-item.component.scss'
})
export class AddItemComponent {
  item = {
    name: '',
    price: 0,
    image: ''
  };

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) { }

  addItem() {
    if (!this.item.name || !this.item.price) {
      this.toast.error("Enter item name and price.");
      return;
    }

    this.api.addItem(this.item).subscribe({
      next: () => {
        this.toast.success("Item added to menu.");
        this.item = { name: '', price: 0, image: '' };
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? "Could not add item.";
        this.toast.error(msg);
      }
    });
  }
}
