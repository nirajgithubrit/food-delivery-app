import { Injectable, signal } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class SocketService {
  socket!: Socket;

  /** True when the Socket.IO connection is established. */
  readonly connected = signal(false);

  private readonly reconnectCallbacks = new Set<() => void>();

  constructor() {
    this.createSocket();
  }

  private readToken(): string {
    if (typeof sessionStorage === "undefined") return "";
    return sessionStorage.getItem("authToken") ?? "";
  }

  /**
   * Register a callback to run whenever the socket connects, including after
   * `reconnect()` builds a new client. Use this to re-attach `subscribeEvent` listeners.
   */
  onReconnect(cb: () => void): () => void {
    this.reconnectCallbacks.add(cb);
    return () => this.reconnectCallbacks.delete(cb);
  }

  private emitReconnectCallbacks(): void {
    for (const cb of [...this.reconnectCallbacks]) {
      try {
        cb();
      } catch {
        /* keep other subscribers alive */
      }
    }
  }

  private createSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.connected.set(false);

    this.socket = io(environment.socketUrl, {
      auth: { token: this.readToken() },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      this.connected.set(true);
      this.emitReconnectCallbacks();
    });

    this.socket.on("disconnect", () => {
      this.connected.set(false);
    });
  }

  /** Call after login so the handshake includes a fresh JWT. */
  reconnect(): void {
    this.createSocket();
  }

  /**
   * Adds a listener for this handler only. Returns teardown that calls
   * `off(event, handler)` so multiple subscribers can share the same event name.
   */
  subscribeEvent<T = unknown>(
    event: string,
    callback: (data: T) => void,
  ): () => void {
    const fn = (data: unknown) => callback(data as T);
    this.socket.on(event, fn);
    return () => {
      this.socket?.off(event, fn);
    };
  }

  emit(event: string, data?: unknown): void {
    this.socket.emit(event, data);
  }
}
