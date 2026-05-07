import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CartService {
    private items: any[] = [];
    private items$ = new BehaviorSubject<any[]>([]);

    add(item: any) {
        const ix = this.items.findIndex(i => i._id === item._id);

        if (ix > -1) {
            const next = [...this.items];
            const current = next[ix];
            next[ix] = { ...current, qty: (current.qty ?? 0) + 1 };
            this.items = next;
        } else {
            this.items = [...this.items, { ...item, qty: 1 }];
        }

        this.items$.next([...this.items]);
    }

    remove(item: any) {
        const ix = this.items.findIndex(i => i._id === item._id);
        if (ix === -1) return;

        const next = [...this.items];
        const current = next[ix];
        const updated = { ...current, qty: (current.qty ?? 0) - 1 };

        if (updated.qty <= 0) {
            next.splice(ix, 1);
        } else {
            next[ix] = updated;
        }

        this.items = next;
        this.items$.next([...this.items]);
    }

    getItems() {
        return this.items$.asObservable();
    }

    clear() {
        this.items = [];
        this.items$.next([]);
    }
}