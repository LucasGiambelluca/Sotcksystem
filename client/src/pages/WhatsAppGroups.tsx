import { useState, useEffect } from 'react';
import { Users, Plus, Link, RefreshCw, Send, Shield, UserPlus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import type { Client } from '../types';

interface Group {
  id: string;
  subject: string;
  owner: string | undefined;
  creation: number | undefined;
  participants: number;
  announce?: boolean; // true if only admins can send
}

export default function WhatsAppGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteLink, setInviteLink] = useState<{ id: string, url: string } | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]); // phones
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null); // For adding participants
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState<string | null>(null); // groupId

  useEffect(() => {
    loadGroups();
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data as Client[]);
  }

  async function loadGroups() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/groups');
      const data = await res.json();
      if (Array.isArray(data)) {
        setGroups(data);
      } else {
        toast.error('Error al cargar grupos');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de conexión con WhatsApp');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    if (selectedClients.length === 0) {
      setIsClientModalOpen(true);
      setTargetGroupId(null); // Indicates creating new group
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('http://localhost:3001/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newGroupName, participants: selectedClients })
      });
      
      if (!res.ok) throw new Error('Falló la creación');
      
      const group = await res.json();
      toast.success(`Grupo "${group.subject}" creado!`);
      setNewGroupName('');
      setSelectedClients([]);
      loadGroups();
    } catch (error) {
      console.error(error);
      toast.error('Error al crear el grupo');
    } finally {
      setCreating(false);
    }
  }

  async function handleAddParticipants() {
    if (!targetGroupId || selectedClients.length === 0) return;

    try {
      const res = await fetch(`http://localhost:3001/api/groups/${targetGroupId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: selectedClients })
      });

      if (!res.ok) throw new Error('Falló al agregar participantes');
      
      toast.success('Participantes agregados');
      setIsClientModalOpen(false);
      setSelectedClients([]);
      setTargetGroupId(null);
      loadGroups();
    } catch (error) {
      toast.error('Error al agregar participantes');
    }
  }

  async function toggleSettings(groupId: string, currentAnnounce: boolean) {
    try {
        const res = await fetch(`http://localhost:3001/api/groups/${groupId}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ announcements: !currentAnnounce })
        });
        if (!res.ok) throw new Error('Falló al actualizar');
        toast.success(`Grupo ${!currentAnnounce ? 'restringido a admins' : 'abierto a todos'}`);
        // Optimistic update
        setGroups(groups.map(g => g.id === groupId ? { ...g, announce: !currentAnnounce } : g));
    } catch (error) {
        toast.error('Error al cambiar configuración');
    }
  }

  async function sendMessage(groupId: string) {
    if (!messageText.trim()) return;
    setSendingMsg(groupId);
    try {
        const res = await fetch(`http://localhost:3001/api/groups/${groupId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageText })
        });
        if (!res.ok) throw new Error('Falló el envío');
        toast.success('Mensaje enviado al grupo');
        setMessageText('');
        setSendingMsg(null);
    } catch (error) {
        toast.error('Error al enviar mensaje');
        setSendingMsg(null);
    }
  }

  async function getInviteLink(groupId: string) {
    try {
      const res = await fetch(`http://localhost:3001/api/groups/${groupId}/invite`);
      if (!res.ok) throw new Error('Error al obtener link');
      const data = await res.json();
      setInviteLink({ id: groupId, url: data.url });
      
      navigator.clipboard.writeText(data.url);
      toast.success('Link copiado al portapapeles');
    } catch (error) {
      toast.error('No se pudo generar el link (¿Sos admin?)');
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="text-green-600" />
            Grupos de Fidelización
          </h2>
          <p className="text-sm text-gray-500">Gestiona comunidades y promociones exclusivas</p>
        </div>
        <button 
          onClick={loadGroups} 
          className="p-2 hover:bg-gray-100 rounded-full"
          title="Recargar"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Create Group Section */}
        <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Crear Nueva Comunidad</h3>
          <div className="flex gap-4 mb-2">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Nombre del grupo (ej: Ofertas VIP)"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              onClick={(e) => {
                 // Trigger modal if name is present
                 if (newGroupName.trim()) handleCreateGroup(e);
              }}
              disabled={creating || !newGroupName}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Seleccionar Contactos
            </button>
          </div>
          <p className="text-xs text-gray-500">
            * Deberás seleccionar al menos un contacto para crear el grupo.
          </p>
        </div>

        {/* Groups List */}
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Tus Grupos Activos</h3>
        
        {loading && groups.length === 0 ? (
          <div className="text-center py-8">Cargando grupos...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No participas en ningún grupo aún.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="bg-white p-5 rounded-lg shadow-sm border hover:shadow-md transition-shadow flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-lg">
                    {group.subject.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="flex gap-2">
                      <button
                        onClick={() => toggleSettings(group.id, !!group.announce)}
                        title={group.announce ? "Solo Admins envían" : "Todos envían"}
                        className={`p-1.5 rounded-full ${group.announce ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                         <Shield size={16} />
                      </button>
                      <button
                        onClick={() => {
                            setTargetGroupId(group.id);
                            setIsClientModalOpen(true);
                        }}
                        className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                        title="Agregar Participantes"
                      >
                         <UserPlus size={16} />
                      </button>
                  </div>
                </div>
                
                <h4 className="font-bold text-lg mb-1 truncate" title={group.subject}>
                  {group.subject}
                </h4>
                <p className="text-xs text-gray-500 mb-4 flex justify-between">
                   <span>ID: {group.id.split('@')[0]}</span>
                   <span className="bg-gray-100 px-2 py-0.5 rounded-full">{group.participants} miembros</span>
                </p>

                <div className="mt-auto space-y-3">
                  {/* Message Input */}
                  <div className="relative">
                     <input 
                        type="text" 
                        placeholder="Enviar mensaje..." 
                        className="w-full pl-3 pr-10 py-2 text-sm border rounded-lg"
                        value={sendingMsg === group.id ? messageText : ''}
                        onChange={e => {
                            if (sendingMsg === group.id || sendingMsg === null) {
                                setSendingMsg(group.id); // Focus this group
                                setMessageText(e.target.value);
                            }
                        }}
                        onBlur={() => !messageText && setSendingMsg(null)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') sendMessage(group.id);
                        }}
                     />
                     <button 
                        className="absolute right-2 top-2 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        onClick={() => sendMessage(group.id)}
                        disabled={!messageText || (sendingMsg !== null && sendingMsg !== group.id)}
                     >
                        <Send size={16} />
                     </button>
                  </div>

                  <button
                    onClick={() => getInviteLink(group.id)}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-xs font-medium border"
                  >
                    <Link className="w-3 h-3" />
                    Link de Invitación
                  </button>
                  
                  {inviteLink?.id === group.id && (
                    <div className="text-xs bg-green-50 p-2 rounded border break-all cursor-pointer hover:bg-green-100" onClick={() => {
                        navigator.clipboard.writeText(inviteLink.url);
                        toast.success('Copiado!');
                    }}>
                      <p className="text-green-800 font-medium mb-1">Link generado (click para copiar):</p>
                      <span className="text-green-600">{inviteLink.url}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Selection Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">
                        {targetGroupId ? 'Agregar Participantes' : 'Seleccionar Contactos para Grupo'}
                    </h3>
                    <button onClick={() => {
                        setIsClientModalOpen(false);
                        setSelectedClients([]);
                        setTargetGroupId(null);
                    }} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        className="w-full px-3 py-2 border rounded-lg mb-4" 
                        onChange={() => {
                            // Simple client side filter could be added here
                        }}
                    />
                    <div className="space-y-2">
                        {clients.map(client => (
                            <div key={client.id} 
                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border ${selectedClients.includes(client.phone || '') ? 'bg-green-50 border-green-500' : 'hover:bg-gray-50 border-gray-200'}`}
                                onClick={() => {
                                    const phone = client.phone;
                                    if (!phone) return;
                                    if (selectedClients.includes(phone)) {
                                        setSelectedClients(selectedClients.filter(p => p !== phone));
                                    } else {
                                        setSelectedClients([...selectedClients, phone]);
                                    }
                                }}
                            >
                                <div>
                                    <p className="font-medium">{client.name}</p>
                                    <p className="text-sm text-gray-500">{client.phone}</p>
                                </div>
                                {selectedClients.includes(client.phone || '') && (
                                    <Check className="w-5 h-5 text-green-600" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end gap-3">
                    <span className="text-sm text-gray-500 self-center mr-auto">
                        {selectedClients.length} seleccionados
                    </span>
                    <button 
                        onClick={() => {
                             if (targetGroupId) {
                                 handleAddParticipants();
                             } else {
                                 handleCreateGroup({ preventDefault: () => {} } as any);
                                 setIsClientModalOpen(false);
                             }
                        }}
                        disabled={selectedClients.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {targetGroupId ? 'Agregar Participantes' : 'Crear Grupo'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
