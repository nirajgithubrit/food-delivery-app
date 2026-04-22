import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class SocketService {

    socket: Socket;

    constructor() {
        this.socket = io('http://localhost:3000', {
            withCredentials: true,
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });
    }

    // ✅ LISTEN WITH AUTO CLEAN
    listen(event: string, callback: (data: any) => void) {
        this.socket.off(event); // 🔥 remove old listener (IMPORTANT)
        this.socket.on(event, callback);
    }

    // ✅ REMOVE ONLY SPECIFIC EVENT
    off(event: string) {
        this.socket.off(event);
    }

    emit(event: string, data: any) {
        this.socket.emit(event, data);
    }

    // ⚠️ DO NOT USE THIS IN COMPONENTS
    disconnect() {
        this.socket.disconnect();
    }
}