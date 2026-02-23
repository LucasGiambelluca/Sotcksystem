import { useState, useEffect } from 'react';
import { X, MessageCircle, Check, AlertCircle } from 'lucide-react';
import { parseOrderFromText } from '../services/orderService';
import type { Product } from '../types';

interface ParsedItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface WhatsAppImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ParsedItem[], originalText: string) => void;
  products: Product[];
}

export default function WhatsAppImport({
  isOpen,
  onClose,
  onImport,
  products,
}: WhatsAppImportProps) {
  const [text, setText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);

  useEffect(() => {
    if (text.trim()) {
      const items = parseOrderFromText(text, products);
      setParsedItems(items);
    } else {
      setParsedItems([]);
    }
  }, [text, products]);

  const handleImport = () => {
    if (parsedItems.length > 0) {
      onImport(parsedItems, text);
      setText('');
      setParsedItems([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-green-50">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold">Importar desde WhatsApp</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-green-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pega aquí el mensaje de WhatsApp
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ejemplo:&#10;Hola! Quiero:&#10;2 coca cola&#10;3x pan integral&#10;1 leche"
              className="w-full h-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              El sistema detectará automáticamente cantidades y productos
            </p>
          </div>

          {/* Parsed Items Preview */}
          {text.trim() && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                {parsedItems.length > 0 ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    Productos Detectados ({parsedItems.length})
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    No se detectaron productos
                  </>
                )}
              </h3>

              {parsedItems.length > 0 ? (
                <div className="space-y-2">
                  {parsedItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-600">
                          ${item.unit_price.toFixed(2)} c/u
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{item.quantity}x</p>
                        <p className="text-sm text-gray-600">
                          ${(item.quantity * item.unit_price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-green-300">
                    <p className="font-bold">Total</p>
                    <p className="font-bold text-xl text-green-700">
                      $
                      {parsedItems
                        .reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
                        .toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    No se pudieron detectar productos. Asegúrate de incluir cantidades
                    (ej: "2 coca cola" o "coca cola x2")
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={parsedItems.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Importar Pedido
          </button>
        </div>
      </div>
    </div>
  );
}
