import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import identity from "./src/data/site-identity.json";
import { FR_PATHS, pathsFor } from "./src/lib/paths.mjs";

const siteUrl = identity.site_url.replace(/\/$/, "");
const instPaths = pathsFor(identity.locale, identity.paths);
const localeLang = String(identity.locale || "fr").split("-")[0].toLowerCase();
const articlesDir = fileURLToPath(new URL("./src/content/articles", import.meta.url));

function loadLiveArticles() {
  const now = new Date();
  if (!fs.existsSync(articlesDir)) return [];
  return fs
    .readdirSync(articlesDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(articlesDir, file), "utf8");
      const slug = file.replace(/\.md$/, "");
      const date = raw.match(/^date:\s*['\"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
      const status = raw.match(/^status:\s*['\"]?(\w+)/m)?.[1] ?? "published";
      const isDraft = /^isDraft:\s*true/m.test(raw);
      const categorySlug = raw.match(/^categorySlug:\s*['\"]?([a-z0-9-]+)/m)?.[1];
      return { slug, date, status, isDraft, categorySlug };
    })
    .filter((a) => a.status === "published" && !a.isDraft && a.date && new Date(a.date) <= now);
}

const liveArticles = loadLiveArticles();
const lastmodBySlug = new Map(liveArticles.map((a) => [a.slug, a.date]));
const lastmodByCategory = new Map();
for (const article of liveArticles) {
  if (!article.categorySlug || !article.date) continue;
  const prev = lastmodByCategory.get(article.categorySlug);
  if (!prev || article.date > prev) lastmodByCategory.set(article.categorySlug, article.date);
}
const latestArticleDate = liveArticles.reduce((max, a) => (a.date && a.date > max ? a.date : max), "");

const frRedirects = {
  name: "fr-institutional-redirects",
  hooks: {
    "astro:build:done": ({ dir }) => {
      if (localeLang === "fr") return;
      const ht = path.join(fileURLToPath(dir), ".htaccess");
      if (!fs.existsSync(ht)) return;
      const rules = [
        "",
        "# Anciennes URL FR du clone → slugs de la langue du site",
        `RewriteRule ^${FR_PATHS.about}/?$ /${instPaths.about}/ [L,R=301]`,
        `RewriteRule ^${FR_PATHS.legal}/?$ /${instPaths.legal}/ [L,R=301]`,
        `RewriteRule ^${FR_PATHS.privacy}/?$ /${instPaths.privacy}/ [L,R=301]`,
        "",
      ].join("\n");
      fs.appendFileSync(ht, rules);
    },
  },
};

export default defineConfig({
  site: siteUrl,
  trailingSlash: "always",
  output: "static",
  build: { assets: "assets" },
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => {
        if (
          page.includes(`/${instPaths.legal}`) ||
          page.includes(`/${instPaths.privacy}`) ||
          page.includes("/contact") ||
          page.includes("/politique-de-cookies")
        ) {
          return false;
        }
        const categoryMatch = page.match(/\/category\/([^/]+)\/?$/);
        if (categoryMatch && !lastmodByCategory.has(categoryMatch[1])) {
          return false;
        }
        return true;
      },
      serialize(item) {
        const pathname = new URL(item.url).pathname;
        const categoryMatch = pathname.match(/^\/category\/([^/]+)\/$/);
        if (categoryMatch) {
          const lastmod = lastmodByCategory.get(categoryMatch[1]);
          if (!lastmod) return undefined;
          item.lastmod = new Date(lastmod);
          return item;
        }
        const articleMatch = pathname.match(/^\/([^/]+)\/$/);
        if (articleMatch?.[1] === "mandat-simple-immobilier-guide") {
          return undefined;
        }
        if (articleMatch && lastmodBySlug.has(articleMatch[1])) {
          item.lastmod = new Date(lastmodBySlug.get(articleMatch[1]));
          return item;
        }
        if (pathname === "/" && latestArticleDate) {
          item.lastmod = new Date(latestArticleDate);
        }
        return item;
      },
    }),
    frRedirects,
  ],
});
