import { Injectable, signal, computed } from "@angular/core";
export interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  quantity?: number;
}
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
}
export interface Order {
  id: number;
  total: number;
  status: string;
  created: string;
  address: string;
  items: { name: string; price: number; quantity: number }[];
}
@Injectable({ providedIn: "root" })
export class Store {
  products = signal<Product[]>([]);
  user = signal<User | null>(null);
  cart = signal<Product[]>([]);
  favorites = signal<number[]>([]);
  ready = signal(false);
  loadFailed = signal(false);
  busy = signal(false);
  notice = signal("");
  error = signal("");
  count = computed(() =>
    this.cart().reduce((s, p) => s + (p.quantity || 0), 0),
  );
  total = computed(() =>
    this.cart().reduce((s, p) => s + p.price * (p.quantity || 0), 0),
  );
  async api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
    const r = await fetch("/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Meridian-Client": "web",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) {
        this.user.set(null);
        this.cart.set([]);
        this.favorites.set([]);
      }
      throw new Error(data.error || "Не удалось выполнить запрос");
    }
    return data;
  }
  async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      await action();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : "Нет связи с сервером");
    } finally {
      this.busy.set(false);
    }
  }
  async init() {
    this.ready.set(false);
    this.loadFailed.set(true);
    await this.run(async () => {
      const [products, user] = await Promise.all([
        this.api<Product[]>("/products"),
        this.api<User | null>("/me"),
      ]);
      this.products.set(products);
      this.user.set(user);
      if (user) await this.loadPrivate();
      this.loadFailed.set(false);
    });
    this.ready.set(true);
  }
  async loadPrivate() {
    const [cart, favorites] = await Promise.all([
      this.api<Product[]>("/cart"),
      this.api<number[]>("/favorites"),
    ]);
    this.cart.set(cart);
    this.favorites.set(favorites);
  }
  async quantity(p: Product, q: number) {
    await this.run(async () => {
      this.cart.set(await this.api("/cart/" + p.id, "PUT", { quantity: q }));
      this.notice.set(q ? "Корзина обновлена" : "Товар удалён из корзины");
    });
  }
  async add(p: Product) {
    return this.quantity(
      p,
      (this.cart().find((x) => x.id === p.id)?.quantity || 0) + 1,
    );
  }
  async favorite(p: Product) {
    await this.run(async () => {
      const active = !this.favorites().includes(p.id);
      await this.api("/favorites/" + p.id, "PUT", { active });
      this.favorites.update((ids) =>
        active ? [...ids, p.id] : ids.filter((id) => id !== p.id),
      );
    });
  }
  async logout() {
    await this.run(async () => {
      await this.api("/auth/logout", "POST", {});
      this.user.set(null);
      this.cart.set([]);
      this.favorites.set([]);
      this.notice.set("Вы вышли из аккаунта");
    });
  }
  money(value: number) {
    return new Intl.NumberFormat("ru-RU").format(value) + " ₸";
  }
}
