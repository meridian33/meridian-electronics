import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { App } from "./app/app";
import { Shop } from "./app/shop";
import { Account } from "./app/account";
bootstrapApplication(App, {
  providers: [
    provideRouter(
      [
        { path: "", component: Shop },
        { path: "catalog", component: Shop },
        { path: "product/:id", component: Shop },
        { path: "favorites", component: Shop },
        { path: "cart", component: Shop },
        { path: "custom", component: Shop },
        { path: "account", component: Account },
        { path: "index.html", redirectTo: "", pathMatch: "full" },
        { path: "catalog.html", redirectTo: "catalog" },
        { path: "catalog-2.html", redirectTo: "catalog" },
        { path: "favorites.html", redirectTo: "favorites" },
        { path: "personal-cabinet.html", redirectTo: "account" },
        { path: "**", redirectTo: "" },
      ],
      withInMemoryScrolling({
        scrollPositionRestoration: "enabled",
        anchorScrolling: "enabled",
      }),
    ),
  ],
}).catch(console.error);
