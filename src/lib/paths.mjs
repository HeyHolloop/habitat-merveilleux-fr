/** Adresses publiques des 3 pages institutionnelles. Une langue = des slugs, pas des fichiers. */
export const PATHS_BY_LANG = {
  fr: { about: "a-propos", legal: "mentions-legales", privacy: "politique-de-confidentialite" },
  ro: { about: "despre", legal: "mentiuni-legale", privacy: "politica-de-confidentialitate" },
  pl: { about: "o-nas", legal: "regulamin", privacy: "polityka-prywatnosci" },
  nl: { about: "over-ons", legal: "juridisch", privacy: "privacy" },
};

export const FR_PATHS = PATHS_BY_LANG.fr;

export function langFromLocale(locale) {
  return String(locale || "fr").split("-")[0].toLowerCase();
}

export function pathsFor(locale, override) {
  if (override?.about && override?.legal && override?.privacy) {
    return {
      about: String(override.about).replace(/^\/|\/$/g, ""),
      legal: String(override.legal).replace(/^\/|\/$/g, ""),
      privacy: String(override.privacy).replace(/^\/|\/$/g, ""),
    };
  }
  return PATHS_BY_LANG[langFromLocale(locale)] || PATHS_BY_LANG.fr;
}

export function allInstitutionalSlugs() {
  const slugs = new Set(["contact"]);
  for (const p of Object.values(PATHS_BY_LANG)) {
    slugs.add(p.about);
    slugs.add(p.legal);
    slugs.add(p.privacy);
  }
  return slugs;
}
