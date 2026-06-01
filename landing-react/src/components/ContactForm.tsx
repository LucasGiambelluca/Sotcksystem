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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Tu Nombre"
            className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            required
            placeholder="Nombre de tu Negocio"
            className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            type="tel"
            placeholder="WhatsApp / Teléfono"
            className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="btn-primary !bg-[#25d366] !shadow-none w-full hover:!bg-[#1ebe5d]">
            <MessageCircle size={20} /> Enviar por WhatsApp
          </button>
        </form>
      </div>
    </section>
  );
}
