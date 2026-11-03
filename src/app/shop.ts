import { Component, inject, signal, computed } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store, Product } from "./store";
import { ProductCard } from "./product-card";
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, ProductCard],
  templateUrl: "./shop.html",
})
export class Shop {
  s = inject(Store);
  route = inject(ActivatedRoute);
  router = inject(Router);
  page = this.route.snapshot.routeConfig?.path || "";
  params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  product = computed(() =>
    this.s.products().find((p) => String(p.id) === this.params().get("id")),
  );
  query = signal("");
  category = signal("Все товары");
  sort = signal("popular");
  inStock = signal(false);
  brand = signal("");
  screen = signal("");
  matrix = signal("");
  cpu = signal("");
  currentPage = signal(1);
  brands = [
    "Apple",
    "Acer",
    "ASUS",
    "Lenovo",
    "MSI",
    "Meta",
    "Logitech",
    "AULA",
    "Xbox",
  ];
  pages = computed(() =>
    Array.from(
      { length: Math.max(1, Math.ceil(this.filtered().length / 6)) },
      (_, i) => i + 1,
    ),
  );
  paged = computed(() =>
    this.filtered().slice((this.currentPage() - 1) * 6, this.currentPage() * 6),
  );
  resetFilters() {
    this.category.set("Все товары");
    this.brand.set("");
    this.screen.set("");
    this.matrix.set("");
    this.cpu.set("");
    this.query.set("");
    this.inStock.set(false);
    this.currentPage.set(1);
  }
  categories = [
    "Все товары",
    "Ноутбуки",
    "Компьютеры",
    "Мониторы",
    "VR и консоли",
    "Аксессуары",
  ];
  filtered = computed(() => {
    let list = this.s
      .products()
      .filter(
        (p) =>
          (this.page !== "favorites" || this.s.favorites().includes(p.id)) &&
          (this.category() === "Все товары" ||
            p.category === this.category()) &&
          (!this.inStock() || p.stock > 0) &&
          (!this.brand() ||
            (this.brand() === "Logitech"
              ? p.name.startsWith("G Pro")
              : p.name.toLowerCase().startsWith(this.brand().toLowerCase()))) &&
          (!this.screen() ||
            p.description.includes(this.screen() + " дюймов")) &&
          (!this.matrix() || p.description.includes(this.matrix())) &&
          (!this.cpu() || p.description.includes(this.cpu())) &&
          (p.name + " " + p.description)
            .toLowerCase()
            .includes(this.query().toLowerCase()),
      );
    return this.sort() === "popular"
      ? list
      : [...list].sort((a, b) =>
          this.sort() === "asc" ? a.price - b.price : b.price - a.price,
        );
  });
  address = this.s.user()?.address || "";
  phone = this.s.user()?.phone || "";
  budget = 500000;
  purpose = "";
  checkout() {
    void this.s.run(async () => {
      const order = await this.s.api("/orders", "POST", {
        address: this.address,
        phone: this.phone,
      });
      await this.s.loadPrivate();
      this.s.products.set(await this.s.api("/products"));
      this.s.notice.set(
        "Заказ №" + order.id + " оформлен. Оплата при получении.",
      );
      await this.router.navigate(["/account"]);
    });
  }
  request() {
    void this.s.run(async () => {
      const r = await this.s.api("/requests", "POST", {
        budget: this.budget,
        purpose: this.purpose,
        phone: this.phone,
      });
      this.s.notice.set("Заявка №" + r.id + " сохранена в личном кабинете");
      await this.router.navigate(["/account"]);
    });
  }
  add(p: Product) {
    if (!this.s.user())
      return this.router.navigate(["/account"], {
        queryParams: { returnUrl: this.router.url },
      });
    return this.s.add(p);
  }
}
