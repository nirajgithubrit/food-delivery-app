import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  // 🔥 ROLE
  role: 'customer' | 'admin' | 'delivery' = 'customer';

  phone = '';
  otp = '';
  email = '';
  password = '';
  confirmationResult: any;

  constructor(private auth: AuthService, private router: Router, private api: ApiService) { }

  // 👤 CUSTOMER OTP LOGIN
  sendOTP() {
    const verifier = this.auth.setupRecaptcha('recaptcha');

    this.auth.sendOTP('+91' + this.phone, verifier)
      .then(res => {
        this.confirmationResult = res;
        alert("OTP sent");
      });
  }

  verifyOTP() {
    this.confirmationResult.confirm(this.otp)
      .then(() => {

        this.api.loginCustomer(this.phone).subscribe(() => {

          localStorage.setItem('user', this.phone); // optional

          this.router.navigate(['/customer/menu']);
        });

      });
  }

  // 🧑‍💼 ADMIN LOGIN (DUMMY)
  adminLogin() {
    this.api.loginAdmin(this.email, this.password).subscribe({
      next: () => {
        this.router.navigate(['/admin/orders']);
      },
      error: () => alert("Invalid credentials")
    });
  }

  // 🛵 DELIVERY LOGIN (SIMPLE)
  deliveryLogin() {
    this.api.loginDelivery(this.phone).subscribe((res: any) => {

      localStorage.setItem('deliveryUser', res.user._id);
      this.router.navigate(['/delivery/dashboard']);
    });
  }
}