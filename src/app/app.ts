import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { Store } from "./store";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="header">
      <a
        class="brand original-brand"
        routerLink="/"
        aria-label="MERIDIAN — главная"
        ><img src="/img/header/logoplanet31.png" alt="MERIDIAN"
      /></a>
      <nav aria-label="Главное меню">
        <a routerLink="/catalog" routerLinkActive="active">Ассортимент</a
        ><a routerLink="/custom" routerLinkActive="active"
          >Компьютер на заказ</a
        >
      </nav>
      <div class="actions original-actions">
        <a
          routerLink="/catalog"
          fragment="catalog-search"
          aria-label="Поиск товаров"
          title="Поиск товаров"
          ><img src="/img/header/loupe.png" alt=""
        /></a>
        <a
          routerLink="/favorites"
          routerLinkActive="active"
          aria-label="Избранное"
          title="Избранное"
          ><img src="/img/header/favorites.png" alt="" /><b>{{
            s.favorites().length
          }}</b></a
        >
        <a
          routerLink="/cart"
          routerLinkActive="active"
          aria-label="Корзина"
          title="Корзина"
          ><img src="/img/header/cart.png" alt="" /><b>{{ s.count() }}</b></a
        >
        <a
          routerLink="/account"
          routerLinkActive="active"
          aria-label="Личный кабинет"
          title="Личный кабинет"
          ><img src="/img/header/user.png" alt=""
        /></a>
      </div>
    </header>
    @if (s.error()) {
      <div class="message error" role="alert">
        {{ s.error() }}
        <button (click)="s.error.set('')" aria-label="Закрыть ошибку">×</button>
      </div>
    }
    @if (s.notice()) {
      <div class="message" role="status">
        {{ s.notice() }}
        <button (click)="s.notice.set('')" aria-label="Закрыть уведомление">
          ×
        </button>
      </div>
    }
    <main id="main">
      @if (!s.ready()) {
        <div class="empty">Загружаем MERIDIAN…</div>
      } @else if (s.loadFailed()) {
        <section class="empty" role="alert">
          <h1>Не удалось загрузить магазин</h1>
          <p>Проверьте соединение и попробуйте ещё раз.</p>
          <button class="button dark" [disabled]="s.busy()" (click)="s.init()">
            Повторить загрузку
          </button>
        </section>
      } @else {
        <router-outlet />
      }
    </main>
    <footer class="original-footer">
      <a routerLink="/" aria-label="MERIDIAN"
        ><img src="/img/meridianlogo.png" alt="MERIDIAN"
      /></a>
      <div>
        <p>2026 © Все права защищены</p>
        <a routerLink="/" fragment="about">О магазине</a>
      </div>
      <div class="contacts">
        <span>Учебный магазин · Заказы демонстрационные</span>
      </div>
    </footer>
  `,
})
export class App {
  s = inject(Store);
  constructor() {
    void this.s.init();
  }
}
