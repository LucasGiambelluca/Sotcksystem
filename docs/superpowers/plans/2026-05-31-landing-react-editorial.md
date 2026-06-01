# Landing React Editorial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `landing-page/` (vanilla HTML) as a standalone React + Tailwind app `landing-react/` with an editorial-light aesthetic (serif headlines, red accent, subtle scroll motion); marketing sections generated via Magic/21st.dev, interactive WhatsApp→ticket demo and contact form ported and preserved.

**Architecture:** New Vite + React 19 + TS app, isolated from `client/`. Tailwind for styling, Framer Motion for scroll-reveal. Content (copy, testimonials, FAQ, pricing, demo flow) centralized in `src/data/content.ts`. Marketing components (Hero, Features, Testimonials, Pricing, FAQ) come from Magic; Nav, Footer, InteractiveDemo, ContactForm are hand-written.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS, Framer Motion (`motion`), lucide-react, Magic MCP (`@21st-dev/magic`), Google Fonts (Fraunces + Inter).

**PRECONDITION:** Magic MCP tools must be loaded. After restarting Claude Code, run `ToolSearch "magic 21st component"` and confirm a component-builder tool exists (e.g. `mcp__magic__21st_magic_component_builder` or similar — discover the exact name; the plan refers to it as **the Magic builder tool**). If absent, run `claude mcp list` and re-add per the spec, then restart again.

**Branch:** Create `feature/landing-react` off `main` before Task 1.

---

## File Structure

```
landing-react/
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  tailwind.config.js
  postcss.config.js
  index.html
  public/logo.png
  src/
    main.tsx
    App.tsx
    index.css                 # tailwind layers + font imports + CSS tokens
    data/content.ts           # all copy + demo flow + testimonials + faq + pricing
    lib/motion.ts             # shared Framer Motion variants
    components/
      Nav.tsx                 # hand-written
      Hero.tsx                # Magic
      InteractiveDemo.tsx     # hand-written (ported from vanilla JS)
      Features.tsx            # Magic
      Testimonials.tsx        # Magic
      Pricing.tsx             # Magic
      Faq.tsx                 # Magic
      ContactForm.tsx         # hand-written (WhatsApp)
      Footer.tsx              # hand-written
```

**Verification model:** No unit-test runner (same as `client/`). Each task verifies with `npx tsc -b` + `npx vite build` (must be 0 errors) and, for visual tasks, a screenshot via the dev server. Commit after each task.

---

## Task 0: Branch

- [ ] **Step 1: Create branch**

```bash
cd /c/Users/Lucas/Desktop/Sotcksystem
git checkout main
git checkout -b feature/landing-react
```

---

## Task 1: Scaffold Vite app + Tailwind + tokens + fonts

**Files:**
- Create: `landing-react/package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `public/logo.png`

- [ ] **Step 1: Scaffold with Vite**

```bash
cd /c/Users/Lucas/Desktop/Sotcksystem
npm create vite@latest landing-react -- --template react-ts
cd landing-react
npm install
npm install -D tailwindcss@^3 postcss autoprefixer
npm install framer-motion lucide-react
npx tailwindcss init -p
```

- [ ] **Step 2: Copy the logo**

```bash
cp /c/Users/Lucas/Desktop/Sotcksystem/landing-page/images/logo.png /c/Users/Lucas/Desktop/Sotcksystem/landing-react/public/logo.png
```

- [ ] **Step 3: `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#e11d48', hover: '#be123c', light: '#fff1f2' },
        navy: '#0f172a',
        surface: '#1e293b',
        ink: '#1e293b',
        muted: '#64748b',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: `src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { scroll-behavior: smooth; }
  body { @apply bg-white text-ink font-sans antialiased; }
  h1, h2, h3 { @apply font-serif; }
}

@layer components {
  .container-x { @apply max-w-6xl mx-auto px-6; }
  .btn-primary { @apply inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover hover:-translate-y-0.5; }
  .btn-ghost { @apply inline-flex items-center justify-center gap-2 bg-white text-ink font-semibold px-6 py-3 rounded-2xl border border-slate-200 transition-colors hover:bg-slate-50; }
}
```

- [ ] **Step 5: Replace `index.html` title/meta**

Set `<title>Sotcksystem | Automatizá tus pedidos por WhatsApp</title>`, add the description meta from the original (`landing-page/index.html` line 7), and `<link rel="icon" href="/logo.png">`. Keep the Vite `<div id="root">` and `<script type="module" src="/src/main.tsx">`.

- [ ] **Step 6: Verify**

```bash
cd /c/Users/Lucas/Desktop/Sotcksystem/landing-react && npx tsc -b && npx vite build
```
Expected: build succeeds, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add landing-react
git commit -m "feat(landing): scaffold Vite React+Tailwind app with editorial tokens"
```

---

## Task 2: Content data module

**Files:**
- Create: `landing-react/src/data/content.ts`

- [ ] **Step 1: Write `content.ts`** (all copy preserved from `landing-page/index.html`)

```ts
export const NAV_LINKS = [
  { label: 'Funciones', href: '#funciones' },
  { label: 'Demo', href: '#demo' },
  { label: 'Precios', href: '#precios' },
];

export const HERO = {
  title: 'Automatizá tu local con WhatsApp',
  subtitle: 'Tus clientes piden, el bot gestiona, vos recibís la comanda. Sin errores, sin esperas.',
  stats: [
    { value: '90%', label: 'pedidos automáticos' },
    { value: '24/7', label: 'atención del bot' },
    { value: '0', label: 'errores de carga' },
  ],
};

export const FEATURES = [
  { icon: 'Bot', title: 'Bot Inteligente', desc: 'Atención automática por WhatsApp los 365 días del año.' },
  { icon: 'Monitor', title: 'Panel Simple', desc: 'Gestioná pedidos y stock desde cualquier dispositivo.' },
  { icon: 'Printer', title: 'Comandas', desc: 'Impresión automática de tickets para cocina y delivery.' },
  { icon: 'FlaskConical', title: 'Stock y Recetas', desc: 'Control de insumos y producción en tiempo real.' },
];

export const TESTIMONIALS = [
  { quote: 'Desde que instalamos Sotcksystem, el bot atiende el 90% de los pedidos sin que tengamos que tocar el teléfono. Me cambió la vida en la cocina.', name: 'Carlos M.', role: 'Pizzería La Nonna', initials: 'CM' },
  { quote: 'Lo mejor es la comandera. El pedido llega, sale el ticket y ya sabemos que está para delivery. Cero errores humanos y más rapidez.', name: 'Julia R.', role: 'Hamburguesería El Mono', initials: 'JR' },
  { quote: 'Excelente soporte técnico. Me ayudaron a configurar el menú en una tarde y al día siguiente ya estábamos vendiendo por WhatsApp.', name: 'Roberto K.', role: 'Gerente de Café Central', initials: 'RK' },
];

export const PRICING = {
  name: 'Sotcksystem Full',
  price: '$50.000',
  period: '/ mes',
  features: [
    'Bot de WhatsApp Ilimitado',
    'Panel de Administración',
    'Comandera Digital + Impresión',
    'Gestión de Stock y Recetas',
    'Soporte Técnico 24/7',
  ],
};

export const FAQ = [
  { q: '¿Necesito tener una computadora siempre encendida?', a: 'No, el sistema funciona 100% en la nube. El bot atiende a tus clientes aunque tu negocio esté cerrado o no tengas internet en ese momento.' },
  { q: '¿Cómo recibo los avisos de nuevos pedidos?', a: 'Los recibís instantáneamente en tu Panel de Administración (PC, Tablet o Celular). Además, si tenés una impresora térmica, el ticket sale automáticamente.' },
  { q: '¿Es difícil configurar el catálogo de productos?', a: '¡Para nada! Podés cargar tus productos en minutos desde una planilla o manualmente. Si necesitás ayuda, nuestro soporte te acompaña en el proceso.' },
];

export const CONTACT = { whatsapp: '5492915093499' };

// Demo flow (ported verbatim from landing-page/index.html)
export const DEMO_FLOW = {
  start:   { text: '¡Hola! Bienvenido a Rotisería El Delirio 🍕. ¿Qué te gustaría pedir?', btns: ['Ver Menú 📋', 'Sugerencia del día 🌟'] },
  menu:    { text: 'Tenemos estas delicias hoy:\n1. Pizza Pepperoni - $5200\n2. Hamburguesa Especial - $4800\n3. Empanadas (x12) - $3600', btns: ['Pedir Pizza 🍕', 'Pedir Burguer 🍔'] },
  address: { text: '¡Excelente elección! Pasame tu dirección para el delivery.', btns: ['Calle Falsa 123 🏠', 'Retiro en local 🏪'] },
  final:   { text: '¡Listo! Tu pedido fue recibido por el local. En 30-40 min llega a tu puerta. ¡Gracias!', btns: ['Hacer otro pedido 🔄'] },
} as const;
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc -b
git add src/data/content.ts && git commit -m "feat(landing): centralize copy + demo flow in content.ts"
```
Expected: tsc 0 errors.

---

## Task 3: Motion variants + Nav + Footer + App shell

**Files:**
- Create: `src/lib/motion.ts`, `src/components/Nav.tsx`, `src/components/Footer.tsx`, `src/App.tsx`

- [ ] **Step 1: `src/lib/motion.ts`**

```ts
import type { Variants } from 'framer-motion';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
```

- [ ] **Step 2: `src/components/Nav.tsx`**

```tsx
import { NAV_LINKS } from '../data/content';

export default function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container-x h-20 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3 font-bold text-lg text-ink">
          <img src="/logo.png" alt="Sotcksystem" className="h-10 w-auto" />
          <span>Sotcksystem</span>
        </a>
        <div className="hidden md:flex gap-8">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="text-muted font-medium hover:text-primary transition-colors">{l.label}</a>
          ))}
        </div>
        <a href="#contacto" className="btn-primary py-2.5">Empezar Ahora</a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: `src/components/Footer.tsx`**

```tsx
export default function Footer() {
  return (
    <footer className="py-10 text-center text-muted bg-slate-50 border-t border-slate-100">
      <p>&copy; 2026 Sotcksystem. Todos los derechos reservados.</p>
    </footer>
  );
}
```

- [ ] **Step 4: `src/App.tsx`** (placeholder sections wired; Magic/ported components added in later tasks)

```tsx
import Nav from './components/Nav';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="overflow-x-hidden">
      <Nav />
      <main className="pt-20">
        {/* Hero (Task 6) */}
        {/* InteractiveDemo (Task 4) */}
        {/* Features (Task 7) */}
        {/* Testimonials (Task 8) */}
        {/* Pricing (Task 9) */}
        {/* Faq (Task 10) */}
        {/* ContactForm (Task 5) */}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/main.tsx` body** to import `./index.css` and render `<App/>` (remove the Vite default `App.css` import and boilerplate).

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

Delete `src/App.css` if present.

- [ ] **Step 6: Verify + commit**

```bash
npx tsc -b && npx vite build
git add src/lib src/components/Nav.tsx src/components/Footer.tsx src/App.tsx src/main.tsx
git commit -m "feat(landing): motion variants + Nav + Footer + App shell"
```
Expected: build 0 errors.

---

## Task 4: InteractiveDemo (ported from vanilla)

**Files:**
- Create: `src/components/InteractiveDemo.tsx`

- [ ] **Step 1: Write `InteractiveDemo.tsx`** — React port of the vanilla chat→ticket demo. Preserves behavior: bot messages stream, user taps a button, on `final` the admin ticket prints and a popup shows for 4s.

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Printer, MessageCircle, Monitor } from 'lucide-react';
import { DEMO_FLOW } from '../data/content';

type Step = keyof typeof DEMO_FLOW;
type Msg = { side: 'bot' | 'user'; text: string };
const NEXT: Record<Step, Step | 'restart'> = { start: 'menu', menu: 'address', address: 'final', final: 'restart' };

export default function InteractiveDemo() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [buttons, setButtons] = useState<string[]>([]);
  const [pendingNext, setPendingNext] = useState<Step | 'restart' | null>(null);
  const [ticket, setTicket] = useState<{ item: string; price: number } | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const after = (ms: number, fn: () => void) => { const id = window.setTimeout(fn, ms); timers.current.push(id); };

  const startFlow = useCallback((step: Step) => {
    const s = DEMO_FLOW[step];
    setMessages(m => [...m, { side: 'bot', text: s.text }]);
    after(500, () => { setButtons([...s.btns]); setPendingNext(NEXT[step]); });
    if (step === 'final') {
      after(1000, () => {
        setPopup(prev => prev); // ensure state churn safe
      });
    }
  }, []);

  const restart = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setMessages([]); setButtons([]); setTicket(null); setPopup(null); setPendingNext(null);
    after(400, () => startFlow('start'));
  }, [startFlow]);

  const choose = (label: string) => {
    setMessages(m => [...m, { side: 'user', text: label }]);
    setButtons([]);
    let item = ''; let price = 0;
    if (label.includes('Pizza')) { item = 'Pizza Pepperoni'; price = 5200; }
    if (label.includes('Burguer')) { item = 'Hamburguesa Especial'; price = 4800; }
    const next = pendingNext;
    setPendingNext(null);
    after(800, () => {
      if (next === 'restart') { restart(); return; }
      if (next === 'final' || (next && DEMO_FLOW[next as Step])) {
        startFlow(next as Step);
        if (next === 'final') {
          // print ticket + popup; reuse last known selection
          const sel = item || lastSelection.current.item;
          const pr = price || lastSelection.current.price;
          after(1200, () => {
            setTicket({ item: sel, price: pr });
            setPopup(`${sel} - Delivery`);
            after(4000, () => setPopup(null));
          });
        }
      }
    });
    if (item) lastSelection.current = { item, price };
  };

  const lastSelection = useRef<{ item: string; price: number }>({ item: 'Pizza Pepperoni', price: 5200 });

  useEffect(() => { startFlow('start'); return () => timers.current.forEach(clearTimeout); }, [startFlow]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [messages, buttons]);

  return (
    <section id="demo" className="py-20 bg-slate-50">
      <div className="container-x">
        <h2 className="text-center text-4xl font-semibold mb-12">Mirá cómo funciona</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Client / WhatsApp */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Vista del Cliente (WhatsApp)</p>
            <div className="rounded-3xl overflow-hidden shadow-xl border-[6px] border-navy bg-white">
              <div className="bg-[#075e54] text-white p-4 flex items-center gap-3">
                <MessageCircle size={22} />
                <div>
                  <div className="font-bold text-sm">Sotcksystem Bot</div>
                  <div className="text-xs opacity-80">En línea</div>
                </div>
              </div>
              <div ref={bodyRef} className="h-[400px] bg-[#e5ddd5] p-4 overflow-y-auto flex flex-col gap-2">
                {messages.map((m, i) => (
                  <div key={i} className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-line ${m.side === 'bot' ? 'bg-white self-start' : 'bg-[#dcf8c6] self-end'}`}>{m.text}</div>
                ))}
                {buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {buttons.map(b => (
                      <button key={b} onClick={() => choose(b)} className="bg-primary text-white text-xs px-3 py-1.5 rounded-full">{b}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Admin / Comandera */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Vista del Local (Admin)</p>
            <div className="rounded-3xl overflow-hidden shadow-xl border-[6px] border-navy bg-white">
              <div className="bg-navy text-white p-4 font-semibold flex items-center gap-2"><Monitor size={18} /> Panel de Control</div>
              <div className="h-[400px] bg-slate-100 p-5 flex items-center justify-center">
                {ticket ? (
                  <div className="bg-white w-64 p-5 shadow-md">
                    <h3 className="text-center border-b border-dashed border-black pb-1 mb-2 text-base font-bold">SOTCKSYSTEM</h3>
                    <div className="flex justify-between font-mono text-xs"><span>1x {ticket.item}</span><span>${ticket.price}</span></div>
                    <div className="border-t border-dashed border-black mt-2 pt-1 font-bold text-right">TOTAL: ${ticket.price}</div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-center">
                    <Printer size={48} className="mx-auto mb-2 opacity-20" />
                    Esperando pedido...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-8">
          <button onClick={restart} className="btn-primary !bg-slate-700">Reiniciar Demo</button>
        </div>
      </div>

      {/* Popup */}
      <div className={`fixed top-5 z-[9999] w-72 bg-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-l-4 border-primary transition-all duration-500 ${popup ? 'right-5' : '-right-96'}`}>
        <div className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center"><Bell size={18} /></div>
        <div>
          <h4 className="m-0 text-sm font-bold">¡Nuevo Pedido!</h4>
          <p className="m-0 text-xs text-muted">{popup ?? ''}</p>
        </div>
      </div>
    </section>
  );
}
```

> NOTE: the `pendingNext` for `final`'s button (`'Hacer otro pedido 🔄'`) maps to `'restart'`. The ticket/popup fire when `startFlow('final')` runs (after the user picks an address button, whose `pendingNext` is `'final'`). `lastSelection` keeps the chosen item/price across the address step (where no item is picked).

- [ ] **Step 2: Mount in `App.tsx`** — import and place `<InteractiveDemo />` where the Task 3 comment is.

- [ ] **Step 3: Verify build + screenshot**

```bash
npx tsc -b && npx vite build
```
Then run dev and screenshot (see Task 11 screenshot helper). Manually confirm: chat streams, tapping buttons advances, final step prints ticket + shows popup, "Reiniciar Demo" resets.

- [ ] **Step 4: Commit**

```bash
git add src/components/InteractiveDemo.tsx src/App.tsx
git commit -m "feat(landing): port interactive WhatsApp->ticket demo to React"
```

---

## Task 5: ContactForm (WhatsApp)

**Files:**
- Create: `src/components/ContactForm.tsx`

- [ ] **Step 1: Write `ContactForm.tsx`**

```tsx
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { CONTACT } from '../data/content';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `¡Hola! Mi nombre es ${name} de ${business}. Me gustaría recibir más información sobre Sotcksystem. Mi WhatsApp es ${phone}.`;
    window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <section id="contacto" className="py-24">
      <div className="container-x">
        <h2 className="text-center text-4xl font-semibold mb-12">Empezá a transformar tu local</h2>
        <form onSubmit={submit} className="max-w-xl mx-auto bg-white p-10 rounded-3xl shadow-xl flex flex-col gap-4">
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="Tu Nombre" className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={business} onChange={e => setBusiness(e.target.value)} required placeholder="Nombre de tu Negocio" className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={phone} onChange={e => setPhone(e.target.value)} required type="tel" placeholder="WhatsApp / Teléfono" className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary" />
          <button type="submit" className="btn-primary !bg-[#25d366] !shadow-none w-full"><MessageCircle size={20} /> Enviar por WhatsApp</button>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount in `App.tsx`, verify, commit**

```bash
npx tsc -b && npx vite build
git add src/components/ContactForm.tsx src/App.tsx
git commit -m "feat(landing): WhatsApp contact form"
```

---

## Task 6: Hero (Magic)

**Files:**
- Create: `src/components/Hero.tsx`

- [ ] **Step 1: Generate with the Magic builder tool**

Call **the Magic builder tool** (discover exact name via `ToolSearch "magic 21st component"`) with this prompt:

> "A hero section for a SaaS landing, editorial light style. Big serif headline 'Automatizá tu local con WhatsApp' (font-serif), muted Inter subtitle 'Tus clientes piden, el bot gestiona, vos recibís la comanda. Sin errores, sin esperas.', two buttons: a solid red (#e11d48) 'Ver Demo Real' linking to #demo and a ghost 'Ver Precios' linking to #precios. Below, a horizontal strip of 3 stats: 90% pedidos automáticos / 24/7 atención del bot / 0 errores de carga, with the numbers in red. White background, generous whitespace, soft shadows, rounded-2xl. React + Tailwind, no external UI libs."

- [ ] **Step 2: Save output to `src/components/Hero.tsx`**, then adapt:
- Pull text/stats from `HERO` in `content.ts` (don't hardcode).
- Ensure headline uses `font-serif`, body `font-sans`.
- Buttons reuse `.btn-primary` / `.btn-ghost`.
- Wrap the root in `<section className="pt-28 pb-20">` with `id` not needed (it's the top).
- Add Framer Motion: wrap content in `motion.div` with `variants={fadeUp}` `initial="hidden"` `animate="show"`.

> Fallback if Magic unavailable: hand-write a hero matching the above spec using `.btn-primary`/`.btn-ghost`, `font-serif` headline, and a `flex` stats strip mapping `HERO.stats`.

- [ ] **Step 3: Mount in `App.tsx` (first in `<main>`), verify, screenshot, commit**

```bash
npx tsc -b && npx vite build
git add src/components/Hero.tsx src/App.tsx
git commit -m "feat(landing): editorial hero (Magic)"
```

---

## Task 7: Features (Magic)

**Files:**
- Create: `src/components/Features.tsx`

- [ ] **Step 1: Generate with the Magic builder tool**

Prompt:

> "A 'features' section, editorial light SaaS style, section heading (serif) 'Todo lo que necesitás'. A responsive bento-style grid of 4 feature cards, each with a lucide-react icon in a soft red-tinted rounded square, a bold title and a muted description. White background, soft shadows, rounded-3xl cards, generous spacing. React + Tailwind + lucide-react."

- [ ] **Step 2: Save to `src/components/Features.tsx`**, adapt:
- Map over `FEATURES` from `content.ts`. The `icon` string maps to a lucide icon: `{ Bot, Monitor, Printer, FlaskConical }` from `lucide-react`.
- Section `id="funciones"`.
- Wrap cards grid in `motion.div variants={stagger}` and each card `motion.div variants={fadeUp}`, `whileInView="show" initial="hidden" viewport={{ once: true }}`.

> Fallback: hand-write a `grid sm:grid-cols-2 lg:grid-cols-4 gap-6`, each card `p-8 rounded-3xl border border-slate-100 shadow-sm`, icon in `bg-primary-light text-primary` square.

- [ ] **Step 3: Mount, verify, commit**

```bash
npx tsc -b && npx vite build
git add src/components/Features.tsx src/App.tsx
git commit -m "feat(landing): bento features (Magic)"
```

---

## Task 8: Testimonials (Magic)

**Files:**
- Create: `src/components/Testimonials.tsx`

- [ ] **Step 1: Generate with the Magic builder tool**

Prompt:

> "A testimonials section, editorial light SaaS style, serif heading 'Lo que dicen nuestros clientes'. Three testimonial cards in a responsive grid, each with an italic quote, and a footer row: a circular avatar with initials on a soft gray background, a bold name and a muted role. White cards, soft shadows, rounded-3xl. React + Tailwind."

- [ ] **Step 2: Save to `src/components/Testimonials.tsx`**, adapt:
- Map over `TESTIMONIALS` from `content.ts` (quote/name/role/initials).
- Section `id="testimonios"`, background `bg-slate-50`.
- Scroll-reveal with `fadeUp`/`stagger` as in Task 7.

> Fallback: `grid md:grid-cols-3 gap-6`, card `bg-white p-8 rounded-3xl shadow-sm`, avatar `w-10 h-10 rounded-full bg-slate-200 grid place-items-center font-bold text-muted`.

- [ ] **Step 3: Mount, verify, commit**

```bash
npx tsc -b && npx vite build
git add src/components/Testimonials.tsx src/App.tsx
git commit -m "feat(landing): testimonials (Magic)"
```

---

## Task 9: Pricing (Magic)

**Files:**
- Create: `src/components/Pricing.tsx`

- [ ] **Step 1: Generate with the Magic builder tool**

Prompt:

> "A single-plan pricing section, serif heading 'Un solo plan, todo incluido'. One centered highlighted pricing card: plan name 'Sotcksystem Full', big price '$50.000' with muted '/ mes', a left-aligned list of 5 features each with a red check icon (lucide Check), and a full-width red CTA button 'Lo quiero ahora' linking to #contacto. Editorial light style but the card can have a subtle premium accent. React + Tailwind + lucide-react."

- [ ] **Step 2: Save to `src/components/Pricing.tsx`**, adapt:
- Use `PRICING` from `content.ts` (name/price/period/features).
- Section `id="precios"`.
- CTA uses `.btn-primary` and links `#contacto`.
- `fadeUp` on the card.

> Fallback: centered `max-w-md mx-auto bg-white rounded-4xl border border-slate-100 shadow-xl p-10`, price in `text-primary text-5xl font-serif`, features list mapping `PRICING.features` with `<Check className="text-primary" />`.

- [ ] **Step 3: Mount, verify, commit**

```bash
npx tsc -b && npx vite build
git add src/components/Pricing.tsx src/App.tsx
git commit -m "feat(landing): pricing card (Magic)"
```

---

## Task 10: FAQ (Magic)

**Files:**
- Create: `src/components/Faq.tsx`

- [ ] **Step 1: Generate with the Magic builder tool**

Prompt:

> "An FAQ accordion section, serif heading 'Preguntas Frecuentes'. A vertical list of expandable items; each shows a question with a chevron that rotates when open and reveals a muted answer with a smooth height transition. Accessible (button per item, aria-expanded). White cards with thin borders, rounded-2xl. React + Tailwind + lucide-react. Use local useState for open/close (controlled, one open at a time is fine)."

- [ ] **Step 2: Save to `src/components/Faq.tsx`**, adapt:
- Map over `FAQ` from `content.ts` (q/a).
- Section `id="faq"`.
- Verify keyboard toggle works.

> Fallback: `useState<number|null>` for the open index; each item a `<button>` toggling, answer `<p>` shown when open, `<ChevronDown className={open ? 'rotate-180' : ''} />`.

- [ ] **Step 3: Mount, verify, commit**

```bash
npx tsc -b && npx vite build
git add src/components/Faq.tsx src/App.tsx
git commit -m "feat(landing): FAQ accordion (Magic)"
```

---

## Task 11: Assembly, responsive pass, screenshot verification

**Files:**
- Modify: `src/App.tsx`
- Create: `/c/Users/Lucas/shotkit/shoot_landing.mjs`

- [ ] **Step 1: Confirm `App.tsx` final order**

```tsx
<Nav />
<main>
  <Hero />
  <InteractiveDemo />
  <Features />
  <Testimonials />
  <Pricing />
  <Faq />
  <ContactForm />
</main>
<Footer />
```
(Hero has its own top padding; remove `pt-20` from `<main>` if Hero already accounts for the fixed nav, otherwise keep it. Verify visually no overlap with the fixed nav.)

- [ ] **Step 2: Screenshot helper** — `/c/Users/Lucas/shotkit/shoot_landing.mjs`

```js
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = 'C:/Users/Lucas/shotkit/landing';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [w, name] of [[1440, 'desktop'], [390, 'mobile']]) {
  const page = await browser.newContext({ viewport: { width: w, height: 900 } }).then(c => c.newPage());
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/full-${name}.png`, fullPage: true });
  console.log('shot', name);
}
await browser.close();
console.log('DONE');
```

- [ ] **Step 3: Run dev + screenshot**

```bash
cd /c/Users/Lucas/Desktop/Sotcksystem/landing-react && (npx vite --port 5174 &) ; sleep 4
node /c/Users/Lucas/shotkit/shoot_landing.mjs
```
Review `C:/Users/Lucas/shotkit/landing/full-desktop.png` and `full-mobile.png`. Confirm: editorial look, serif headlines, red accent, all 9 sections present, demo renders, mobile (390px) doesn't break (nav collapses, grids stack).

- [ ] **Step 4: Fix any responsive/visual issues found**, re-screenshot until clean.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(landing): final assembly + responsive pass"
```

---

## Task 12: Final verification + branch close

- [ ] **Step 1: Full build**

```bash
cd /c/Users/Lucas/Desktop/Sotcksystem/landing-react && npx tsc -b && npx vite build
```
Expected: 0 errors. **Do not proceed if it fails.**

- [ ] **Step 2: Success-criteria checklist** (from spec)
- [ ] Dev server runs, build clean.
- [ ] Editorial look: serif headlines + red accent, visibly superior to `landing-page/`.
- [ ] Demo works (chat → ticket → popup, reset).
- [ ] Contact form opens WhatsApp with correct message.
- [ ] Responsive at 390px.
- [ ] Marketing sections (Hero/Features/Testimonials/Pricing/FAQ) came from Magic.

- [ ] **Step 3: Code review** — run `/code-review` (or `caveman:cavecrew-reviewer`) on the diff; fix findings, re-verify.

- [ ] **Step 4: Close branch** — use `superpowers:finishing-a-development-branch` (merge/PR/keep).

---

## Self-review (done)

- **Spec coverage:** stack (T1), tokens/fonts (T1), content preserved (T2), Nav/Footer/App (T3), demo ported (T4), contact→WhatsApp (T5), Hero/Features/Testimonials/Pricing/FAQ via Magic (T6-T10), responsive + screenshots (T11), success criteria + review + close (T12). All spec sections mapped.
- **Placeholders:** none — config, content, demo, form are full code; Magic tasks give exact prompts + concrete fallbacks so a task never blocks on the MCP.
- **Type consistency:** `content.ts` exports (HERO/FEATURES/TESTIMONIALS/PRICING/FAQ/CONTACT/DEMO_FLOW) consumed verbatim by their components; `Step`/`Msg`/`NEXT` types local to InteractiveDemo; `fadeUp`/`stagger` from `lib/motion.ts` used across Magic sections.
- **Known risk:** the InteractiveDemo port (T4) is the only non-trivial logic — its timer/selection handling is verified by manual interaction in T4 Step 3, not just build.
```
