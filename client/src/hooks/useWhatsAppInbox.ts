import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getConversations,
  getMessages,
  sendWhatsAppMessage,
  markConversationAsRead,
  subscribeToMessages,
  syncMessages,
  disableWebhook,
  resolveHandover,
} from '../services/whatsappService';
import { parseOrderFromText } from '../services/orderService';
import { supabase } from '../supabaseClient';
import type { WhatsAppConversation, WhatsAppMessage, Product, Client } from '../types';
import { toast } from 'sonner';

export type SidebarTab = 'chats' | 'contacts' | 'attention';

export function useWhatsAppInbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', address: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Contacts tab state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats');
  const [contacts, setContacts] = useState<Client[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const activeConvo = conversations.find((c) => c.id === activeConvoId);

  useEffect(() => {
    loadConversations();
    loadProducts();

    const unsubscribe = subscribeToMessages(
      (msg) => {
        setMessages((prev) => {
          if (msg.conversation_id === activeConvoId) {
            return [...prev, msg];
          }
          return prev;
        });
        loadConversations();
      },
      () => {
        loadConversations();
      }
    );

    disableWebhook();
    syncMessages();
    const interval = setInterval(() => {
      syncMessages();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [activeConvoId]);

  // Auto-select first conversation on load
  useEffect(() => {
    if (conversations.length > 0 && !activeConvoId) {
      selectConversation(conversations[0]);
    }
  }, [conversations, activeConvoId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load contacts when switching to contacts tab
  useEffect(() => {
    if (sidebarTab === 'contacts' && contacts.length === 0) {
      loadContacts();
    }
  }, [sidebarTab]);

  async function loadConversations() {
    const { data } = await getConversations();
    if (data) setConversations(data);
  }

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  }

  async function loadContacts() {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      toast.error('Error al cargar contactos: ' + err.message);
    } finally {
      setLoadingContacts(false);
    }
  }

  async function selectConversation(convo: WhatsAppConversation) {
    setActiveConvoId(convo.id);
    setShowMobileChat(true);

    const { data } = await getMessages(convo.id);
    if (data) setMessages(data);

    if (convo.unread_count > 0) {
      await markConversationAsRead(convo.id);
      loadConversations();
    }
  }

  async function handleContactClick(contact: Client) {
    // Try to find existing conversation by phone
    const existing = conversations.find(
      (c) => c.phone === contact.phone || c.client_id === contact.id
    );

    if (existing) {
      setSidebarTab('chats');
      selectConversation(existing);
    } else if (contact.phone) {
      // Start new conversation
      try {
        const { data: convo, error } = await supabase
          .from('whatsapp_conversations')
          .insert({
            phone: contact.phone,
            client_id: contact.id,
            contact_name: contact.name,
            unread_count: 0,
          })
          .select('*, client:clients(*)')
          .single();
        if (error) throw error;
        setSidebarTab('chats');
        loadConversations();
        if (convo) selectConversation(convo as WhatsAppConversation);
      } catch (err: any) {
        toast.error('Error al iniciar conversación: ' + err.message);
      }
    } else {
      toast.error('Este contacto no tiene número de teléfono');
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeConvo) return;

    setSending(true);
    try {
      await sendWhatsAppMessage(activeConvo.phone, newMessage);
      setNewMessage('');
      const { data } = await getMessages(activeConvo.id);
      if (data) setMessages(data);
    } catch (err: any) {
      toast.error(`Error al enviar: ${err.message}`);
    }
    setSending(false);
  }

  function handleConvertToOrder(messageContent: string) {
    const parsed = parseOrderFromText(messageContent, products);
    if (parsed.length > 0) {
      sessionStorage.setItem('whatsapp_order_items', JSON.stringify(parsed));
      sessionStorage.setItem('whatsapp_order_text', messageContent);
      sessionStorage.setItem('whatsapp_order_phone', activeConvo?.phone || '');
      navigate('/orders/new');
      toast.success(`${parsed.length} productos detectados`);
    } else {
      toast.error('No se detectaron productos en este mensaje');
    }
  }

  async function handleResolveHandover() {
    if (!activeConvo) return;
    try {
      await resolveHandover(activeConvo.id, activeConvo.phone);
      toast.success('El bot ha retomado el control de esta conversación');
      loadConversations();
      // Optionally switch back to chats if no more attention needed
      const remainingHandovers = conversations.filter(c => c.status === 'HANDOVER' && c.id !== activeConvo.id);
      if (remainingHandovers.length === 0) {
        setSidebarTab('chats');
      }
    } catch (err: any) {
      toast.error('Error al resolver: ' + err.message);
    }
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConvo || !contactForm.name.trim()) return;

    try {
      let { data: client } = await supabase
        .from('clients')
        .select('id')
        .or(`phone.ilike.%${activeConvo.phone.slice(-8)}%`)
        .limit(1)
        .single();

      if (client) {
        await supabase
          .from('clients')
          .update({
            name: contactForm.name,
            address: contactForm.address,
          })
          .eq('id', client.id);
      } else {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            name: contactForm.name,
            address: contactForm.address,
            phone: activeConvo.phone,
          })
          .select()
          .single();
        client = newClient;
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? { ...c, contact_name: contactForm.name, client: { ...c.client, name: contactForm.name } as any }
            : c
        )
      );

      // Refresh contacts if loaded
      if (contacts.length > 0) loadContacts();

      toast.success('Contacto guardado');
      setIsContactModalOpen(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Error al guardar contacto');
    }
  }

  function openContactModal() {
    if (!activeConvo) return;
    setContactForm({
      name: activeConvo.client?.name || activeConvo.contact_name || '',
      address: activeConvo.client?.address || '',
    });
    setIsContactModalOpen(true);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDate(timestamp: string | null) {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return new Date(timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  }

  const filteredConversations = conversations.filter((c) => {
    if (sidebarTab === 'attention' && c.status !== 'HANDOVER') return false;
    if (sidebarTab === 'chats' && c.status === 'HANDOVER') return false;
    
    const term = searchTerm.toLowerCase();
    return (
      (c.contact_name || '').toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.client?.name || '').toLowerCase().includes(term)
    );
  });

  const attentionCount = conversations.filter(c => c.status === 'HANDOVER').length;

  const filteredContacts = contacts.filter((c) => {
    const term = contactSearch.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term) ||
      (c.address || '').toLowerCase().includes(term)
    );
  });

  return {
    navigate,
    conversations,
    activeConvoId,
    messages,
    newMessage,
    setNewMessage,
    sending,
    searchTerm,
    setSearchTerm,
    showMobileChat,
    setShowMobileChat,
    isContactModalOpen,
    setIsContactModalOpen,
    contactForm,
    setContactForm,
    messagesEndRef,
    sidebarTab,
    setSidebarTab,
    contacts,
    loadingContacts,
    contactSearch,
    setContactSearch,
    activeConvo,
    filteredConversations,
    attentionCount,
    filteredContacts,
    selectConversation,
    handleContactClick,
    handleSend,
    handleConvertToOrder,
    handleResolveHandover,
    handleSaveContact,
    openContactModal,
    scrollToBottom,
    formatTime,
    formatDate,
  };
}
