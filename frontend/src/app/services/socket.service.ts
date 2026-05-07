import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  socket!: Socket;

  constructor() {
    this.createSocket();
  }

  private readToken(): string {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem('authToken') ?? '';
  }

  private createSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(environment.socketUrl, {
      auth: { token: this.readToken() },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }

  /** Call after login so the handshake includes a fresh JWT. */
  reconnect(): void {
    this.createSocket();
  }

  listen(event: string, callback: (data: unknown) => void): void {
    this.socket.off(event);
    this.socket.on(event, callback);
  }

  off(event: string): void {
    this.socket.off(event);
  }

  emit(event: string, data?: unknown): void {
    this.socket.emit(event, data);
  }
}
