import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit {

  items: any[] = [];
  filteredItems: any[] = [];

  searchText: string = '';
  selectedCategory: string = 'all';

  categories: string[] = ['all', 'dosa', 'pizza', 'burger'];

  cartCount: number = 0;
  quantities: { [key: string]: number } = {};

  constructor(private api: ApiService, private cart: CartService) { }

  ngOnInit() {
    this.api.getItems().subscribe((res: any) => {
      this.items = res;

      // Initialize quantities
      res.forEach((item: any) => {
        this.quantities[item._id] = 0;
      });

      this.applyFilter();
    });

    // Cart count (update based on your service)
    this.cart.getItems().subscribe((items: any[]) => {
      this.cartCount = items.reduce((sum, i) => sum + i.qty, 0);
    });
  }

  applyFilter() {
    this.filteredItems = this.items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(this.searchText.toLowerCase());
      const matchCategory = this.selectedCategory === 'all' || item.category === this.selectedCategory;
      return matchSearch && matchCategory;
    });
  }

  increase(item: any) {
    this.quantities[item._id]++;
    this.cart.add(item);
  }

  decrease(item: any) {
    if (this.quantities[item._id] > 0) {
      this.quantities[item._id]--;
      this.cart.remove(item); // make sure remove method exists
    }
  }
}