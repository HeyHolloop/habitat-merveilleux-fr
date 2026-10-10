import type { CollectionEntry } from "astro:content";

export function isLiveArticle(
  data: { isDraft?: boolean; status?: string; date: Date },
  now = new Date(),
): boolean {
  return data.isDraft !== true && data.status === "published" && data.date <= now;
}

export function liveArticles(
  posts: CollectionEntry<"articles">[],
  now = new Date(),
): CollectionEntry<"articles">[] {
  return posts
    .filter((p) => isLiveArticle(p.data, now))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale || "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
