import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CartService {
    private items: any[] = [];
    private items$ = new BehaviorSubject<any[]>([]);

    add(item: any) {
        const exist = this.items.find(i => i._id === item._id);

        if (exist) {
            exist.qty++;
        } else {
            this.items.push({ ...item, qty: 1 });
        }

        this.items$.next(this.items);
    }

    remove(item: any) {
        const exist = this.items.find(i => i._id === item._id);

        if (!exist) return;

        exist.qty--;

        if (exist.qty <= 0) {
            this.items = this.items.filter(i => i._id !== item._id);
        }

        this.items$.next(this.items);
    }

    getItems() {
        return this.items$.asObservable();
    }

    clear() {
        this.items = [];
        this.items$.next(this.items);
    }
}