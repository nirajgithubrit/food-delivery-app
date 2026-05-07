import { Component, OnInit, OnDestroy } from '@angular/core';
import { SocketService } from '../../services/socket.service';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss'
})
export class DeliveryComponent implements OnInit, OnDestroy {

  // 📦 STATES
  newOrders: any[] = [];        // 🔥 incoming orders (accept/reject)
  ordersQueue: any[] = [];     // 📦 accepted orders
  currentOrder: any = null;

  // 📍 LOCATIONS
  customer!: { lat: number; lng: number };
  restaurant!: { lat: number; lng: number };
  target!: { lat: number; lng: number };

  // 🗺️ MAP
  center!: google.maps.LatLngLiteral;
  riderPosition!: google.maps.LatLngLiteral;
  directionsResults?: google.maps.DirectionsResult;
  zoom = 15;

  // 📡 TRACKING
  orderId: string | null = null;
  watchId: any;
  isTracking = false;
  isArrived = false


  constructor(
    private socket: SocketService,
    private api: ApiService
  ) { }

  ngOnInit() {

    console.log('🚚 Delivery Dashboard Loaded');
    this.startLocationUpdate();

    const myId = localStorage.getItem('deliveryUser');

    if (myId) {
      this.socket.emit('join-delivery', myId);
    }

    // 🧹 CLEAN OLD LISTENERS
    this.socket.off('new-order');
    this.socket.off('order-updated');
    this.socket.off('order-removed');

    // 🔥 NEW ORDER COMING (ASSIGN)
    this.socket.listen('new-order', (order: any) => {

      // ❌ if already assigned → ignore
      if (order.deliveryBoyId) return;

      if (!this.newOrders.some(o => o._id === order._id)) {
        this.newOrders.push(order);
      }
    });

    // 🔥 ORDER UPDATE
    this.socket.listen('order-updated', (order: any) => {

      const myId = localStorage.getItem('deliveryUser');
      if (!myId) return;

      // ===============================
      // 🔥 CASE 1: NOT ASSIGNED (POOL ORDERS)
      // ===============================
      if (!order.deliveryBoyId) {
        const id = String(order._id);
        if (order.status === "pending" || order.status === "confirmed") {
          const ix = this.newOrders.findIndex((o) => String(o._id) === id);
          const next = [...this.newOrders];
          if (ix > -1) {
            next[ix] = order;
          } else {
            next.push(order);
          }
          this.newOrders = next;
        } else {
          // rejected / terminal — remove from rider offer pool
          this.newOrders = this.newOrders.filter((o) => String(o._id) !== id);
        }
        return;
      }

      // ===============================
      // ❌ CASE 2: ASSIGNED TO OTHER RIDER
      // ===============================
      if (order.deliveryBoyId.toString() !== myId.toString()) {
        return;
      }

      // Assigned to me but cancelled/rejected by restaurant
      if (order.status === "rejected") {
        this.newOrders = this.newOrders.filter((o) => String(o._id) !== String(order._id));
        this.ordersQueue = this.ordersQueue.filter((o) => String(o._id) !== String(order._id));
        if (String(this.orderId) === String(order._id)) {
          this.finishOrder(String(order._id));
        }
        return;
      }

      // remove from new orders
      this.newOrders = this.newOrders.filter(o => o._id !== order._id);

      // remove completed
      if (order.status === 'completed') {
        this.finishOrder(order._id);
        return;
      }

      // update queue
      const index = this.ordersQueue.findIndex(o => o._id === order._id);

      if (index > -1) {
        this.ordersQueue[index] = order;
      } else {
        this.ordersQueue.push(order);
      }

      // start tracking only for MY order
      if (order.status === 'inprogress') {
        this.startOrder(order);
      }
    });

    // ORDER REMOVED
    this.socket.listen('order-removed', (orderId: unknown) => {
      const id = String(orderId);
      this.newOrders = this.newOrders.filter((o) => String(o._id) !== id);
      this.ordersQueue = this.ordersQueue.filter((o) => String(o._id) !== id);
      if (this.orderId != null && String(this.orderId) === id) {
        this.finishOrder(id);
      }
    });

    this.loadAssignedOrders();
  }

  //Starting Location 
  startLocationUpdate() {

    navigator.geolocation.watchPosition((pos) => {

      const location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      console.log('📍 Updating rider location:', location);

      this.api.updateRiderLocation(location).subscribe();

    }, (err) => console.error(err), {
      enableHighAccuracy: true
    });
  }

  // 📦 INITIAL LOAD
  loadAssignedOrders() {

    this.api.getMyDeliveryOrders().subscribe((orders: any) => {

      const myId = localStorage.getItem('deliveryUser');
      if (!myId) return;

      // ✅ 1. LOAD NEW ORDERS (UNASSIGNED)
      this.newOrders = orders.filter((o: any) =>
        !o.deliveryBoyId && (o.status === 'pending' || o.status === 'confirmed')
      );

      // ✅ 2. LOAD MY ASSIGNED ORDERS
      this.ordersQueue = orders.filter((o: any) =>
        o.deliveryBoyId?.toString() === myId &&
        o.status !== 'completed' &&
        o.status !== 'rejected'
      );

      // ✅ 3. START ACTIVE ORDER
      const active = this.ordersQueue.find(o => o.status === 'inprogress');

      if (active) {
        this.startOrder(active);
      }
    });
  }

  // ✅ ACCEPT ORDER
  acceptOrder(order: any) {

    const deliveryBoyId = localStorage.getItem('deliveryUser');
    if (!deliveryBoyId) {
      console.warn('[acceptOrder] missing deliveryUser in localStorage');
      return;
    }

    const orderId = order?._id != null ? String(order._id) : '';
    if (!orderId) return;

    console.log('✅ Accepted:', orderId, 'rider:', deliveryBoyId);

    this.api.assignDelivery(orderId, deliveryBoyId).subscribe({
      next: () => {
        this.newOrders = this.newOrders.filter(o => String(o._id) !== orderId);
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Accept failed';
        console.error('[acceptOrder] API error', err);
        alert(msg);
      },
    });
  }

  // ❌ REJECT ORDER
  rejectOrder(order: any) {
    this.api.rejectOrder(order._id).subscribe();
    this.newOrders = this.newOrders.filter(o => o._id !== order._id);
  }

  // 🚀 START ORDER
  startOrder(order: any) {

    this.currentOrder = order;
    this.orderId = order._id;

    this.socket.emit('join-order', this.orderId);

    this.customer = order.location;
    this.restaurant = order.restaurantLocation;

    // 🔥 PHASE
    if (order.pickupStatus === 'pending') {
      this.target = this.restaurant;
    } else {
      this.target = this.customer;
    }

    this.riderPosition = order.deliveryLocation || this.restaurant;
    this.center = this.riderPosition;

    this.updateRoute();

    if (!this.isTracking) {
      this.startTracking();
    }
  }

  // 🛣️ ROUTE
  updateRoute() {

    const service = new google.maps.DirectionsService();

    service.route({
      origin: this.riderPosition,
      destination: this.target,
      travelMode: google.maps.TravelMode.DRIVING
    }, (res, status) => {
      if (status === 'OK') {
        this.directionsResults = res!;
      }
    });
  }

  // 📡 LIVE GPS
  startTracking() {

    if (!this.orderId || this.isTracking) return;

    this.isTracking = true;

    let lastRouteUpdate = 0;
    let isPicked = false;
    let isCompleted = false;

    this.watchId = navigator.geolocation.watchPosition(

      (pos) => {

        const current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        this.api.updateRiderLocation({
          lat: current.lat,
          lng: current.lng
        }).subscribe();

        this.riderPosition = current;
        this.center = current;

        // 📡 SEND TO SERVER
        this.socket.emit('send-location', {
          orderId: this.orderId,
          lat: current.lat,
          lng: current.lng
        });

        // 🛣️ LIMIT ROUTE UPDATE (every 3 sec)
        const now = Date.now();
        if (now - lastRouteUpdate > 3000) {
          this.updateRoute();
          lastRouteUpdate = now;
        }

        const distance = this.getDistance(current, this.target);
        console.log('📏 Distance:', distance);
        const isNear = distance < 0.001; // 🔥 increased threshold

        if (
          isNear &&
          this.currentOrder.pickupStatus === 'picked'
        ) {
          this.isArrived = true;
        }

      },
      (err) => console.error(err),
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 5000
      }
    );
  }

  markPicked() {
    if (!this.orderId) return;

    this.api.updatePickupStatus(this.orderId).subscribe(() => {
      this.currentOrder.pickupStatus = 'picked';

      this.target = this.customer;
      this.updateRoute();
    });
  }

  confirmUpiReceived() {
    if (!this.orderId) return;
    this.api.verifyPayment(this.orderId).subscribe({
      next: (order: any) => {
        if (this.currentOrder && String(this.currentOrder._id) === String(order._id)) {
          this.currentOrder = { ...this.currentOrder, ...order };
        }
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Verification failed';
        alert(msg);
      },
    });
  }

  // ✅ COMPLETE ORDER
  completeOrder() {

    if (!this.orderId || !this.currentOrder) return;

    if (
      this.currentOrder.paymentMethod === 'upi' &&
      this.currentOrder.paymentStatus !== 'verified'
    ) {
      alert('Confirm UPI payment before completing the order.');
      return;
    }

    this.api.updateOrder(this.orderId, 'completed').subscribe({
      next: () => this.finishOrder(this.orderId!),
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Could not complete order';
        alert(msg);
      },
    });
  }

  // 🔄 FINISH
  finishOrder(orderId: string) {

    this.isArrived = false
    this.stopTracking();

    this.ordersQueue = this.ordersQueue.filter(o => String(o._id) !== String(orderId));

    this.currentOrder = null;
    this.orderId = null;
  }

  // 🛑 STOP
  stopTracking() {

    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.isTracking = false;
  }

  getDistance(a: any, b: any) {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return Math.sqrt(dx * dx + dy * dy);
  }

  ngOnDestroy() {
    this.stopTracking();
    this.socket.off('order-updated');
    this.socket.off('new-order');
    this.socket.off('order-removed');
  }
}