import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './order-tracking.component.html',
  styleUrl: './order-tracking.component.scss'
})
export class OrderTrackingComponent implements OnInit, OnDestroy {

  order: any;

  // 🗺️ MAP
  center!: google.maps.LatLngLiteral;
  markerPosition!: google.maps.LatLngLiteral;
  zoom = 15;

  // 🛣️ ROUTE + ETA
  directionsResults?: google.maps.DirectionsResult;
  eta: string = '';

  // 📍 CUSTOMER LOCATION
  customerLocation!: google.maps.LatLngLiteral;
  restaurantLocation!: google.maps.LatLngLiteral;

  // 📊 STATUS STEPS
  steps = [
    { key: 'pending', label: 'Order Placed' },
    { key: 'confirmed', label: 'Restaurant Accepted' },
    { key: 'preparing', label: 'Preparing Food' },
    { key: 'pickup', label: 'Picked by Rider' },
    { key: 'completed', label: 'Delivered' }
  ];

  isNear = false;
  private prevStatus = '';
  private prevPickupStatus = '';

  // 🛵 BIKE ICON
  bikeIcon: google.maps.Icon = {
    url: 'bike_icon.png',
    scaledSize: new google.maps.Size(45, 45),
    anchor: new google.maps.Point(22, 22)
  };

  constructor(
    private api: ApiService,
    private socket: SocketService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {

    // 🔥 ORDER STATUS UPDATE
    this.socket.listen('order-updated', (data: any) => {

      if (data._id.toString() === this.order?._id.toString()) {

        const statusChanged = this.prevStatus !== data.status
        const pickupChanged = this.prevPickupStatus !== data.pickupStatus;

        if (statusChanged || pickupChanged) {
          new Audio('notify.wav').play().catch(() => {
            console.log('🔇 Sound blocked, user interaction required');
          });
        }

        this.prevStatus = data.status;
        this.prevPickupStatus = data.pickupStatus;

        this.order = data;

        this.cdr.detectChanges();
      }
    });

    // 🔥 LIVE LOCATION UPDATE
    this.socket.listen('location-update', (order: any) => {

      if (order?._id === this.order?._id && order?.deliveryLocation) {

        const rider = {
          lat: order.deliveryLocation.lat,
          lng: order.deliveryLocation.lng
        };

        this.markerPosition = rider;
        this.center = rider;

        // 🔥 PHASE BASED TARGET
        let target;

        if (order.pickupStatus === 'pending') {
          target = this.restaurantLocation;
        } else {
          target = this.customerLocation;
        }

        const distance = this.getDistance(rider, target);

        if (distance < 0.005) {
          this.isNear = true;
        }

        this.getRoute(rider, target);

        this.cdr.detectChanges();
      }
    });

    this.loadOrder();
  }

  // 📦 LOAD ORDER
  loadOrder() {
    this.api.getOrders().subscribe((res: any) => {

      this.order = res.reverse()[0]; // latest order
      if (!this.order) return;

      this.socket.emit('join-order', this.order._id);

      // ✅ CUSTOMER LOCATION (backend)
      this.customerLocation = {
        lat: this.order.location.lat,
        lng: this.order.location.lng
      };

      this.restaurantLocation = {
        lat: this.order.restaurantLocation.lat,
        lng: this.order.restaurantLocation.lng
      };

      // ✅ RIDER LOCATION (backend or fallback)
      this.markerPosition = this.markerPosition = this.order.deliveryLocation || this.restaurantLocation;

      this.center = this.markerPosition;

      this.getRoute(this.markerPosition, this.restaurantLocation);

    });
  }

  // 📊 STEP INDEX
  getStepIndex(status: string) {
    if (status === 'pending') return 0;
    if (status === 'confirmed') return 1;

    if (status === 'inprogress') {
      return this.order?.pickupStatus === 'picked' ? 3 : 2;
    }

    if (status === 'completed') return 4;

    return 0;
  }

  // 🛣️ GET ROUTE
  getRoute(origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral) {

    const directionsService = new google.maps.DirectionsService();

    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {

      console.log(status);

      if (status === 'OK' && result) {

        this.directionsResults = result;

        const leg = result.routes[0].legs[0];
        this.eta = leg.duration?.text || '';
      }
    });
  }

  // 📏 DISTANCE
  getDistance(a: any, b: any) {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return Math.sqrt(dx * dx + dy * dy);
  }

  ngOnDestroy() {
    this.socket.off('order-updated');
    this.socket.off('location-update');
  }
}