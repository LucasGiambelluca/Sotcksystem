import { useWhatsAppInbox } from '../hooks/useWhatsAppInbox';
import { sendCatalog } from '../services/whatsappService';
import {
  MessageCircle,
  Send,
  Settings,
  ShoppingCart,
  Search,
  User,
  Phone,
  ArrowLeft,
  FileText,
  UserPlus,
  Users,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppInbox() {
  const {
    navigate, conversations, activeConvoId, messages, newMessage, setNewMessage,
    sending, searchTerm, setSearchTerm, showMobileChat, setShowMobileChat,
    isContactModalOpen, setIsContactModalOpen, contactForm, setContactForm,
    messagesEndRef, sidebarTab, setSidebarTab, loadingContacts,
    contactSearch, setContactSearch, activeConvo, filteredConversations,
    attentionCount, filteredContacts, selectConversation, handleContactClick,
    handleSend, handleTakeControl, handleConvertToOrder, handleResolveHandover, handleSaveContact,
    openContactModal, formatTime, formatDate,
  } = useWhatsAppInbox();

  return (
    <div className="flex h-full bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`w-full md:w-96 bg-white border-r flex flex-col ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b bg-green-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold">WhatsApp</h2>
            </div>
            <button
              onClick={() => navigate('/whatsapp/connect')}
              className="p-2 hover:bg-green-100 rounded-lg"
              title="Configuración"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Tab Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
            <button
              onClick={() => setSidebarTab('chats')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                sidebarTab === 'chats'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Chats
            </button>
            <button
              onClick={() => setSidebarTab('attention')}
              className={`flex-1 relative flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                sidebarTab === 'attention'
                  ? 'bg-white text-red-600 shadow-sm'
                  : attentionCount > 0 
                    ? 'text-red-500 hover:text-red-600 animate-pulse bg-red-50' 
                    : 'text-gray-600 hover:text-red-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Atención
              {attentionCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                  {attentionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab('contacts')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                sidebarTab === 'contacts'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-green-800'
              }`}
            >
              <Users className="w-4 h-4" />
              Directorio
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={sidebarTab === 'chats' ? searchTerm : contactSearch}
              onChange={(e) =>
                sidebarTab === 'chats' ? setSearchTerm(e.target.value) : setContactSearch(e.target.value)
              }
              placeholder={sidebarTab === 'chats' ? 'Buscar conversación...' : 'Buscar contacto...'}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto w-full">
          {sidebarTab === 'chats' || sidebarTab === 'attention' ? (
            /* ===== CHATS OR ATTENTION TAB ===== */
            filteredConversations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {sidebarTab === 'attention' ? (
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                ) : (
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                )}
                <p className="text-sm">{sidebarTab === 'attention' ? 'No hay clientes esperando' : 'No hay conversaciones'}</p>
                <p className="text-xs mt-1">Los mensajes aparecerán aquí automáticamente</p>
              </div>
            ) : (
              filteredConversations.map((convo) => (
                <div
                  key={convo.id}
                  onClick={() => selectConversation(convo)}
                  className={`flex items-center gap-3 p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors ${
                    activeConvoId === convo.id ? 'bg-green-50 border-l-4 border-l-green-600' : ''
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${convo.status === 'HANDOVER' ? 'bg-red-100' : 'bg-green-100'}`}>
                    <User className={`w-6 h-6 ${convo.status === 'HANDOVER' ? 'text-red-600' : 'text-green-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-semibold truncate">
                        {convo.client?.name || convo.contact_name || convo.phone}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatDate(convo.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate flex-1 ${convo.status === 'HANDOVER' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {convo.status === 'HANDOVER' ? '🚨 Esperando operador...' : (convo.last_message || 'Sin mensajes')}
                      </p>
                      {convo.unread_count > 0 && (
                        <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {convo.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            /* ===== CONTACTS TAB ===== */
            loadingContacts ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay contactos</p>
                <p className="text-xs mt-1">Los contactos se crean al guardar un cliente</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b bg-gray-50">
                  <span className="text-xs text-gray-500 font-medium">{filteredContacts.length} contacto{filteredContacts.length !== 1 ? 's' : ''}</span>
                </div>
                {filteredContacts.map((contact) => {
                  const hasConvo = conversations.some(
                    (c) => c.phone === contact.phone || c.client_id === contact.id
                  );
                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleContactClick(contact)}
                      className="flex items-center gap-3 p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${hasConvo ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <User className={`w-6 h-6 ${hasConvo ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{contact.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {contact.phone && (
                            <span className="flex items-center gap-1 truncate">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.address && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {contact.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {hasConvo && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Chat</span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          <Calendar className="w-3 h-3 inline mr-0.5" />
                          {new Date(contact.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={`flex-1 flex flex-col ${
          !showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConvo ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white flex items-center gap-3">
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-1 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {activeConvo.client?.name || activeConvo.contact_name || activeConvo.phone}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {activeConvo.phone}
                </p>
              </div>

              {activeConvo.status === 'HANDOVER' && (
                <>
                  <span className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium rounded animate-pulse">
                    🚨 Esperando Operador
                  </span>
                  <button
                    onClick={handleResolveHandover}
                    className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 text-sm font-medium rounded ml-2"
                    title="Devolver control al bot automático"
                  >
                    Confirmar y Volver al Bot
                  </button>
                </>
              )}

              {activeConvo.status !== 'HANDOVER' && (
                <button
                  onClick={handleTakeControl}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 text-sm font-medium rounded border border-gray-200"
                  title="Silenciar el bot y atender manualmente"
                >
                  Atención Manual
                </button>
              )}

              <button
                onClick={openContactModal}
                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Editar Contacto"
              >
                <UserPlus className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
                  if (!activeConvo) return;
                  toast.promise(sendCatalog(activeConvo.phone), {
                    loading: 'Enviando catálogo...',
                    success: 'Catálogo enviado',
                    error: 'Error al enviar catálogo',
                  });
                }}
                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Enviar Catálogo de Stock"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d1d5db\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm transform transition-all animate-in slide-in-from-bottom-2 ${
                      msg.direction === 'OUTBOUND'
                        ? 'bg-gradient-to-br from-green-50 to-green-100 text-gray-900 rounded-br-sm border border-green-200'
                        : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {msg.content}
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-1.5 opacity-80">
                      <span className="text-[10px] font-medium text-gray-500">{formatTime(msg.timestamp)}</span>
                      {msg.direction === 'INBOUND' && (
                        <button
                          onClick={() => handleConvertToOrder(msg.content || '')}
                          className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded-full transition-colors"
                          title="Convertir en Pedido"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t bg-[#f0f2f5] flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escribe un mensaje aquí..."
                className="flex-1 px-5 py-3 bg-white border-none rounded-full focus:ring-1 focus:ring-green-500 text-sm shadow-sm"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm flex-shrink-0"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-16 h-16 text-green-200" />
              </div>
              <h3 className="text-2xl font-bold text-gray-700 mb-2">WhatsApp Inbox</h3>
              <p className="text-gray-500 mb-6 max-w-md">
                Selecciona una conversación de la lista o espera a que lleguen nuevos mensajes.
                Los pedidos se pueden crear directamente desde los mensajes.
              </p>
              <button
                onClick={() => navigate('/whatsapp/connect')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Configurar Conexión
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Editar Contacto</h3>
              <button onClick={() => setIsContactModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Zona</label>
                <input
                  type="text"
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Ej. Zona Centro o Calle 123"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
