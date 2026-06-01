# Landing Page — Rediseño editorial en React + Magic (21st.dev)

**Fecha:** 2026-05-31
**Estado:** Diseño aprobado. Implementación bloqueada hasta reiniciar Claude Code (cargar tools de Magic MCP).

## Objetivo

Llevar la landing de Sotcksystem (`landing-page/`, HTML vanilla) a otro nivel visual: una app **React + Tailwind** nueva, estética **editorial limpia** (claro, mucho aire, titulares serif, acento rojo puntual), con componentes generados vía **Magic / 21st.dev** y animaciones de scroll sutiles. Se preserva el demo interactivo (WhatsApp → ticket) y la lógica de contacto por WhatsApp.

## Stack

- **Vite + React 19 + TypeScript** (app standalone en `landing-react/`, no toca `client/`).
- **Tailwind CSS** para estilos.
- **Framer Motion** (`motion`) para scroll-reveal sutil (fade/slide-in, sin exceso).
- **Magic MCP (`@21st-dev/magic`)** para generar los componentes de marketing (hero, features, pricing, testimonios, FAQ). Requiere reinicio de Claude Code para que las tools carguen.
- **Fuentes:** display serif para titulares (Fraunces o Instrument Serif vía Google Fonts) + Inter para cuerpo/UI.
- **Iconos:** lucide-react (consistente con el client) en vez de Font Awesome.

## Sistema visual

- **Colores** (heredados del brand, ya en la landing actual):
  - primary `#e11d48`, primary-hover `#be123c`, primary-light `#fff1f2`
  - navy `#0f172a`, surface `#1e293b`, texto `#1e293b`, muted `#64748b`
  - fondo base claro (`#ffffff` / `#f8fafc`)
- **Tipografía:** titulares en serif (peso 400-600, tamaños grandes, line-height ajustado); cuerpo Inter 400-600.
- **Acento rojo puntual:** CTAs, subrayados, números de stats, checks de pricing. No saturar.
- **Sombras suaves + bordes redondeados** (rounded-2xl/3xl), mucho whitespace.
- **Motion:** secciones aparecen con fade+translateY corto al entrar en viewport (una vez, `viewport={{ once: true }}`).

## Secciones (orden + responsabilidad)

| # | Sección | Fuente | Notas |
|---|---------|--------|-------|
| 1 | Nav sticky (glass blur) | custom | logo + links (Funciones/Demo/Precios) + CTA "Empezar Ahora" |
| 2 | **Hero** editorial | Magic | titular serif XL + subtítulo + 2 CTAs (Ver Demo / Precios) + tira de stats (90% pedidos automáticos · 24/7 · cero errores) |
| 3 | **Demo interactivo** WhatsApp → ticket | **portado a React** | chat animado del bot + impresión de comanda + popup "nuevo pedido". Lógica del `flow` y timers preservada, reescrita como componente React con estado. ES EL DIFERENCIAL — no se simplifica. |
| 4 | **Features** bento editorial | Magic | 3-4 cards con jerarquía (Bot inteligente, Panel simple, Comandas, Stock/Recetas) |
| 5 | Testimonios | Magic | grid o marquee editorial. 3 testimonios actuales (Carlos M. / Julia R. / Roberto K.) |
| 6 | Pricing | Magic | card única destacada "Sotcksystem Full" $50.000/mes + 5 features con check |
| 7 | FAQ accordion | Magic | 3 preguntas actuales, accordion accesible |
| 8 | Contacto → WhatsApp | **portado a React** | form (nombre/negocio/teléfono) que abre `https://wa.me/5492915093499?text=...` con el mensaje armado |
| 9 | Footer | custom | copyright |

## Qué se preserva del original (verbatim en contenido)

- **Demo interactivo**: el objeto `flow` (start/menu/address/final), los botones de chat, la secuencia de impresión del ticket y el popup. Se reimplementa en React (estado + `useEffect`/timers) manteniendo el comportamiento.
- **Form de contacto → WhatsApp**: número `5492915093499`, formato del mensaje.
- **Copy**: titulares, subtítulos, testimonios, FAQ, precio ($50.000/mes), CTAs.
- **Datos de contacto y branding** (logo `images/logo.png`, colores).

## Uso de Magic / 21st.dev

Tras el reinicio, por cada sección marcada "Magic": pedir a Magic un componente que matchee la dirección editorial (claro, serif titulares, acento rojo, sombras suaves), luego ajustar copy/branding y ensamblar. Magic devuelve React+Tailwind → encaja directo. Las secciones "custom"/"portado" las escribo a mano (Magic no aplica al demo con lógica propia).

## Deployment

- `landing-react/` build estático (`vite build` → `dist/`). Servible igual que la landing actual (estático). El deploy concreto (Caddy/host) se resuelve en el plan; no cambia la arquitectura del proyecto.
- La landing vanilla actual (`landing-page/`) se deja intacta hasta validar la nueva; luego se decide reemplazo.

## Criterios de éxito

1. `landing-react/` levanta con `npm run dev` y buildea sin errores (`tsc -b && vite build`).
2. Estética editorial clara con titulares serif + acento rojo, visiblemente superior a la actual (verificación por screenshot).
3. Demo interactivo funciona igual que el original (chat → ticket → popup).
4. Form de contacto abre WhatsApp con el mensaje correcto.
5. Responsive (mobile ≤768px no rompe).
6. Componentes de marketing generados con Magic (no a mano), salvo demo/form/nav/footer.

## Fuera de alcance (v1)

- Reemplazo/borrado de `landing-page/` (decisión posterior).
- Backend / CMS para el contenido (todo estático/hardcoded como hoy).
- i18n, A/B testing, analytics.
- Integración dentro de `client/` (es app separada).

## Decisiones tomadas

- Stack: React+Tailwind+Magic (vs vanilla a mano).
- Vibe: editorial light (vs dark premium / brutalist).
- Titulares: display serif (vs solo Inter).
- Ubicación: `landing-react/` nueva (vs reemplazar in-place).
