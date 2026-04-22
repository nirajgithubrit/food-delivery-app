import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {

    baseUrl = 'http://localhost:3000/api';

    constructor(private http: HttpClient) { }

    getItems() {
        return this.http.get(`${this.baseUrl}/items`, { withCredentials: true });
    }

    addItem(data: any) {
        return this.http.post(`${this.baseUrl}/items`, data, { withCredentials: true });
    }

    placeOrder(data: any) {
        return this.http.post(`${this.baseUrl}/orders`, data, { withCredentials: true });
    }

    getOrders() {
        return this.http.get(`${this.baseUrl}/orders`, { withCredentials: true });
    }

    updateOrder(id: string, status: string) {
        return this.http.put(`${this.baseUrl}/orders/${id}`, { status }, { withCredentials: true });
    }

    updatePickupStatus(id: string) {
        return this.http.put(`${this.baseUrl}/orders/${id}/pickup`, {}, { withCredentials: true });
    }

    assignDelivery(orderId: string, deliveryBoyId: string | null) {
        return this.http.put(
            `${this.baseUrl}/orders/assign/${orderId}`,
            { deliveryBoyId },
            { withCredentials: true }
        );
    }

    updateRiderLocation(data: any) {
        return this.http.put(`${this.baseUrl}/orders/rider/location`, data, { withCredentials: true });
    }

    // 🔐 AUTH APIs
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