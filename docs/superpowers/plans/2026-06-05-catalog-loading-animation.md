# Catalog Loading Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the catalog's generic spinner with an animated loading screen showing the local business logo, then transition smoothly into the catalog content.

**Architecture:** A new presentational `CatalogLoader` component renders a full-screen logo loader (bounce-in + shine-sweep, pure CSS). `Catalog.tsx` drives a 3-phase state machine (`loading → exiting → ready`) and splits data loading so branding (and thus the logo) is fetched before products; the logo URL + accent are cached in `localStorage` so repeat visitors see the local logo on first paint.

**Tech Stack:** React + TypeScript, Tailwind CSS, Vite, Supabase client. **No new dependency** — all animation is CSS keyframes in `index.css`.

**Spec:** `docs/superpowers/specs/2026-06-05-catalog-loading-animation-design.md`

**Note on testing:** The `client` package has no unit-test harness for pages. Automated verification per task = `npx tsc -b` (type/build check). Visual behavior is verified manually with `pnpm dev` (the project uses pnpm). Run all commands from `client/`.

---

## File Structure

- **Create:** `client/src/components/catalog/CatalogLoader.tsx` — presentational full-screen loader. Props in, no fetching, no storage.
- **Modify:** `client/src/index.css` — add `@keyframes bounceInLogo`, `shineSweep`, `contentReveal` + utility classes inside the existing `@layer utilities`.
- **Modify:** `client/src/pages/Catalog.tsx` — phase state machine, branding-first `loadData`, localStorage cache, render the loader + content reveal.

---

## Task 1: CSS keyframes & utility classes

**Files:**
- Modify: `client/src/index.css:5-51` (inside existing `@layer utilities` and the `@keyframes` block below it)

- [ ] **Step 1: Add utility classes inside the existing `@layer utilities` block**

In `client/src/index.css`, the `@layer utilities { ... }` block currently ends at line 26 (after `.animate-fade-out-screen`). Add these three classes just before the closing `}` of that block (after line 25):

```css
  .animate-bounce-in-logo {
    animation: bounceInLogo 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .animate-content-reveal {
    animation: contentReveal 0.6s ease-out forwards;
  }

  .catalog-logo-shine {
    position: relative;
    overflow: hidden;
  }

  .catalog-logo-shine::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 60%;
    height: 100%;
    background: linear-gradient(
      100deg,
      transparent 0%,
      rgba(255, 255, 255, 0.65) 50%,
      transparent 100%
    );
    transform: translateX(-150%);
    animation: shineSweep 2.2s ease-in-out infinite;
    pointer-events: none;
  }
```

- [ ] **Step 2: Add the keyframes after the existing `@keyframes revealLogin` block**

In `client/src/index.css`, after the `@keyframes revealLogin { ... }` block (ends at line 51), add:

```css
@keyframes bounceInLogo {
  0%   { transform: scale(0.3); opacity: 0; }
  60%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes shineSweep {
  0%        { transform: translateX(-150%); }
  60%, 100% { transform: translateX(260%); }
}

@keyframes contentReveal {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 3: Verify build passes (CSS is bundled, no type impact)**

Run: `npx tsc -b`
Expected: PASS (no errors). CSS changes don't affect types; this confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add client/src/index.css
git commit -m "feat(catalog): add loader keyframes (bounce-in, shine, content-reveal)"
```

---

## Task 2: `CatalogLoader` component

**Files:**
- Create: `client/src/components/catalog/CatalogLoader.tsx`

- [ ] **Step 1: Create the component file**

Create `client/src/components/catalog/CatalogLoader.tsx` with this exact content:

```tsx
import { Store } from 'lucide-react';

export interface CatalogLoaderProps {
  logoUrl?: string | null;
  accentColor: string;
  businessName?: string;
  exiting: boolean;
}

export function CatalogLoader({ logoUrl, accentColor, businessName, exiting }: CatalogLoaderProps) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 ${exiting ? 'animate-fade-out-screen' : ''}`}
      style={{ ['--accent' as any]: accentColor }}
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="catalog-logo-shine animate-bounce-in-logo w-28 h-28 rounded-full border-4 border-white shadow-xl flex items-center justify-center overflow-hidden bg-white"
          style={{ boxShadow: `0 10px 40px ${accentColor}33` }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={businessName || 'logo'} className="w-full h-full object-cover" />
          ) : (
            <Store size={48} style={{ color: accentColor }} />
          )}
        </div>

        {businessName && (
          <h1 className="text-lg font-bold text-gray-800">{businessName}</h1>
        )}

        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor }}
          />
          <p className="text-sm text-gray-500 font-medium">Cargando catálogo...</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b`
Expected: PASS. (Component is not yet imported anywhere; this confirms it compiles standalone.)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/catalog/CatalogLoader.tsx
git commit -m "feat(catalog): add CatalogLoader animated logo loading screen"
```

---

## Task 3: localStorage branding cache helpers (in Catalog.tsx)

**Files:**
- Modify: `client/src/pages/Catalog.tsx` (add helpers near the existing `fmt` helper around line 26)

- [ ] **Step 1: Add cache key constant and read/write helpers**

In `client/src/pages/Catalog.tsx`, just below the `const fmt = ...` helper (line 26), add:

```tsx
/* ─── Branding cache (so repeat visitors see the local logo instantly) ─── */
const BRANDING_CACHE_KEY = 'catalog_branding';

function readBrandingCache(): BusinessConfig {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as BusinessConfig) : {};
  } catch {
    return {};
  }
}

function writeBrandingCache(cfg: BusinessConfig) {
  try {
    localStorage.setItem(
      BRANDING_CACHE_KEY,
      JSON.stringify({
        catalog_logo_url: cfg.catalog_logo_url,
        catalog_accent_color: cfg.catalog_accent_color,
        catalog_business_name: cfg.catalog_business_name,
      })
    );
  } catch {
    /* private mode / storage disabled — ignore */
  }
}
```

Note: `BusinessConfig` is already defined in this file (lines 16-23). These helpers reference it.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Catalog.tsx
git commit -m "feat(catalog): add localStorage branding cache helpers"
```

---

## Task 4: Phase state machine + seeded config

**Files:**
- Modify: `client/src/pages/Catalog.tsx:67-70` (state declarations)

- [ ] **Step 1: Replace the `loading` boolean with a phase state and seed config from cache**

In `client/src/pages/Catalog.tsx`, find these two lines (around 67-70):

```tsx
  const [products, setProducts] = useState<PublicCatalogItem[]>([]);
  const [config, setConfig] = useState<BusinessConfig>({});
  const [promotions, setPromotions] = useState<CatalogPromotion[]>([]);
  const [loading, setLoading] = useState(true);
```

Replace with:

```tsx
  const [products, setProducts] = useState<PublicCatalogItem[]>([]);
  const [config, setConfig] = useState<BusinessConfig>(() => readBrandingCache());
  const [promotions, setPromotions] = useState<CatalogPromotion[]>([]);
  const [phase, setPhase] = useState<'loading' | 'exiting' | 'ready'>('loading');
```

This seeds `config` synchronously from the cache so repeat visitors render the local logo on first paint.

- [ ] **Step 2: Verify it fails to build (intentional — `loading`/`setLoading` no longer exist)**

Run: `npx tsc -b`
Expected: FAIL with errors referencing `loading` (line ~278) and `setLoading` (line ~159). This confirms the next tasks must update those usages. Do not commit yet.

---

## Task 5: Branding-first `loadData` + transition

**Files:**
- Modify: `client/src/pages/Catalog.tsx:150-160` (the `loadData` function)

- [ ] **Step 1: Rewrite `loadData` to fetch branding first, then products/promos, then transition**

In `client/src/pages/Catalog.tsx`, replace the entire `loadData` function (currently lines 150-160):

```tsx
  async function loadData() {
    const [{ data: prods }, { data: cfg }, promos] = await Promise.all([
      supabase.from('public_catalog').select('*').order('name', { ascending: true }),
      supabase.from('public_branding').select('*').maybeSingle(),
      catalogPromotionService.getAll(true).catch(() => [] as CatalogPromotion[])
    ]);
    if (prods) setProducts(prods as PublicCatalogItem[]);
    if (cfg) setConfig(cfg as BusinessConfig);
    if (promos) setPromotions(promos as CatalogPromotion[]);
    setLoading(false);
  }
```

with:

```tsx
  async function loadData() {
    // Phase 1: branding first — gives us the local logo before products load.
    const { data: cfg } = await supabase.from('public_branding').select('*').maybeSingle();
    if (cfg) {
      setConfig(cfg as BusinessConfig);
      writeBrandingCache(cfg as BusinessConfig);
    }

    // Phase 2: products + promos (the slow queries).
    const [{ data: prods }, promos] = await Promise.all([
      supabase.from('public_catalog').select('*').order('name', { ascending: true }),
      catalogPromotionService.getAll(true).catch(() => [] as CatalogPromotion[]),
    ]);
    if (prods) setProducts(prods as PublicCatalogItem[]);
    setPromotions((promos ?? []) as CatalogPromotion[]);

    // Phase 3: fade the loader out, then unmount it.
    setPhase('exiting');
    setTimeout(() => setPhase('ready'), 600); // matches .animate-fade-out-screen (0.6s)
  }
```

- [ ] **Step 2: Verify build — only the render-side `loading` reference should remain broken**

Run: `npx tsc -b`
Expected: FAIL, now only referencing `loading` at the render guard (around line 278). The `setLoading` error is gone. Task 6 fixes the last one.

---

## Task 6: Render the loader + content reveal

**Files:**
- Modify: `client/src/pages/Catalog.tsx:278-290` (loading guard + main wrapper)
- Modify: `client/src/pages/Catalog.tsx:7` (import)

- [ ] **Step 1: Import `CatalogLoader`**

In `client/src/pages/Catalog.tsx`, after the existing import on line 6:

```tsx
import { PromotionSlider } from '../components/catalog/PromotionSlider';
```

add:

```tsx
import { CatalogLoader } from '../components/catalog/CatalogLoader';
```

- [ ] **Step 2: Replace the loading guard block**

Find this block (currently lines 278-287):

```tsx
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
          <p className="text-gray-500 font-medium">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
```

Replace with:

```tsx
  return (
    <>
      {phase !== 'ready' && (
        <CatalogLoader
          logoUrl={config.catalog_logo_url}
          accentColor={accent}
          businessName={businessName}
          exiting={phase === 'exiting'}
        />
      )}

      {phase !== 'loading' && (
        <div className="min-h-screen bg-gray-50 animate-content-reveal">
```

- [ ] **Step 3: Close the new wrapper fragment at the end of the component**

The component's `return` previously ended with a single closing `</div>` then `);` (around lines 803-804):

```tsx
      </footer>
    </div>
  );
}
```

Replace with:

```tsx
      </footer>
        </div>
      )}
    </>
  );
}
```

(The extra indentation closes the conditional `{phase !== 'loading' && ( ... )}` wrapper and the outer fragment.)

- [ ] **Step 4: Verify build passes**

Run: `npx tsc -b`
Expected: PASS. All `loading`/`setLoading` references resolved.

- [ ] **Step 5: Run the linter**

Run: `pnpm lint`
Expected: No new errors in `Catalog.tsx` or `CatalogLoader.tsx`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Catalog.tsx
git commit -m "feat(catalog): render animated logo loader with branding-first load + reveal"
```

---

## Task 7: Manual verification

**No automated harness for pages — verify visually.**

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Open the catalog route in the browser.

- [ ] **Step 2: Cold-cache first visit**

In DevTools → Application → Local Storage, delete the `catalog_branding` key, then hard-reload.
Expected: loader appears immediately with the `Store` fallback icon (bounce-in), shine sweeps across it; once branding resolves the real logo shows; then the loader fades out and the catalog content fades/slides in (no hard cut).

- [ ] **Step 3: Warm-cache repeat visit**

Reload again (cache now populated).
Expected: the local logo is shown from the first frame — no flash of the `Store` fallback.

- [ ] **Step 4: Slow network**

DevTools → Network → throttle to "Slow 3G", reload.
Expected: loader persists with the shine looping smoothly until data arrives; no old spinner appears.

- [ ] **Step 5: Branding error resilience**

DevTools → Network → block requests to the Supabase branding endpoint (or go offline after caching), reload.
Expected: loader shows the fallback (or cached logo), no crash; catalog still attempts to render (empty state acceptable).

- [ ] **Step 6: Incognito / storage disabled**

Open the catalog in a private window.
Expected: no console errors from `localStorage`; behaves like a cold-cache first visit.

- [ ] **Step 7: Production build sanity**

Run: `pnpm build`
Expected: build succeeds (`tsc -b && vite build`), no errors.

- [ ] **Step 8: Final commit (if any tweaks were needed during manual QA)**

```bash
git add -A
git commit -m "fix(catalog): manual QA tweaks for loading animation"
```

(Skip if no changes were needed.)

---

## Done

The catalog now opens with an animated local-logo loading screen and transitions smoothly into content. No new dependency, mobile bundle unaffected.
