import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { TESTIMONIALS } from '../data/content';
import { fadeUp, stagger } from '../lib/motion';

export default function Testimonials() {
  return (
    <section id="testimonios" className="bg-slate-50 py-24">
      <div className="container-x">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-14 text-center text-4xl font-semibold md:text-5xl"
        >
          Lo que dicen nuestros clientes
        </motion.h2>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-6 md:grid-cols-3"
        >
          {TESTIMONIALS.map((t) => (
            <motion.div key={t.name} variants={fadeUp} className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
              <Quote size={28} className="text-primary/30" />
              <p className="mt-4 italic leading-relaxed text-slate-600">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-200 font-bold text-muted">{t.initials}</div>
                <div>
                  <div className="text-sm font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-muted">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
