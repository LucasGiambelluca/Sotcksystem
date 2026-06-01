import { motion } from 'framer-motion';
import { Bot, Monitor, Printer, FlaskConical } from 'lucide-react';
import { FEATURES } from '../data/content';
import { fadeUp, stagger } from '../lib/motion';

const ICONS = { Bot, Monitor, Printer, FlaskConical };

export default function Features() {
  return (
    <section id="funciones" className="py-24">
      <div className="container-x">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-14 text-center text-4xl font-semibold md:text-5xl"
        >
          Todo lo que necesitás
        </motion.h2>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((f) => {
            const Icon = ICONS[f.icon as keyof typeof ICONS];
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <Icon size={24} />
                </div>
                <h3 className="text-xl font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-muted">{f.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
