import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { PRICING } from '../data/content';
import { fadeUp } from '../lib/motion';

export default function Pricing() {
  return (
    <section id="precios" className="py-24">
      <div className="container-x">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-14 text-center text-4xl font-semibold md:text-5xl"
        >
          Un solo plan, todo incluido
        </motion.h2>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative mx-auto max-w-md"
        >
          <div className="absolute -inset-1 rounded-[2.2rem] bg-gradient-to-b from-primary/20 to-transparent blur-xl" />
          <div className="relative rounded-4xl border border-slate-100 bg-white p-10 shadow-xl">
            <h3 className="text-xl font-semibold text-ink">{PRICING.name}</h3>
            <div className="mt-4 flex items-end gap-1">
              <span className="font-serif text-5xl font-semibold text-primary">{PRICING.price}</span>
              <span className="mb-1 text-muted">{PRICING.period}</span>
            </div>
            <ul className="mt-8 space-y-3 text-left">
              {PRICING.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-slate-700">
                  <Check size={18} className="shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <a href="#contacto" className="btn-primary mt-9 w-full">Lo quiero ahora</a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
