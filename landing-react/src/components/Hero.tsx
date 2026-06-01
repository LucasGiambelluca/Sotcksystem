import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { HERO } from '../data/content';
import { fadeUp, stagger } from '../lib/motion';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24">
      {/* soft editorial background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 right-0 h-[480px] w-[480px] rounded-full bg-primary-light opacity-60 blur-3xl" />
        <div className="absolute top-40 -left-24 h-80 w-80 rounded-full bg-slate-100 opacity-70 blur-3xl" />
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="container-x max-w-4xl text-center">
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Gastronomía automatizada
        </motion.span>

        <motion.h1 variants={fadeUp} className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl">
          {HERO.title}
        </motion.h1>

        <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg text-muted md:text-xl">
          {HERO.subtitle}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="#demo" className="btn-primary text-base">
            Ver Demo Real <ArrowRight size={18} />
          </a>
          <a href="#precios" className="btn-ghost text-base">Ver Precios</a>
        </motion.div>

        <motion.div variants={fadeUp} className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-slate-100 pt-8">
          {HERO.stats.map((s) => (
            <div key={s.label}>
              <div className="font-serif text-4xl font-semibold text-primary">{s.value}</div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
