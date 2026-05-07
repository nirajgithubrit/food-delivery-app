import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getItems() {
    return this.http.get(`${this.baseUrl}/items`, { withCredentials: true });
  }

  addItem(data: unknown) {
    return this.http.post(`${this.baseUrl}/items`, data, { withCredentials: true });
  }

  placeOrder(data: unknown) {
    return this.http.post(`${this.baseUrl}/orders`, data, { withCredentials: true });
  }

  /** Admin: all orders */
  getOrders() {
    return this.http.get(`${this.baseUrl}/orders`, { withCredentials: true });
  }

  /** Customer: own orders (newest first) */
  getCustomerOrders(): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.baseUrl}/orders/me`, { withCredentials: true });
  }

  getMyDeliveryOrders() {
    return this.http.get(`${this.baseUrl}/orders/my`, { withCredentials: true });
  }

  updateOrder(id: string, status: string) {
    return this.http.put(`${this.baseUrl}/orders/${id}`, { status }, { withCredentials: true });
  }

  updatePickupStatus(id: string) {
    return this.http.put(`${this.baseUrl}/orders/${id}/pickup`, {}, { withCredentials: true });
  }

  assignDelivery(orderId: string, deliveryBoyId: string | null) {
    const oid = String(orderId);
    const rid = deliveryBoyId == null ? '' : String(deliveryBoyId);
    return this.http.put(
      `${this.baseUrl}/orders/assign/${oid}`,
      { deliveryBoyId: rid },
      { withCredentials: true },
    );
  }

  updateRiderLocation(data: { lat: number; lng: number }) {
    return this.http.put(`${this.baseUrl}/orders/rider/location`, data, { withCredentials: true });
  }

  rejectOrder(orderId: string) {
    return this.http.put(`${this.baseUrl}/orders/reject/${orderId}`, {}, { withCredentials: true });
  }

  verifyPayment(orderId: string) {
    return this.http.put(`${this.baseUrl}/orders/${orderId}/payment/verify`, {}, { withCredentials: true });
  }

  loginCustomer(phone: string) {
    return this.http.post(`${this.baseUrl}/auth/customer`, { phone }, { withCredentials: true });
  }

  loginAdmin(email: string, password: string) {
    return this.http.post(`${this.baseUrl}/auth/admin`, { email, password }, { withCredentials: true });
  }

  loginDelivery(phone: string) {
    return this.http.post(`${this.baseUrl}/auth/delivery`, { phone }, { withCredentials: true });
  }

  getMe() {
    return this.http.get(`${this.baseUrl}/auth/me`, { withCredentials: true });
  }

  logout() {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true });
  }
}
