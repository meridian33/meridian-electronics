import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store, Order } from "./store";
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./account.html",
})
export class Account {
  s = inject(Store);
  router = inject(Router);
  route = inject(ActivatedRoute);
  register = false;
  tab = "overview";
  name = this.s.user()?.name || "";
  email = "";
  password = "";
  confirm = "";
  currentPassword = "";
  phone = this.s.user()?.phone || "";
  address = this.s.user()?.address || "";
  orders = signal<Order[]>([]);
  requests = signal<
    { id: number; purpose: string; budget: number; created: string }[]
  >([]);
  constructor() {
    if (this.s.user())
      void this.load().catch((e) => this.s.error.set(e.message));
  }
  async load() {
    const [orders, requests] = await Promise.all([
      this.s.api<Order[]>("/orders"),
      this.s.api<any[]>("/requests"),
    ]);
    this.orders.set(orders);
    this.requests.set(requests);
  }
  login() {
    void this.s.run(async () => {
      if (this.register && this.password !== this.confirm)
        throw new Error("Пароли не совпадают");
      this.s.user.set(
        await this.s.api(
          "/auth/" + (this.register ? "register" : "login"),
          "POST",
          { name: this.name, email: this.email, password: this.password },
        ),
      );
      this.password = "";
      this.confirm = "";
      this.name = this.s.user()!.name;
      this.phone = this.s.user()!.phone;
      this.address = this.s.user()!.address;
      await this.s.loadPrivate();
      await this.load();
      const target = this.route.snapshot.queryParamMap.get("returnUrl");
      if (
        target &&
        /^\/(catalog|favorites|cart|custom|product\/\d+)$/.test(target)
      )
        await this.router.navigateByUrl(target);
    });
  }
  save() {
    void this.s.run(async () => {
      this.s.user.set(
        await this.s.api("/me", "PATCH", {
          name: this.name,
          phone: this.phone,
          address: this.address,
        }),
      );
      this.s.notice.set("Профиль сохранён");
    });
  }
  changePassword() {
    void this.s.run(async () => {
      if (this.password !== this.confirm)
        throw new Error("Пароли не совпадают");
      await this.s.api("/auth/password", "POST", {
        currentPassword: this.currentPassword,
        password: this.password,
      });
      this.password = "";
      this.confirm = "";
      this.currentPassword = "";
      this.s.notice.set(
        "Пароль изменён. Сессии на других устройствах завершены.",
      );
    });
  }
  date(value: string) {
    return new Date(value.replace(" ", "T") + "Z").toLocaleDateString("ru-RU");
  }
}
