import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * link-preview — récupère côté serveur les métadonnées publiques (OpenGraph)
 * d'une page produit collée par le client. Le navigateur ne peut pas le faire
 * (cross-origin). Timeout strict de 5s : on ne bloque jamais le panier.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function meta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decode(m[1].trim());
    }
  }
  return null;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { url } = await req.json().catch(() => ({ url: "" }));
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return json({ ok: false, error: "invalid_url" }, 400);
    }

    let host = "";
    try { host = new URL(url).hostname.replace(/^www\d?\./, ""); } catch { /* ignore */ }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "User-Agent": UA, "Accept-Language": "fr,en;q=0.8", Accept: "text/html,*/*" },
      });
      const html = (await res.text()).slice(0, 400_000);
      // Titres « anti-bot » (Cloudflare, captcha) : inutiles pour le client.
      const JUNK = /^(just a moment|attention required|robot check|access denied|verify|are you a human|amazon\.fr|amazon\.com|security check|一 ?momento)/i;
      const rawTitle =
        meta(html, ["og:title", "twitter:title"]) ||
        decode(html.match(/<title[^>]*>([^<]{2,200})<\/title>/i)?.[1]?.trim() ?? "") ||
        "";
      const title = rawTitle && !JUNK.test(rawTitle.trim()) ? rawTitle : null;
      const image = meta(html, ["og:image:secure_url", "og:image", "twitter:image"]);
      const price = meta(html, [
        "product:price:amount", "og:price:amount", "twitter:data1",
      ]);
      const currency = meta(html, ["product:price:currency", "og:price:currency"]);

      return json({
        ok: true,
        host,
        title,
        image: image && /^https?:\/\//i.test(image) ? image : null,
        price: price ?? null,
        currency: currency ?? null,
        partial: !title && !image,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (_e) {
    // Timeout / site bloquant : on renvoie un succès dégradé, jamais une erreur bloquante.
    return json({ ok: true, host: "", title: null, image: null, price: null, currency: null, partial: true });
  }
});
