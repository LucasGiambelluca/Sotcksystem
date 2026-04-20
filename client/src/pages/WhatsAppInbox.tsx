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
    <div className="flex h-full bg-[#f8fafc] overflow-hidden font-sans selection:bg-green-100 selection:text-green-900">
      {/* Sidebar */}
      <div
        className={`w-full md:w-[400px] bg-white/80 backdrop-blur-xl border-r border-gray-200/50 flex flex-col shadow-2xl z-20 ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-green-50/50 to-white/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-600 rounded-2xl shadow-lg shadow-green-200 rotate-3 transition-transform hover:rotate-0">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-700 to-green-500">
                  Inbox
                </h2>
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Canal WhatsApp</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/whatsapp/connect')}
              className="p-2.5 hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 text-gray-400 hover:text-green-600"
              title="Configuración"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Toggle - Premium Neumorphic look */}
          <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-4 backdrop-blur-sm">
            <button
              onClick={() => setSidebarTab('chats')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                sidebarTab === 'chats'
                  ? 'bg-white text-green-700 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] scale-[1.02]'
                  : 'text-gray-500 hover:text-green-600 hover:bg-white/50'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Chats
            </button>
            <button
              onClick={() => setSidebarTab('attention')}
              className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                sidebarTab === 'attention'
                  ? 'bg-white text-rose-600 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] scale-[1.02]'
                  : attentionCount > 0 
                    ? 'text-rose-500 bg-rose-50/50 animate-pulse' 
                    : 'text-gray-500 hover:text-rose-500 hover:bg-white/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Atención
              {attentionCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black ring-4 ring-white shadow-lg animate-bounce">
                  {attentionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab('contacts')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                sidebarTab === 'contacts'
                  ? 'bg-white text-green-700 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] scale-[1.02]'
                  : 'text-gray-500 hover:text-green-600 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Directorio
            </button>
          </div>

          {/* Search Bar - Floating style */}
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-green-500 transition-colors" />
            <input
              type="text"
              value={sidebarTab === 'chats' ? searchTerm : contactSearch}
              onChange={(e) =>
                sidebarTab === 'chats' ? setSearchTerm(e.target.value) : setContactSearch(e.target.value)
              }
              placeholder={sidebarTab === 'chats' ? 'Buscar mensajes...' : 'Buscar en el directorio...'}
              className="w-full pl-11 pr-4 py-3 bg-white border-none rounded-2xl text-sm shadow-sm ring-1 ring-gray-200/50 focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-gray-400"
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
              <div className="divide-y divide-gray-50">
                {filteredConversations.map((convo) => (
                  <div
                    key={`${convo.id}-${convo.phone}`}
                    onClick={() => selectConversation(convo)}
                    className={`group relative flex items-center gap-4 p-5 cursor-pointer transition-all duration-300 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
                      activeConvoId === convo.id ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-10' : ''
                    }`}
                  >
                    {activeConvoId === convo.id && (
                      <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-green-500 rounded-r-full shadow-[0_0_12px_rgba(34,197,94,0.4)]" />
                    )}
                    
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
                        convo.status === 'HANDOVER' 
                          ? 'bg-gradient-to-br from-rose-100 to-rose-50 shadow-sm' 
                          : 'bg-gradient-to-br from-green-100 to-green-50 shadow-sm'
                      }`}>
                        <User className={`w-7 h-7 ${convo.status === 'HANDOVER' ? 'text-rose-600' : 'text-green-600'}`} />
                      </div>
                      {convo.status === 'HANDOVER' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white shadow-sm ring-1 ring-rose-200 animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-bold text-[15px] text-gray-900 truncate tracking-tight">
                          {convo.client?.name || convo.contact_name || convo.phone}
                        </h3>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter ml-2">
                          {formatDate(convo.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-[13px] truncate flex-1 leading-tight ${
                          convo.status === 'HANDOVER' ? 'text-rose-600 font-bold' : 'text-gray-500'
                        }`}>
                          {convo.status === 'HANDOVER' ? '⚠️ Atencion Urgente' : (convo.last_message || 'Inicia conversación')}
                        </p>
                        {convo.unread_count > 0 && (
                          <div className="flex items-center justify-center bg-green-600 text-white text-[10px] h-5 min-w-[20px] px-1 rounded-full font-black shadow-lg shadow-green-200">
                            {convo.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ===== CONTACTS TAB ===== */
            loadingContacts ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full shadow-lg shadow-green-100" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-inner">
                  <Users className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="font-bold text-gray-700">Directorio Vacío</h3>
                <p className="text-xs text-gray-400 mt-1">Los contactos aparecerán aquí en cuanto guardes los datos del cliente.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                <div className="px-6 py-3 bg-gray-50/50 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-100">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">{filteredContacts.length} Contactos Registrados</span>
                </div>
                {filteredContacts.map((contact) => {
                  const hasConvo = conversations.some(
                    (c) => c.phone === contact.phone || c.client_id === contact.id
                  );
                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleContactClick(contact)}
                      className="group flex items-center gap-4 p-5 cursor-pointer hover:bg-white hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all"
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${hasConvo ? 'bg-green-100/50 shadow-sm' : 'bg-gray-100 shadow-sm'}`}>
                        <User className={`w-7 h-7 ${hasConvo ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] text-gray-900">{contact.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          {contact.phone && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              <Phone className="w-3 h-3" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.address && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-400 truncate max-w-[120px]">
                              <MapPin className="w-3 h-3" />
                              {contact.address}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {hasConvo && (
                          <span className="text-[9px] uppercase font-black bg-green-500 text-white px-2 py-0.5 rounded-md shadow-sm shadow-green-100">Activo</span>
                        )}
                        <span className="text-[10px] font-bold text-gray-300">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={`flex-1 flex flex-col bg-[#f0f2f5] relative overflow-hidden ${
          !showMobileChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConvo ? (
          <>
            {/* Chat Header - Premium Glass */}
            <div className="h-20 px-6 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center gap-4 z-10 shadow-sm">
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-xl text-gray-500"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="relative">
                 <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl flex items-center justify-center shadow-sm">
                   <User className="w-6 h-6 text-green-600" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[17px] text-gray-900 leading-tight">
                  {activeConvo.client?.name || activeConvo.contact_name || activeConvo.phone}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {activeConvo.phone}
                    </span>
                    {activeConvo.status === 'HANDOVER' && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 animate-pulse bg-rose-50 px-2 py-0.5 rounded-md">
                            ⚠️ Manual
                        </span>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeConvo.status === 'HANDOVER' ? (
                  <button
                    onClick={handleResolveHandover}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white hover:bg-green-700 text-sm font-bold rounded-2xl shadow-lg shadow-green-200 transition-all active:scale-95"
                  >
                    Atención Finalizada
                  </button>
                ) : (
                  <button
                    onClick={handleTakeControl}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 hover:bg-rose-50 hover:text-rose-600 text-sm font-bold rounded-2xl border border-gray-100 shadow-sm transition-all active:scale-95"
                  >
                    Tomar Control
                  </button>
                )}

                <div className="w-[1px] h-8 bg-gray-100 mx-2" />

                <button
                  onClick={openContactModal}
                  className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all"
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
                  className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all"
                  title="Enviar Catálogo"
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Body - WhatsApp style background but polished */}
            <div
              className="flex-1 overflow-y-auto p-6 space-y-4"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/650/HD-wallpaper-whatsapp-bg-whatsapp-patern.jpg")',
                backgroundSize: '400px',
                backgroundBlendMode: 'overlay',
                opacity: 0.95
              }}
            >
              {messages.map((msg, idx) => {
                const isMine = msg.direction === 'OUTBOUND';
                const showAvatar = idx === 0 || messages[idx-1].direction !== msg.direction;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMine && showAvatar && (
                        <div className="w-6 h-6 rounded-lg bg-white/50 backdrop-blur shadow-sm flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-gray-400" />
                        </div>
                    )}
                    {!isMine && !showAvatar && <div className="w-6" />}

                    <div
                      className={`group relative max-w-[70%] animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                        isMine
                          ? 'bg-[#dcf8c6] text-gray-800 rounded-2xl rounded-tr-none shadow-[0_2px_8px_rgb(0,0,0,0.05)] ml-12'
                          : 'bg-white text-gray-800 rounded-2xl rounded-tl-none shadow-[0_2px_8px_rgb(0,0,0,0.05)] mr-12'
                      } px-4 py-3`}
                    >
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                      </p>
                      
                      <div className="flex items-center justify-end gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-gray-400/80 uppercase">
                            {formatTime(msg.timestamp)}
                        </span>
                        
                        {!isMine && (
                          <button
                            onClick={() => handleConvertToOrder(msg.content || '')}
                            className="opacity-0 group-hover:opacity-100 ml-1 p-1 bg-green-500 text-white rounded-lg transition-all shadow-md hover:scale-110 active:scale-95"
                            title="Convertir en Pedido"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {isMine && (
                            <div className="flex -space-x-1">
                                <div className="w-3 h-3 text-green-600">✓</div>
                                <div className="w-3 h-3 text-green-600 -translate-x-1">✓</div>
                            </div>
                        )}
                      </div>

                      {/* Message Tail */}
                      <div className={`absolute top-0 w-3 h-3 ${
                        isMine 
                            ? 'right-[-10px] bg-[#dcf8c6] clip-path-right' 
                            : 'left-[-10px] bg-white clip-path-left'
                      }`} style={{
                          clipPath: isMine ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(100% 0, 100% 100%, 0 0)'
                      }} />
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Floating Bar */}
            <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-center">
              <div className="w-full max-w-4xl flex items-center gap-3 bg-gray-50 p-2 rounded-[2rem] shadow-inner ring-1 ring-gray-200/50">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Escribe un mensaje para continuar..."
                  className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-3 text-[15px] text-gray-800 placeholder:text-gray-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="w-12 h-12 flex items-center justify-center bg-green-600 text-white rounded-full transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 disabled:opacity-30 disabled:bg-gray-400 group active:scale-90"
                >
                  <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State - Modern illustration style */
          <div className="flex-1 flex items-center justify-center p-12 bg-white">
            <div className="max-w-md text-center">
              <div className="relative w-48 h-48 mx-auto mb-8">
                  <div className="absolute inset-0 bg-green-100 rounded-[3rem] rotate-6 opacity-30 animate-pulse" />
                  <div className="absolute inset-0 bg-green-50 rounded-[3rem] -rotate-3 border border-green-100" />
                  <div className="relative h-full flex items-center justify-center">
                    <MessageCircle className="w-24 h-24 text-green-500/30" />
                    <div className="absolute flex gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                  </div>
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Centro de Atención</h3>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Selecciona una conversación a la izquierda para interactuar con tus clientes en tiempo real.
              </p>
              <button
                onClick={() => navigate('/whatsapp/connect')}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all hover:shadow-2xl hover:scale-105 active:scale-95"
              >
                <Settings className="w-5 h-5" />
                Configurar Canal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-black text-xl text-gray-900">Perfil del Cliente</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Información de Contacto</p>
              </div>
              <button 
                onClick={() => setIsContactModalOpen(false)} 
                className="w-10 h-10 flex items-center justify-center bg-white text-gray-400 hover:text-gray-900 rounded-xl border border-gray-100 shadow-sm transition-all"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-400 ml-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 transition-all font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-400 ml-1">Dirección o Referencia</label>
                <input
                  type="text"
                  value={contactForm.address}
                  onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  placeholder="Ej. Av. Siempre Viva 123"
                  className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 transition-all font-semibold text-gray-600"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="flex-1 px-6 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 bg-green-600 text-white font-black rounded-2xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95"
                >
                  Guardar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
