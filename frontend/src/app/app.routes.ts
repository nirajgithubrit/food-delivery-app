import { Routes } from "@angular/router";

import { CartComponent } from "./customer/cart/cart.component";
import { MenuComponent } from "./customer/menu/menu.component";
import { LoginComponent } from "./core/login/login.component";
import { OrderTrackingComponent } from "./customer/order-tracking/order-tracking.component";

import { AddItemComponent } from "./admin/add-item/add-item.component";
import { OrdersComponent } from "./admin/orders/orders.component";

import { DeliveryComponent } from "./delivery-boy/delivery/delivery.component";
import { RoleGuard } from "./core/role.guard";

export const routes: Routes = [
  {
    path: "",
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
        path: "",
        canActivate: [RoleGuard],
        data: { roles: ["admin"] },
        children: [
          { path: "add-item", component: AddItemComponent },
          { path: "orders", component: OrdersComponent },
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
      { path: "track", component: OrderTrackingComponent },
      { path: "", redirectTo: "menu", pathMatch: "full" },
    ],
  },

  {
    path: "delivery",
    canActivate: [RoleGuard],
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
