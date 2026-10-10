import identity from "./data/site-identity.json";
import { pathsFor } from "./lib/paths.mjs";

export const SITE_TITLE = identity.site_title;
export const SITE_URL = identity.site_url.replace(/\/$/, "");
export const SITE_DESCRIPTION = identity.site_description;

const id = identity as typeof identity & {
  ui_strings?: Record<string, string>;
  persona?: { name?: string; role?: string; avatar?: string; bio?: string };
};

const uiDefaults: Record<string, string> = {
  readMore: "Lire l'article",
  publishedBy: "Par",
  alsoRead: "À lire également",
  aboutAuthor: "À propos",
  latestArticles: "Dernières publications",
  mostReadArticles: "Les plus lus",
  recentArticles: "Derniers articles",
  home: "Accueil",
  about: "À propos",
  contact: "Contact",
  categories: "Rubriques",
  legalNotice: "Mentions légales",
  privacyPolicy: "Politique de confidentialité",
  cookiesPolicy: "Politique de cookies",
  discover: "Découvrir",
  newContentComing: "Le contenu arrive bientôt.",
  breadcrumbAria: "Fil d'Ariane",
  masthead: "Habitat Merveilleux",
  skipToContent: "Aller au contenu",
  menu: "Menu",
};

function buildUi(raw: Record<string, string> | undefined): Record<string, string> {
  const ui: Record<string, string> = {};
  for (const key of Object.keys(uiDefaults)) {
    ui[key] = raw?.[key] || uiDefaults[key];
  }
  return ui;
}

const idPaths = (identity as typeof identity & { paths?: { about?: string; legal?: string; privacy?: string } }).paths;

export const SITE_PATHS = pathsFor(identity.locale, idPaths);

export const SITE_CONFIG = {
  locale: identity.locale,
  contact_email: identity.contact_email,
  legal: identity.legal,
  ui: buildUi(id.ui_strings),
  author: {
    name: identity.author?.name || id.persona?.name || "La rédaction",
    role: identity.author?.role || id.persona?.role || "Rédaction",
    avatar: identity.author?.avatar || id.persona?.avatar || "",
    bio: identity.author?.bio || id.persona?.bio || "",
  },
  hero: identity.hero,
  tools: identity.tools,
};

export const CATEGORIES: {
  label: string;
  slug: string;
  description: string;
  hero_title?: string;
  seo_intro?: string;
}[] = identity.categories || [];

export function categoryLabel(slugOrLabel: string): string {
  const hit = CATEGORIES.find((c) => c.slug === slugOrLabel || c.label === slugOrLabel);
  return hit?.label || slugOrLabel;
}
