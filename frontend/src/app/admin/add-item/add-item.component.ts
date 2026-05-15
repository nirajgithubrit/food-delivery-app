import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/services/toast.service';
import { LogoutButtonComponent } from '../../shared/ui/logout-button/logout-button.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-add-item',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LogoutButtonComponent],
  templateUrl: './add-item.component.html',
  styleUrl: './add-item.component.scss'
})
export class AddItemComponent {
  categories: { _id: string; name: string; slug: string }[] = [];
  item = this.defaultItem();
  items: any[] = [];
  editingItemId: string | null = null;
  newCategoryName = '';
  editingCategoryId: string | null = null;
  editingCategoryName = '';
  uploadInProgress = false;
  private retriedCategories = false;
  private retriedItems = false;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    this.loadCategories();
    this.loadItems();
  }

  private unwrapDeep(res: unknown): unknown {
    let current: unknown = res;
    let guard = 0;
    while (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      'data' in (current as Record<string, unknown>) &&
      guard < 5
    ) {
      current = (current as Record<string, unknown>)['data'];
      guard += 1;
    }
    return current;
  }

  private asArray<T>(res: unknown): T[] {
    let raw: unknown = res;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    raw = this.unwrapDeep(raw);
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const candidateKeys = ['items', 'categories', 'results', 'list', 'rows'];
      for (const key of candidateKeys) {
        if (Array.isArray(obj[key])) return obj[key] as T[];
      }
      if (obj['data']) {
        const nested = this.asArray<T>(obj['data']);
        if (nested.length) return nested;
      }
    }
    return [];
  }

  private asObject<T extends Record<string, unknown>>(res: unknown): T | null {
    const raw = this.unwrapDeep(res);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as T;
    }
    return null;
  }

  private defaultItem() {
    return {
      name: '',
      description: '',
      category: this.categories?.[0]?.slug ?? '',
      price: 0,
      image: '',
      isAvailable: true
    };
  }

  private resetForm() {
    this.item = this.defaultItem();
    this.editingItemId = null;
    this.uploadInProgress = false;
  }

  loadItems() {
    this.api.getItems().subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          const list = this.asArray<any>(res);
          this.items = list;
          this.cdr.detectChanges();
          if (!list.length && !this.retriedItems) {
            this.retriedItems = true;
            setTimeout(() => this.loadItems(), 350);
          }
        });
      },
      error: () => {
        this.zone.run(() => {
          this.toast.error("Could not load items.");
          this.cdr.detectChanges();
        });
      }
    });
  }

  loadCategories() {
    this.api.getCategories().subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          const list = this.asArray<{ _id: string; name: string; slug: string }>(res);
          this.categories = list;
          if (!this.item.category) {
            this.item.category = list[0]?.slug ?? '';
          }
          this.cdr.detectChanges();
          if (!list.length && !this.retriedCategories) {
            this.retriedCategories = true;
            setTimeout(() => this.loadCategories(), 350);
          }
        });
      },
      error: () => {
        this.zone.run(() => {
          this.toast.error("Could not load categories.");
          this.cdr.detectChanges();
        });
      }
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadInProgress = true;
    this.cdr.detectChanges();
    this.api.uploadItemImage(file).pipe(
      finalize(() => {
        this.zone.run(() => {
          this.uploadInProgress = false;
          this.cdr.detectChanges();
        });
      }),
    ).subscribe({
      next: (res: any) => {
        const imageUrl = typeof res?.imageUrl === 'string' ? res.imageUrl : '';
        this.zone.run(() => {
          if (!imageUrl) {
            this.toast.error("Image upload returned invalid URL.");
            this.cdr.detectChanges();
            return;
          }
          this.item = { ...this.item, image: imageUrl };
          this.cdr.detectChanges();
          this.toast.success("Image uploaded.");
        });
      },
      error: (err) => {
        this.zone.run(() => {
          const msg = err.error?.error?.message ?? err.message ?? "Image upload failed.";
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      },
    });
  }

  addCategory() {
    const name = this.newCategoryName.trim();
    if (!name) {
      this.toast.error("Enter category name.");
      return;
    }
    this.api.addCategory(name).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          const created = this.asObject<{ _id: string; name: string; slug: string }>(res);
          if (!created?._id) {
            this.toast.error("Category response invalid.");
            this.cdr.detectChanges();
            return;
          }
          this.categories = [...this.categories, created].sort((a, b) => a.name.localeCompare(b.name));
          this.newCategoryName = '';
          if (!this.item.category) {
            this.item = { ...this.item, category: created.slug };
          }
          this.cdr.detectChanges();
          this.toast.success("Category added.");
        });
      },
      error: (err) => {
        this.zone.run(() => {
          const msg = err.error?.error?.message ?? err.message ?? "Could not add category.";
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      },
    });
  }

  startEditCategory(category: { _id: string; name: string }) {
    this.editingCategoryId = category._id;
    this.editingCategoryName = category.name;
  }

  cancelEditCategory() {
    this.editingCategoryId = null;
    this.editingCategoryName = '';
  }

  saveCategory() {
    if (!this.editingCategoryId) return;
    const editingId = this.editingCategoryId;
    const previous = this.categories.find((c) => c._id === editingId);
    const name = this.editingCategoryName.trim();
    if (!name) {
      this.toast.error("Category name is required.");
      return;
    }
    this.api.updateCategory(this.editingCategoryId, name).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          const updated = this.asObject<{ _id: string; name: string; slug: string }>(res);
          if (!updated?._id) {
            this.toast.error("Category response invalid.");
            this.cdr.detectChanges();
            return;
          }
          this.categories = this.categories
            .map((c) => (c._id === editingId ? updated : c))
            .sort((a, b) => a.name.localeCompare(b.name));

          if (previous && this.item.category === previous.slug) {
            this.item = { ...this.item, category: updated.slug };
          }

          this.cancelEditCategory();
          this.cdr.detectChanges();
          this.toast.success("Category updated.");
        });
      },
      error: (err) => {
        this.zone.run(() => {
          const msg = err.error?.error?.message ?? err.message ?? "Could not update category.";
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      },
    });
  }

  startEditItem(item: any) {
    this.editingItemId = String(item._id);
    this.item = {
      name: String(item.name ?? ''),
      description: String(item.description ?? ''),
      category: String(item.category ?? this.categories[0]?.slug ?? ''),
      price: Number(item.price ?? 0),
      image: String(item.image ?? ''),
      isAvailable: item.isAvailable !== false
    };
    this.uploadInProgress = false;
    this.cdr.detectChanges();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEditItem() {
    this.resetForm();
    this.cdr.detectChanges();
  }

  removeItem(id: string) {
    if (!confirm("Delete this item?")) return;
    this.api.deleteItem(id).subscribe({
      next: () => {
        this.toast.success("Item deleted.");
        this.items = this.items.filter((it) => String(it._id) !== String(id));
        if (this.editingItemId === String(id)) {
          this.resetForm();
        }
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? "Could not delete item.";
        this.toast.error(msg);
      }
    });
  }

  addItem() {
    if (!this.item.name || !this.item.description || !this.item.price || !this.item.category || !this.item.image) {
      this.toast.error("Enter item name, description, category, price and upload image.");
      return;
    }

    if (this.item.description.trim().length < 8) {
      this.toast.error("Description should be at least 8 characters.");
      return;
    }

    if (this.uploadInProgress) {
      this.toast.error("Please wait for image upload to finish.");
      return;
    }

    const request$ = this.editingItemId
      ? this.api.updateItem(this.editingItemId, this.item)
      : this.api.addItem(this.item);

    request$.subscribe({
      next: () => {
        this.toast.success(this.editingItemId ? "Item updated." : "Item added to menu.");
        this.resetForm();
        this.loadItems();
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? "Could not add item.";
        this.toast.error(msg);
      }
    });
  }
}
