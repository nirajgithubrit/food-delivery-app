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

    // 🔥 NEW ORDER COMING (ASSIGN)
    this.socket.listen('new-order', (order: any) => {

      console.log('🆕 New order:', order);

      const exists = this.newOrders.some(o => o._id === order._id);

      if (!exists) {
        this.newOrders.push(order);
      }
    });

    // 🔥 ORDER UPDATE
    this.socket.listen('order-updated', (order: any) => {

      if (!myId) return;

      if (order.deliveryBoyId?.toString() !== myId.toString()) return;

      // ❌ REMOVE COMPLETED
      if (order.status === 'completed') {
        this.finishOrder(order._id);
        return;
      }

      // ✅ UPDATE QUEUE
      const index = this.ordersQueue.findIndex(o => o._id === order._id);

      if (index > -1) {
        this.ordersQueue[index] = order;
      } else {
        this.ordersQueue.push(order);
      }

      // 🚀 START ACTIVE ORDER
      if (order.status === 'inprogress') {
        this.startOrder(order);
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

    this.api.getOrders().subscribe((orders: any) => {

      const myId = localStorage.getItem('deliveryUser');
      if (!myId) {
        console.error('❌ Delivery user not logged in');
        return;
      }

      this.socket.emit('join-delivery', myId);

      this.ordersQueue = orders.filter((o: any) =>
        o.deliveryBoyId?.toString() === myId &&
        o.status !== 'completed'
      );

      const active = this.ordersQueue.find(o => o.status === 'inprogress');

      if (active) {
        this.startOrder(active);
      }
    });
  }

  // ✅ ACCEPT ORDER
  acceptOrder(order: any) {

    console.log('✅ Accepted:', order._id);

    const deliveryBoyId = localStorage.getItem('deliveryUser');

    this.api.assignDelivery(order._id, deliveryBoyId).subscribe(() => {

      this.newOrders = this.newOrders.filter(o => o._id !== order._id);
    });
  }

  // ❌ REJECT ORDER
  rejectOrder(order: any) {

    console.log('❌ Rejected:', order._id);

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

        // =========================
        // 🍽️ PICKUP
        // =========================
        if (
          isNear &&
          this.currentOrder.pickupStatus === 'pending' &&
          !isPicked
        ) {

          console.log('📦 Picked from restaurant');

          isPicked = true;

          this.api.updatePickupStatus(this.orderId!).subscribe();

          this.currentOrder.pickupStatus = 'picked';

          this.target = this.customer;

          this.updateRoute();
        }

        // =========================
        // 🏠 COMPLETE DELIVERY
        // =========================
        if (
          isNear &&
          this.currentOrder.pickupStatus === 'picked' &&
          !isCompleted
        ) {

          console.log('🏁 Delivered');

          isCompleted = true;

          this.completeOrder();
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

  // ✅ COMPLETE ORDER
  completeOrder() {

    if (!this.orderId) return;

    this.api.updateOrder(this.orderId, 'completed').subscribe(() => {
      this.finishOrder(this.orderId!);
    });
  }

  // 🔄 FINISH
  finishOrder(orderId: string) {

    this.stopTracking();

    this.ordersQueue = this.ordersQueue.filter(o => o._id !== orderId);

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
  }
}