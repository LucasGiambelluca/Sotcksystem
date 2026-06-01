import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Printer, MessageCircle, Monitor } from 'lucide-react';
import { DEMO_FLOW } from '../data/content';

type Step = keyof typeof DEMO_FLOW;
type Msg = { side: 'bot' | 'user'; text: string };

const NEXT: Record<Step, Step | 'restart'> = {
  start: 'menu',
  menu: 'address',
  address: 'final',
  final: 'restart',
};

export default function InteractiveDemo() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [buttons, setButtons] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('start');
  const [ticket, setTicket] = useState<{ item: string; price: number } | null>(null);
  const [popup, setPopup] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  // selection persists across the address step (where no item is chosen) into the final ticket
  const selection = useRef<{ item: string; price: number }>({ item: 'Pizza Pepperoni', price: 5200 });

  const at = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const runStep = useCallback((s: Step) => {
    setStep(s);
    setMessages((m) => [...m, { side: 'bot', text: DEMO_FLOW[s].text }]);
    at(500, () => setButtons([...DEMO_FLOW[s].btns]));
    if (s === 'final') {
      at(1000, () => {
        setTicket({ ...selection.current });
        setPopup(`${selection.current.item} - Delivery`);
        at(4000, () => setPopup(null));
      });
    }
  }, [at]);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setButtons([]);
    setTicket(null);
    setPopup(null);
    at(400, () => runStep('start'));
  }, [at, runStep]);

  const choose = (label: string) => {
    setMessages((m) => [...m, { side: 'user', text: label }]);
    setButtons([]);
    if (label.includes('Pizza')) selection.current = { item: 'Pizza Pepperoni', price: 5200 };
    if (label.includes('Burguer')) selection.current = { item: 'Hamburguesa Especial', price: 4800 };
    const next = NEXT[step];
    at(800, () => (next === 'restart' ? reset() : runStep(next)));
  };

  useEffect(() => {
    reset();
    return () => timers.current.forEach(clearTimeout);
  }, [reset]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, buttons]);

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
                  <div
                    key={i}
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-line ${
                      m.side === 'bot' ? 'bg-white self-start' : 'bg-[#dcf8c6] self-end'
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
                {buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {buttons.map((b) => (
                      <button key={b} onClick={() => choose(b)} className="bg-primary text-white text-xs px-3 py-1.5 rounded-full">
                        {b}
                      </button>
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
              <div className="bg-navy text-white p-4 font-semibold flex items-center gap-2">
                <Monitor size={18} /> Panel de Control
              </div>
              <div className="h-[400px] bg-slate-100 p-5 flex items-center justify-center">
                {ticket ? (
                  <div className="bg-white w-64 p-5 shadow-md">
                    <h3 className="text-center border-b border-dashed border-black pb-1 mb-2 text-base font-bold">SOTCKSYSTEM</h3>
                    <div className="flex justify-between font-mono text-xs">
                      <span>1x {ticket.item}</span>
                      <span>${ticket.price}</span>
                    </div>
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
          <button onClick={reset} className="btn-primary !bg-slate-700 hover:!bg-slate-800">Reiniciar Demo</button>
        </div>
      </div>

      {/* Popup */}
      <div
        className={`fixed top-5 z-[9999] w-72 bg-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-l-4 border-primary transition-all duration-500 ${
          popup ? 'right-5' : '-right-96'
        }`}
      >
        <div className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center">
          <Bell size={18} />
        </div>
        <div>
          <h4 className="m-0 text-sm font-bold">¡Nuevo Pedido!</h4>
          <p className="m-0 text-xs text-muted">{popup ?? ''}</p>
        </div>
      </div>
    </section>
  );
}
