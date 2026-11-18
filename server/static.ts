import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getOgOverrideForUrl, applyOgOverride } from "./og-tags";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  /**
   * Cache policy, because the default (`max-age=0` for everything) makes every
   * repeat visit re-validate the whole bundle — noticeable on the cheap Android
   * handsets most of this audience uses.
   *
   * Vite fingerprints everything under /assets, so those bytes can never change
   * under a given URL: cache them for a year. Everything else (the app shell,
   * images in /images) keeps a short lifetime and must revalidate, so a new
   * deploy is picked up instead of being shadowed by a stale shell.
   */
  app.use(
    express.static(distPath, {
      // Routing is deliberately unchanged (the shell still comes from here for
      // `/`): during a live voting window the only thing worth touching is the
      // cache lifetime, not which handler answers the front page.
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (req, res) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      let html = await fs.promises.readFile(indexPath, "utf-8");
      const og = await getOgOverrideForUrl(req.originalUrl);
      if (og) html = applyOgOverride(html, og);
      // Always revalidate the shell: it names the current asset hashes.
      res
        .status(200)
        .set({ "Content-Type": "text/html", "Cache-Control": "no-cache" })
        .end(html);
    } catch {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
