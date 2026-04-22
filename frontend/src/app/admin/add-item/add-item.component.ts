import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-item',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-item.component.html',
  styleUrl: './add-item.component.scss'
})
export class AddItemComponent {
  item = {
    name: '',
    price: 0,
    image: ''
  };

  constructor(private api: ApiService) { }

  addItem() {
    if (!this.item.name || !this.item.price) {
      alert("Enter all fields");
      return;
    }

    this.api.addItem(this.item).subscribe(() => {
      alert("✅ Item Added");
      this.item = { name: '', price: 0, image: '' };
    });
  }
}
