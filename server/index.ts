import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedInitialData, storage } from "./storage";
import { runMigrations } from "./migrate";
import { isDatabaseUnavailable } from "./db";

const app = express();
app.set("trust proxy", 1);
app.use(compression());
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    // The USSD callback is signed over the raw form body, so it has to be kept
    // before the parser turns it into an object.
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("[startup] Running database migrations...");
    await runMigrations();
    console.log("[startup] Migrations complete. Seeding initial data...");
    await seedInitialData();
    console.log("[startup] Data seeded. Registering routes...");
    await registerRoutes(httpServer, app);
    console.log("[startup] Routes registered.");
  } catch (err) {
    console.error("[startup] FATAL ERROR during initialization:", err);
    process.exit(1);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // A database outage is not a generic 500. Say so plainly and answer 503, so
    // no client — and no payment screen — can mistake it for "the vote worked"
    // or for a bad request the fan should retry against another nominee.
    if (isDatabaseUnavailable(err)) {
      console.error("Database unavailable:", err?.message || err);
      return res.status(503).json({
        status: "unavailable",
        message:
          "The voting service is temporarily unavailable and could not confirm your request. Nothing was charged by this request. Please try again in a moment.",
      });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      // If a WhatsApp number was linked before, reconnect and let the automatic
      // run reach nominees who were already on the site. Never blocks startup:
      // a WhatsApp outage must not take the awards site down with it.
      import("./whatsapp-baileys")
        .then(({ startWhatsAppAutomation }) => startWhatsAppAutomation(storage))
        .catch((err) => console.error("[startup] WhatsApp automation unavailable:", err));

      // Social posting is independent of WhatsApp: the Zernio queue starts on
      // the production server and picks up posters without an admin click.
      import("./social")
        .then(({ startSocialAutomation }) => startSocialAutomation())
        .catch((err) => console.error("[startup] Social automation unavailable:", err));
    },
  );
})().catch((err) => {
  console.error("[startup] Unhandled error:", err);
  process.exit(1);
});
