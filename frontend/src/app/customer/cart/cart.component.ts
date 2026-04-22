import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  cartItems: any[] = [];

  constructor(
    private cart: CartService,
    private api: ApiService,
    private router: Router
  ) {
    this.cart.getItems().subscribe((res) => {
      this.cartItems = res;
    });
  }

  increase(item: any) {
    this.cart.add(item);
  }

  decrease(item: any) {
    this.cart.remove(item);
  }

  getTotal() {
    return this.cartItems.reduce((sum, item) => {
      return sum + item.price * item.qty;
    }, 0);
  }

  placeOrder() {
    if (!this.cartItems.length) return;

    navigator.geolocation.getCurrentPosition((pos) => {

      const orderData = {
        items: this.cartItems,
        totalAmount: this.getTotal(),
        location: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        },
        phone: '8155012096'
      };

      this.api.placeOrder(orderData).subscribe((res: any) => {

        localStorage.setItem('orderId', res._id);

        // Clear cart after order
        this.cart.clear();

        this.router.navigate(['/customer/track']);
      });

    });
  }
}