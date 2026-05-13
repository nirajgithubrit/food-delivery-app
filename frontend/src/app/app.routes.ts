import { Routes } from "@angular/router";

import { CartComponent } from "./customer/cart/cart.component";
import { MenuComponent } from "./customer/menu/menu.component";
import { LoginComponent } from "./core/login/login.component";
import { ActiveOrdersComponent } from "./customer/active-orders/active-orders.component";
import { OrderHistoryComponent } from "./customer/order-history/order-history.component";

import { AddItemComponent } from "./admin/add-item/add-item.component";
import { OrdersComponent } from "./admin/orders/orders.component";
import { AdminRegisterComponent } from "./admin/register/admin-register.component";
import { AdminProfileComponent } from "./admin/profile/admin-profile.component";
import { AdminAnalyticsComponent } from "./admin/analytics/admin-analytics.component";

import { DeliveryComponent } from "./delivery-boy/delivery/delivery.component";
import { authGuard } from "./core/auth.guard";
import { guestGuard } from "./core/guest.guard";
import { RoleGuard } from "./core/role.guard";

export const routes: Routes = [
  {
    path: "",
    canActivate: [guestGuard],
    component: LoginComponent,
    data: { loginMode: "customer" as const },
  },

  {
    path: "rider",
    children: [
      {
        path: "login",
        component: LoginComponent,
        data: { loginMode: "rider" as const },
      },
    ],
  },

  {
    path: "admin",
    children: [
      {
        path: "login",
        component: LoginComponent,
        data: { loginMode: "admin" as const },
      },
      {
        path: "register",
        component: AdminRegisterComponent,
      },
      {
        path: "",
        canActivate: [authGuard, RoleGuard],
        data: { roles: ["admin"] },
        children: [
          { path: "add-item", component: AddItemComponent },
          { path: "orders", component: OrdersComponent },
          { path: "settings", component: AdminProfileComponent },
          { path: "analytics", component: AdminAnalyticsComponent },
          { path: "", redirectTo: "orders", pathMatch: "full" },
        ],
      },
    ],
  },

  {
    path: "customer",
    canActivate: [RoleGuard],
    data: { roles: ["customer"] },
    children: [
      { path: "menu", component: MenuComponent },
      { path: "cart", component: CartComponent },
      { path: "orders", component: ActiveOrdersComponent },
      { path: "history", component: OrderHistoryComponent },
      { path: "track", redirectTo: "orders", pathMatch: "full" },
      { path: "", redirectTo: "menu", pathMatch: "full" },
    ],
  },

  {
    path: "orders/:orderId",
    canActivate: [authGuard, RoleGuard],
    data: { roles: ["customer"] },
    loadComponent: () =>
      import("./customer/order-tracking/order-tracking.component").then(
        (m) => m.OrderTrackingComponent,
      ),
  },

  {
    path: "delivery",
    canActivate: [authGuard, RoleGuard],
    data: { roles: ["delivery"] },
    children: [
      { path: "dashboard", component: DeliveryComponent },
      { path: "", redirectTo: "dashboard", pathMatch: "full" },
    ],
  },

  {
    path: "**",
    redirectTo: "",
  },
];
