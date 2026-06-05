# Catalog Loading Animation — Design Spec

**Date:** 2026-06-05
**Author:** Lucas + Claude
**Status:** Approved (pending user review)

## Summary

Replace the catalog's generic accent spinner with an animated loading screen
showing the **local business logo** (`config.catalog_logo_url`), then transition
smoothly into the catalog content instead of a hard cut.

Scope is deliberately small: a loading screen + the loading→content transition.
No card stagger, no skeletons, no add-to-cart micro-interactions (explicitly out
of scope per brainstorming).

All animations are pure CSS/Tailwind. **No new dependency** — the `client`
package has no animation library and we keep it that way to protect the
public catalog's mobile bundle size.

## Problem

`client/src/pages/Catalog.tsx` currently renders, while `loading === true`, a
generic spinner (a rotating accent-colored ring + "Cargando catálogo..." text,
lines 278–287). It does not reflect the business brand.

The local logo lives in `config.catalog_logo_url`, which is fetched **inside**
`loadData()`. At the first paint we don't have it yet (chicken-egg). The design
must resolve which logo to show during the very first moments of loading.

**Decision (from brainstorming):** *Branding-first + cache.* Fetch the branding
row before products, show the real logo as soon as it arrives, and persist the
logo URL + accent in `localStorage` so repeat visitors see the local logo
instantly. First-ever visit shows a fallback icon for a few hundred ms until
branding resolves.

## Architecture

Three pieces:

1. **`client/src/components/catalog/CatalogLoader.tsx`** (new) — a single-purpose
   full-screen overlay rendering the animated logo loading screen.
2. **`client/src/pages/Catalog.tsx`** (modified) — orchestrates a 3-phase state
   machine and the branding-first data split.
3. **`client/src/index.css`** (modified) — new `@keyframes` + utility classes,
   following the existing convention (`introLogo`, `fadeOutScreen`, etc. in
   `@layer utilities`).

## Component: `CatalogLoader`

### Interface

```ts
interface CatalogLoaderProps {
  logoUrl?: string | null;   // local logo; falls back to Store icon when absent
  accentColor: string;       // business accent (CSS var for ring/glow)
  businessName?: string;     // optional, shown under logo
  exiting: boolean;          // true → play fade-out-screen
}
```

### Behavior

- Full-screen, fixed, centered, high z-index. Light background (`bg-gray-50`)
  to match the catalog's resting state.
- **Logo:** `<img src={logoUrl}>` with **bounce-in** entrance
  (`animate-bounce-in-logo`) plus a looping **shine sweep**: a diagonal
  light-gradient pseudo-element that translates across the logo. The shine is
  clipped to a rounded wrapper so it only crosses the logo.
- **Fallback:** when `logoUrl` is falsy, render the `Store` lucide icon (same
  size, same bounce) inside a circular accent-tinted container — mirrors the
  existing header fallback (Catalog.tsx lines 301–305).
- Optional `businessName` line + "Cargando catálogo..." caption, muted.
- The accent color is applied via an inline CSS custom property
  (`style={{ ['--accent' as any]: accentColor }}`) so the ring/glow can use it;
  we cannot use `theme('colors.primary.500')` because accent is per-business.
- When `exiting === true`, add `.animate-fade-out-screen` so the whole overlay
  fades out (~600ms) while the catalog content reveals behind it.

The component is presentational only — no data fetching, no localStorage. It
receives everything via props so it can be reasoned about and visually checked
in isolation.

## Data flow: loading split in `Catalog.tsx`

### State change

Replace `const [loading, setLoading] = useState(true)` with:

```ts
type LoadPhase = 'loading' | 'exiting' | 'ready';
const [phase, setPhase] = useState<LoadPhase>('loading');
```

`loading === true` is equivalent to `phase !== 'ready'`.

### localStorage cache

Cache key: `catalog_branding`. Shape:

```ts
{ catalog_logo_url?: string; catalog_accent_color?: string; catalog_business_name?: string }
```

- **On mount (synchronous seed):** read the cache and seed `config` initial state
  so repeat visitors render the local logo on the first paint. Wrapped in
  `try/catch` — private mode / disabled storage must not crash.
- **After branding fetch:** write the fresh values back to the cache.

### `loadData` refactor (two-phase)

```
1. Branding first:
   const { data: cfg } = await supabase.from('public_branding').select('*').maybeSingle();
   if (cfg) { setConfig(cfg); writeBrandingCache(cfg); }
   // on error: keep seeded/fallback config, do not throw

2. Products + promos:
   const [{ data: prods }, promos] = await Promise.all([
     supabase.from('public_catalog').select('*').order('name', { ascending: true }),
     catalogPromotionService.getAll(true).catch(() => []),
   ]);
   if (prods) setProducts(prods);
   setPromotions(promos ?? []);

3. Transition out:
   setPhase('exiting');
   setTimeout(() => setPhase('ready'), 600); // matches .animate-fade-out-screen (0.6s)
```

Note: branding is now awaited **before** products (previously all three ran in a
single `Promise.all`). The branding row is a single `maybeSingle()` — the added
latency is small and buys us the correct logo during load. Products remain the
slow query and run after.

### Render

- While `phase !== 'ready'`, mount `<CatalogLoader exiting={phase === 'exiting'}
  logoUrl={config.catalog_logo_url} accentColor={accent}
  businessName={businessName} />`.
- The main catalog `<div>` mounts when `phase !== 'loading'` (i.e. during
  `exiting` and `ready`) and animates in with a `contentReveal` fade-in, so the
  content is already fading in *behind* the loader as it fades out — producing
  the smooth loading→header transition.

## CSS additions (`index.css`)

Inside the existing `@layer utilities` block + matching `@keyframes`, following
the file's current style:

```css
.animate-bounce-in-logo { animation: bounceInLogo 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.catalog-logo-shine::after { /* diagonal gradient, animation: shineSweep 2.2s ease-in-out infinite; */ }
.animate-content-reveal { animation: contentReveal 0.6s ease-out forwards; }
/* reuse existing .animate-fade-out-screen for the loader exit */

@keyframes bounceInLogo {
  0%   { transform: scale(0.3); opacity: 0; }
  60%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes shineSweep {
  0%   { transform: translateX(-150%) rotate(20deg); }
  60%, 100% { transform: translateX(150%) rotate(20deg); }
}
@keyframes contentReveal {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Exact gradient/clip values finalized during implementation; keyframes above are
the contract.

## Error handling

| Failure | Behavior |
|---|---|
| Branding fetch fails | Keep seeded/fallback config (accent `#e53935`, Store icon). Loader still renders. No throw. |
| Products fetch fails | `products` stays `[]` → existing "No se encontraron productos" empty state. Preserved. |
| Promos fetch fails | Already caught → `[]`. Preserved. |
| `localStorage` unavailable | `try/catch` around read & write; skip cache silently. |
| No logo at all (first visit, fetch slow) | `CatalogLoader` shows `Store` fallback icon until branding resolves. |

## Testing

No unit-test harness exists for `client` pages; verification is manual, matching
project convention.

Manual cases:
1. **First visit (cold cache):** fallback Store icon → real logo appears after
   branding resolves → smooth reveal into catalog.
2. **Repeat visit (warm cache):** local logo shown on first paint, no flash of
   fallback.
3. **Slow network (throttle):** loader persists with shine looping; no spinner.
4. **Branding error:** loader shows fallback icon, catalog still loads products.
5. **Private/incognito mode:** no crash, behaves like first visit each time.

## Out of scope (YAGNI)

- Staggered card entrance
- Skeleton placeholders
- Add-to-cart micro-interactions

These were considered during brainstorming and explicitly declined.

## Files touched

- `client/src/components/catalog/CatalogLoader.tsx` — new
- `client/src/pages/Catalog.tsx` — modified (phase state, loadData split, cache, render)
- `client/src/index.css` — modified (keyframes + utilities)
