import { defineCollection, z } from "astro:content";

const articles = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    metaTitle: z.string().optional(),
    excerpt: z.string(),
    image: z.string(),
    category: z.string(),
    categorySlug: z.string(),
    date: z.coerce.date(),
    schemaJson: z.any().optional(),
    featured: z.boolean().default(false),
    status: z.enum(["published", "draft"]).default("published"),
    isDraft: z.boolean().default(false),
  }),
});

export const collections = { articles };
