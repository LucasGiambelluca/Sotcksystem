import React from 'react';
import { CheckCircle2, TrendingUp, Clock, DollarSign } from "lucide-react";

// Inline custom components to replace external UI library dependencies
const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);
const CardHeader = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`p-6 pb-2 border-b border-transparent ${className}`}>
    {children}
  </div>
);
const CardTitle = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <h3 className={`font-semibold text-slate-900 leading-none tracking-tight ${className}`}>
    {children}
  </h3>
);
const CardContent = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`p-6 pt-4 ${className}`}>
    {children}
  </div>
);

export default function PricingPresentation() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Encabezado */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Propuesta de Valor & Estimación de Costos
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Análisis de rentabilidad y modelo de negocio para el Sistema de Gestión con WhatsApp Integrado.
          </p>
        </div>

        {/* Sección de Costos Operativos */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <DollarSign className="text-blue-600" />
            Tus Costos Operativos Estimados (Mensual por Cliente)
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Infraestructura Base</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900 mb-2">~$5 - $10 USD</div>
                <p className="text-sm text-slate-500 mb-4">Aprox. $5.000 - $10.000 ARS</p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" /> Servidores (Railway/Render)</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" /> Base de Datos (Supabase)</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" /> Almacenamiento imágenes</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">IA & Procesamiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900 mb-2">~$2 - $5 USD</div>
                <p className="text-sm text-slate-500 mb-4">Aprox. $2.000 - $5.000 ARS</p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" /> OpenAI (Clasificador de intenciones)</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" /> Procesamiento de lenguaje</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500 mt-0.5" /> *Depende del volumen de chats</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-blue-900">Total Costo Unitario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 mb-2">~$10 - $15 USD</div>
                <p className="text-sm text-blue-600 mb-4">Aprox. $10.000 - $15.000 ARS max.</p>
                <p className="text-sm text-blue-800">
                  Este es tu costo real por mantener a un cliente activo en la plataforma cada mes.
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-slate-500 italic">
            *Nota: Asumiendo que usas WhatsApp Web (Baileys) como tienes configurado ahora, no pagas por mensaje a Meta. Si cambiaras a la API Oficial de Meta, el cliente debería pagar sus propios mensajes.
          </p>
        </section>

        {/* Modelo Propuesto */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <TrendingUp className="text-emerald-600" />
            Tu Modelo de Cobro Propuesto
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle>Setup Inicial (Una vez)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 mb-4">$60.000 ARS</div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Instalación y configuración del entorno</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Carga inicial del catálogo de productos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Vinculación del número de WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Capacitación básica de uso (1 hora)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle>Suscripción Mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-slate-900 mb-4">$50.000 ARS</div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Acceso al CRM y gestor de pedidos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Chatbot IA 24/7 en WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Catálogo público e-commerce</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Módulo de optimización de rutas y escáner</span>
                  </li>
                </ul>
                <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="font-semibold text-emerald-800">Tu Margen de Ganancia Neto:</p>
                  <p className="text-2xl font-bold text-emerald-600">~$35.000 a $40.000 ARS / mes / cliente</p>
                  <p className="text-xs text-emerald-700 mt-1">(Restando los $10k-$15k de infraestructura)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ROI para el Cliente */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Clock className="text-purple-600" />
            Cómo Venderlo: El ROI (Retorno) para tu Cliente
          </h2>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-lg text-slate-700 mb-6">
              Cuando un cliente te diga "es caro", tu argumento de venta no es el software, es el <strong>tiempo y dinero que le ahorras</strong>.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-red-600 flex items-center gap-2">
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">Problema</span> Sin tu sistema
                </h3>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                    <span>Empleado respondiendo "precio?" todo el día (Sueldo: $500k+ ARS)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                    <span>Errores armando pedidos en Excel/Papel.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                    <span>Repartidor haciendo rutas ineficientes, gastando más nafta.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-green-600 flex items-center gap-2">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">Solución</span> Con tu sistema ($50k/mes)
                </h3>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                    <span>El Bot atiende 24/7 y toma el pedido automático. (Ahorro: 1 empleado o muchísimas horas del dueño).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                    <span>Rutas optimizadas. (Ahorro en nafta/tiempo del repartidor).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                    <span>Venden de noche cuando el local está cerrado.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 bg-slate-100 rounded-lg text-center">
              <p className="font-medium text-slate-800">
                "Por el 10% del sueldo de un empleado administrativo, tenés un asistente trabajando 24 horas, una tienda online y logística automatizada."
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
