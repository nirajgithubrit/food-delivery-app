import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { ActivatedRoute, Router } from "@angular/router";
import { of } from "rxjs";

import { LoginComponent } from "./login.component";
import { AuthService } from "../../services/auth.service";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";
import { NotificationService } from "../../shared/services/notification.service";

describe("LoginComponent", () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: { data: of({ loginMode: "customer" as const }) },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy("navigate") } },
        {
          provide: AuthService,
          useValue: {
            sendOtp: () => of(undefined),
            resendOtp: () => of(undefined),
            verifyOtp: () =>
              of({
                token: "a",
                refreshToken: "r",
                role: "customer",
                user: { id: "1", role: "customer" },
              }),
            setLegacySession: () => undefined,
            persistTokens: () => undefined,
            clearTokens: () => undefined,
          },
        },
        { provide: ApiService, useValue: { loginAdmin: () => of({ token: "x" }) } },
        { provide: SocketService, useValue: { reconnect: () => undefined } },
        { provide: ToastService, useValue: { success: () => undefined, error: () => undefined } },
        { provide: NotificationService, useValue: { initForLoggedInUser: () => Promise.resolve() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
