import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Users, ArrowRight } from 'lucide-react';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import type { Client, Product } from '../types';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (open) {
      Promise.all([
        clientService.getAll(),
        productService.getAll()
      ]).then(([clientsData, productsData]) => {
        setClients(clientsData);
        setProducts(productsData);
      });
    }
  }, [open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Search"
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 p-2"
    >
      <div className="flex items-center border-b border-gray-100 px-3 pb-2 mb-2">
        <Search className="text-gray-400 mr-2" size={20} />
        <Command.Input 
          placeholder="Buscar clientes o productos..." 
          className="w-full outline-none text-lg placeholder:text-gray-400"
        />
      </div>
      
      <Command.List className="max-h-[300px] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-gray-500">
          No se encontraron resultados.
        </Command.Empty>

        {clients.length > 0 && (
          <Command.Group heading="Clientes" className="text-xs font-medium text-gray-400 mb-2">
            {clients.map((client) => (
              <Command.Item
                key={client.id}
                onSelect={() => {
                  setOpen(false);
                  navigate(`/clients/${client.id}`);
                }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-700 aria-selected:bg-primary-50 aria-selected:text-primary-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-50 p-2 rounded-full">
                    <Users size={16} className="text-blue-600" />
                  </div>
                  <span className="text-sm font-medium">{client.name}</span>
                </div>
                <ArrowRight size={16} className="opacity-0 group-hover:opacity-100" />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {products.length > 0 && (
          <Command.Group heading="Productos" className="text-xs font-medium text-gray-400 mb-2 mt-4">
            {products.map((product) => (
              <Command.Item
                key={product.id}
                onSelect={() => {
                  setOpen(false);
                  navigate('/products');
                  // Ideally we would highlight the product or open a modal
                }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-700 aria-selected:bg-primary-50 aria-selected:text-primary-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-50 p-2 rounded-full">
                    <Package size={16} className="text-orange-600" />
                  </div>
                  <span className="text-sm font-medium">{product.name}</span>
                </div>
                <span className="text-xs text-gray-500">{product.stock} unid.</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
