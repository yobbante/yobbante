/**
 * Generate public/sitemap.xml from:
 *   - static routes on yobbante.com
 *   - published products from Supabase (yobbante.com/boutique/<id>)
 *
 * Runs as a `predev` / `prebuild` hook. Network failures degrade gracefully:
 * the static portion is always written so build never blocks on Supabase.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const YOB_BASE = "https://yobbante.com";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://tlvuextleczdsqxoguyq.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  // Publishable anon key — safe to ship.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdnVleHRsZWN6ZHNxeG9ndXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzkxNTMsImV4cCI6MjA5MTkxNTE1M30.i-W8LjuHwwfnMdC3-wqAoeo5Mcm97EETGcbbtsc-Czg";

type Entry = {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

const STATIC_ENTRIES: Entry[] = [
  // ── Site principal Yobbanté
  { loc: `${YOB_BASE}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${YOB_BASE}/expedier`, changefreq: "monthly", priority: "0.8" },
  { loc: `${YOB_BASE}/expedier/envoyer`, changefreq: "monthly", priority: "0.8" },
  { loc: `${YOB_BASE}/expedier/recevoir`, changefreq: "monthly", priority: "0.8" },
  { loc: `${YOB_BASE}/sourcing`, changefreq: "monthly", priority: "0.8" },
  { loc: `${YOB_BASE}/acheter/recevoir`, changefreq: "monthly", priority: "0.7" },
  { loc: `${YOB_BASE}/tarifs`, changefreq: "monthly", priority: "0.8" },
  { loc: `${YOB_BASE}/devis`, changefreq: "monthly", priority: "0.7" },
  { loc: `${YOB_BASE}/entreprises`, changefreq: "monthly", priority: "0.7" },
  { loc: `${YOB_BASE}/business`, changefreq: "monthly", priority: "0.7" },
  { loc: `${YOB_BASE}/track`, changefreq: "never", priority: "0.5" },
  { loc: `${YOB_BASE}/auth`, changefreq: "yearly", priority: "0.2" },
  { loc: `${YOB_BASE}/confidentialite`, changefreq: "yearly", priority: "0.3" },
  { loc: `${YOB_BASE}/mentions-legales`, changefreq: "yearly", priority: "0.3" },
  { loc: `${YOB_BASE}/cgu`, changefreq: "yearly", priority: "0.3" },
  { loc: `${YOB_BASE}/cgv`, changefreq: "yearly", priority: "0.3" },
  { loc: `${YOB_BASE}/cookies`, changefreq: "yearly", priority: "0.3" },

  // ── Boutique Dëkk (servie également depuis yobbante.com)
  { loc: `${YOB_BASE}/boutique`, changefreq: "daily", priority: "0.9" },
  { loc: `${YOB_BASE}/panier`, changefreq: "monthly", priority: "0.3" },
];

async function fetchPublishedProducts(): Promise<Entry[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/products?select=id,updated_at&status=eq.published`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const rows = (await res.json()) as Array<{ id: string; updated_at: string }>;
    return rows.map((r) => ({
      loc: `${YOB_BASE}/boutique/${r.id}`,
      lastmod: r.updated_at?.slice(0, 10),
      changefreq: "weekly" as const,
      priority: "0.7",
    }));
  } catch (err) {
    console.warn("[sitemap] product fetch skipped:", (err as Error).message);
    return [];
  }
}

function render(entries: Entry[]): string {
  const urls = entries.map((e) => {
    const parts = [
      `  <url>`,
      `    <loc>${e.loc}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean);
    return parts.join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

async function main() {
  const products = await fetchPublishedProducts();
  const all = [...STATIC_ENTRIES, ...products];
  const out = resolve("public/sitemap.xml");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(all));
  console.log(`[sitemap] wrote ${all.length} entries (${products.length} products) → ${out}`);
}

main().catch((err) => {
  console.error("[sitemap] failed:", err);
  // never block the build
  process.exit(0);
});
