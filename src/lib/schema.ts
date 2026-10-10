type Org = {
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
};

export function siteOrganization(siteTitle: string, siteUrl: string): Org {
  const url = siteUrl.replace(/\/$/, "");
  return {
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: siteTitle,
    url: `${url}/`,
  };
}

function rewriteStrings(value: unknown, fromPath: string, toPath: string): unknown {
  if (typeof value === "string") {
    const a = `/${fromPath}/`;
    const b = `/${toPath}/`;
    return value.split(a).join(b);
  }
  if (Array.isArray(value)) return value.map((v) => rewriteStrings(v, fromPath, toPath));
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    next[k] = rewriteStrings(v, fromPath, toPath);
  }
  return next;
}

function isPersonNode(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  const types = Array.isArray(t) ? t : t != null ? [t] : [];
  const id = String(node["@id"] || "");
  return types.includes("Person") || id.includes("#person");
}

function stripPerson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((v) => !(v && typeof v === "object" && isPersonNode(v as Record<string, unknown>)))
      .map(stripPerson);
  }
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    next[k] = stripPerson(v);
  }
  return next;
}

function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function asciiSiteUrls(value: unknown, siteUrl: string): unknown {
  const origin = siteUrl.replace(/\/$/, "");
  if (typeof value === "string") {
    if (!value.startsWith(origin)) return value;
    return foldAccents(value);
  }
  if (Array.isArray(value)) return value.map((v) => asciiSiteUrls(v, siteUrl));
  if (!value || typeof value !== "object") return value;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    next[k] = asciiSiteUrls(v, siteUrl);
  }
  return next;
}

function applyOrg(value: unknown, org: Org): unknown {
  if (Array.isArray(value)) return value.map((v) => applyOrg(v, org));
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    next[k] = applyOrg(v, org);
  }
  if ("author" in next) next.author = org;
  if ("publisher" in next) next.publisher = org;
  return next;
}

/** Force author/publisher = Organization, y compris dans @graph. Plus de Person / faux rédacteur. */
export function withOrgAuthor(
  schemaJson: unknown,
  siteTitle: string,
  siteUrl: string,
  aboutSlug = "a-propos",
): unknown {
  const org = siteOrganization(siteTitle, siteUrl);
  if (!schemaJson || typeof schemaJson !== "object") return schemaJson;
  const moved = rewriteStrings(schemaJson, "a-propos", aboutSlug);
  const noPerson = stripPerson(moved);
  const ascii = asciiSiteUrls(noPerson, siteUrl);
  return applyOrg(ascii, org);
}
