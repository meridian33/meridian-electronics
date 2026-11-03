import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
const db = openDatabase();
const server = createApp(db).listen(
  Number(process.env.PORT) || 3000,
  "127.0.0.1",
  () => console.log("MERIDIAN: http://localhost:" + (process.env.PORT || 3000)),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
