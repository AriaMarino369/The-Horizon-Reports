const PROXY_PATH = "/api/image-proxy";

// Wikimedia serves images with permissive hotlink headers already — there's
// no Referer-block for the proxy to work around there. Routing it through
// Vercel's own serverless fetch instead turned out to make things *worse*:
// Wikimedia appears to rate-limit/block that shared IP pool more
// aggressively than it does ordinary residential/browser traffic, so
// viewers' own browsers fetching it directly (as before) are more reliable
// than our server doing it on their behalf. Exempt it and let the browser
// hotlink it directly, same as pre-proxy behavior.
const SKIP_PROXY_HOSTS = [".wikimedia.org"];

function shouldSkipProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SKIP_PROXY_HOSTS.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * Routes an externally-hosted image URL through our own caching proxy
 * (`/api/image-proxy`) instead of hotlinking it directly from the browser.
 * Source outlets' CDNs can start blocking cross-site requests, rate-limit,
 * or take the image down at any time after we first verified it — none of
 * which we control. Proxying means: (a) the fetch happens server-to-server,
 * so a foreign-Referer hotlink block never triggers, and (b) once fetched
 * successfully, the proxy's Cache-Control header lets Vercel's edge network
 * keep serving that copy for a long time, insulating viewers from a later,
 * transient failure on the source's end. See SKIP_PROXY_HOSTS for the one
 * exception where proxying measurably hurts rather than helps.
 *
 * Local assets (starting with "/") and inline `data:` URIs (admin-uploaded
 * images, stored as base64 directly) are already same-origin/self-contained
 * — pass those through untouched.
 */
export function proxiedImageUrl(url: string | null | undefined): string {
  if (!url) return "/placeholder-briefing.svg";
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  if (shouldSkipProxy(url)) return url;
  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`;
}
