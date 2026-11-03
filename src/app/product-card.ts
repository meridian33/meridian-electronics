import { Component, inject, input } from "@angular/core";
import { RouterLink, Router } from "@angular/router";
import { Product, Store } from "./store";
@Component({
  selector: "product-card",
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="product-card">
      <div class="product-image">
        <span class="tag">{{ p().category }}</span
        ><button
          class="heart"
          [class.selected]="s.favorites().includes(p().id)"
          [attr.aria-pressed]="s.favorites().includes(p().id)"
          [attr.aria-label]="'Избранное: ' + p().name"
          (click)="favorite()"
          [disabled]="s.busy()"
        >
          {{ s.favorites().includes(p().id) ? "♥" : "♡" }}</button
        ><a [routerLink]="['/product', p().id]"
          ><img [src]="p().image" [alt]="p().name" loading="lazy"
        /></a>
      </div>
      <div class="product-copy">
        <small class="stock">{{
          p().stock ? "В наличии · " + p().stock + " шт." : "Нет в наличии"
        }}</small
        ><a [routerLink]="['/product', p().id]"
          ><h3>{{ p().name }}</h3></a
        >
        <p>{{ p().description }}</p>
        <div class="price-row">
          <strong>{{ s.money(p().price) }}</strong
          ><button
            class="add-button"
            (click)="add()"
            [disabled]="s.busy() || !p().stock"
            [attr.aria-label]="'В корзину: ' + p().name"
          >
            В корзину <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  p = input.required<Product>();
  s = inject(Store);
  router = inject(Router);
  add() {
    if (!this.s.user())
      return this.router.navigate(["/account"], {
        queryParams: { returnUrl: this.router.url },
      });
    return this.s.add(this.p());
  }
  favorite() {
    if (!this.s.user())
      return this.router.navigate(["/account"], {
        queryParams: { returnUrl: this.router.url },
      });
    return this.s.favorite(this.p());
  }
}
