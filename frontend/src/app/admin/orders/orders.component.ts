import { Component, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {
  orders: any[] = [];

  constructor(private api: ApiService, private socket: SocketService) { }

  ngOnInit() {
    this.load();

    this.socket.listen('new-order-admin', () => {
      this.load(); // auto refresh
    });

    this.socket.listen('order-updated', (updatedOrder: any) => {
      const index = this.orders.findIndex(o => o._id === updatedOrder._id);

      if (index > -1) {
        this.orders[index] = updatedOrder; // ✅ realtime update
      } else {
        this.orders.unshift(updatedOrder);
      }
    });
  }

  load() {
    this.api.getOrders().subscribe((res: any) => {
      this.orders = res;
    });
  }

  update(order: any, status: string) {
    this.api.updateOrder(order._id, status).subscribe(() => {

    });
  }

  // 🚴 ASSIGN DELIVERY
  assign(order: any) {

    const deliveryBoyId = prompt('Enter Delivery Boy ID');

    if (!deliveryBoyId) return;

    this.api.assignDelivery(order._id, deliveryBoyId).subscribe();
  }

  ngOnDestroy() {
    this.socket.socket.off('new-order');
    this.socket.socket.off('order-updated');
  }

  isDisabled(order: any, action: string): boolean {

    const status = order.status;

    if (status === 'completed' || status === 'rejected') return true;

    switch (action) {

      case 'confirm':
        return status !== 'pending';

      case 'progress':
        return status !== 'confirmed';

      case 'done':
        return status !== 'inprogress';

      case 'reject':
        return status !== 'pending';

      default:
        return false;
    }
  }
}
