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

  updateItem(id: string, data: unknown) {
    return this.http.put(`${this.baseUrl}/items/${id}`, data, { withCredentials: true });
  }

  deleteItem(id: string) {
    return this.http.delete(`${this.baseUrl}/items/${id}`, { withCredentials: true });
  }

  getCategories() {
    return this.http.get(`${this.baseUrl}/categories`, { withCredentials: true });
  }

  addCategory(name: string) {
    return this.http.post(
      `${this.baseUrl}/categories`,
      { name },
      { withCredentials: true },
    );
  }

  updateCategory(id: string, name: string) {
    return this.http.put(
      `${this.baseUrl}/categories/${id}`,
      { name },
      { withCredentials: true },
    );
  }

  uploadItemImage(file: File) {
    const form = new FormData();
    form.append("image", file);
    return this.http.post(`${this.baseUrl}/upload/image`, form, {
      withCredentials: true,
    });
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

  registerAdmin(formData: FormData) {
    return this.http.post(`${this.baseUrl}/auth/admin/register`, formData, {
      withCredentials: true,
    });
  }

  loginAdmin(email: string, password: string) {
    return this.http.post(`${this.baseUrl}/auth/admin`, { email, password }, { withCredentials: true });
  }

  getRestaurantProfile(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/restaurant/me`, {
      withCredentials: true,
    });
  }

  updateRestaurantProfile(body: Record<string, unknown>) {
    return this.http.put(`${this.baseUrl}/restaurant/me`, body, { withCredentials: true });
  }

  updateRestaurantImages(formData: FormData) {
    return this.http.put(`${this.baseUrl}/restaurant/me/images`, formData, {
      withCredentials: true,
    });
  }

  changeAdminPassword(currentPassword: string, newPassword: string) {
    return this.http.put(`${this.baseUrl}/restaurant/me/password`, { currentPassword, newPassword }, {
      withCredentials: true,
    });
  }

  getAnalyticsOverview(params?: { from?: string; to?: string }) {
    return this.http.get(`${this.baseUrl}/analytics/overview`, {
      params: params as Record<string, string>,
      withCredentials: true,
    });
  }

  registerFcmToken(token: string) {
    return this.http.post(`${this.baseUrl}/notifications/fcm-token`, { token }, {
      withCredentials: true,
    });
  }

  unregisterFcmToken(token: string) {
    return this.http.post(
      `${this.baseUrl}/notifications/fcm-token/unregister`,
      { token },
      { withCredentials: true },
    );
  }

  loginDelivery(phone: string, name: string) {
    return this.http.post(
      `${this.baseUrl}/auth/delivery`,
      { phone, name },
      { withCredentials: true },
    );
  }

  getMe() {
    return this.http.get(`${this.baseUrl}/auth/me`, { withCredentials: true });
  }

  logout() {
    return this.http.post(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true });
  }
}
