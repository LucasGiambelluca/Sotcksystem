# Guía de Implementación de Iconos - Sistema de Comandera

## Resumen de Imports por Archivo

---

### 1. `client/src/pages/Orders.tsx`

**Estado actual:** Usa emojis y mezcla de iconos inconsistentes.

**Import propuesto (reemplazar línea 5):**
```typescript
import { 
  Package, Phone, MessageCircle, Globe, Filter, Plus, 
  Clock, CheckCircle2, Flame, Bike, Truck, CheckCircle, XCircle,
  Printer, Eye, MoreHorizontal, AlertTriangle, ChevronRight,
  Search, RefreshCw, MapPin, User, DollarSign, ShoppingBag
} from 'lucide-react';
```

**Cambios específicos:**
- Reemplazar función `getChannelIcon` para usar iconos consistentes
- Agregar iconos de estado a cada tarjeta de pedido
- Agregar acciones rápidas con iconos al hover

---

### 2. `client/src/pages/KitchenDashboard.tsx`

**Estado actual:** Usa emojis en tabs y botones.

**Import propuesto (reemplazar línea 3):**
```typescript
import { 
  VolumeX, Utensils, LogOut, Package, Minus, Layers, 
  MapPin, Printer, Flame, ChefHat, ArrowRight, ArrowLeft,
  Timer, Clock, AlertCircle, CheckCircle2, Bike, Car, Truck,
  Navigation, User, GripVertical, Bell, Settings, Users,
  UtensilsCrossed, Thermometer, X, MoreVertical, Bike as BikeIcon,
  Car as CarIcon, Truck as TruckIcon
} from 'lucide-react';
```

**Reemplazos específicos:**

```typescript
// Línea 532 - TAB_CFG:
const TAB_CFG = {
  pending: { 
    label: 'Nuevos', 
    icon: Clock,  // ← Reemplaza emoji 🆕
    color: 'bg-orange-500', 
    count: pendingOrders.length 
  },
  cooking: { 
    label: 'En Cocina', 
    icon: Flame,  // ← Reemplaza emoji 🔥
    color: 'bg-red-500', 
    count: cookingOrders.length 
  },
  ready: { 
    label: 'Listos', 
    icon: PackageCheck,  // ← Reemplaza emoji ✅
    color: 'bg-green-500', 
    count: readyOrders.length 
  },
} as const;
```

---

### 3. `client/src/pages/Dispatcher.tsx`

**Estado actual:** Buen uso de iconos, pero faltan algunos.

**Import propuesto (reemplazar línea 5):**
```typescript
import { 
  Users, Package, MapPin, Navigation, CheckCircle2, 
  Bike, Car, Truck, X, MoreVertical, Route, LocateFixed,
  Zap, Activity, Radio, Wifi, WifiOff, Target, Crosshair,
  Clock, Star, Plus, Minus, Layers, Filter, ArrowRight
} from 'lucide-react';
```

---

### 4. `client/src/components/NewOrderAlertModal.tsx`

**Estado actual:** Mix de iconos Lucide y emojis en body.

**Import propuesto (reemplazar línea 5):**
```typescript
import { 
  Check, X, ShoppingBag, MapPin, Package, DollarSign,
  Clock, Phone, User, MessageCircle, AlertTriangle,
  ChevronRight, Printer, Eye, UtensilsCrossed
} from 'lucide-react';
```

**Reemplazos específicos:**
```tsx
// Reemplazar emojis en display de entrega (línea 238-246)
<div className={`p-3 rounded-xl border shadow-sm ${currentAlert.delivery_type?.toLowerCase().includes('env') ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter mb-1 flex items-center gap-1">
    <MapPin className="w-3 h-3" /> Entrega
  </p>
  <p className={`font-bold text-sm truncate ${currentAlert.delivery_type?.toLowerCase().includes('env') ? 'text-orange-700' : 'text-green-700'}`}>
    {displayAddress}
  </p>
</div>

// Reemplazar emoji en header (línea 222)
// De: Entró por {currentAlert.channel === 'WHATSAPP' ? 'WhatsApp' : currentAlert.channel}
// A: <MessageCircle className="w-4 h-4 inline" /> Entró por {currentAlert.channel === 'WHATSAPP' ? 'WhatsApp' : currentAlert.channel}
```

---

### 5. `client/src/components/Layout.tsx`

**Estado actual:** Ya usa Lucide, pero falta icono específico para Comandas.

**Import actual (correcto):**
```typescript
import { 
  LayoutDashboard, Users, Package, LogOut, Menu, X, 
  ShoppingCart, MapPin, MessageCircle, Settings, Share2, 
  FileText, ChefHat, ShoppingBag, FlaskConical, Navigation, 
  UtensilsCrossed, Truck, Download, Bell, Clock, Activity
} from 'lucide-react';
```

**Sugerencia:** Agregar badge de pedidos pendientes en icono de Comandas:
```typescript
{ name: 'Comandas', path: '/kitchen', icon: ChefHat, badge: pendingKitchenCount },
```

---

### 6. Nuevo Componente: `CommandStatusIcons.tsx`

Crear un componente centralizado para los iconos de estado:

```typescript
// client/src/components/CommandStatusIcons.tsx
import { 
  Clock, CheckCircle2, Flame, PackageCheck, 
  Bike, CheckCircle, XCircle, AlertTriangle,
  type LucideIcon 
} from 'lucide-react';

export const statusIcons: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  PENDING: { 
    icon: Clock, 
    color: 'text-yellow-600', 
    bg: 'bg-yellow-100' 
  },
  CONFIRMED: { 
    icon: CheckCircle2, 
    color: 'text-blue-600', 
    bg: 'bg-blue-100' 
  },
  IN_PREPARATION: { 
    icon: Flame, 
    color: 'text-purple-600', 
    bg: 'bg-purple-100' 
  },
  IN_TRANSIT: { 
    icon: Bike, 
    color: 'text-indigo-600', 
    bg: 'bg-indigo-100' 
  },
  DELIVERED: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bg: 'bg-green-100' 
  },
  CANCELLED: { 
    icon: XCircle, 
    color: 'text-red-600', 
    bg: 'bg-red-100' 
  },
};

export const channelIcons: Record<string, { icon: LucideIcon; color: string }> = {
  WHATSAPP: { icon: MessageCircle, color: '#25D366' },
  PHONE: { icon: Phone, color: '#3B82F6' },
  WEB: { icon: Globe, color: '#8B5CF6' },
  TABLET: { icon: Tablet, color: '#F59E0B' },
};
```

---

### 7. `client/src/pages/OrderDetails.tsx`

**Import adicional a agregar (línea 5):**
```typescript
import { 
  // ... iconos existentes ...
  Printer, FileText, History, RotateCcw, PackageCheck,
  AlertTriangle, Clock, Timer
} from 'lucide-react';
```

---

### 8. `client/src/pages/NewOrder.tsx`

**Import adicional a agregar (línea 9):**
```typescript
import { 
  // ... iconos existentes ...
  ShoppingCart, Package, Clock, AlertCircle,
  FileText, QrCode, CreditCard
} from 'lucide-react';
```

---

## Iconos Adicionales Recomendados (Futuras Features)

Para alcanzar paridad completa con Fudo:

```typescript
import {
  // Pagos
  CreditCard, Banknote, QrCode, Wallet, Receipt,
  
  // Análisis
  TrendingUp, BarChart3, PieChart, Activity,
  
  // Clientes
  Heart, Star, Crown, Gift, Ticket,
  
  // Logística avanzada
  Route, Map, LocateFixed, Target, Compass,
  
  // Configuración
  Sliders, ToggleLeft, ToggleRight, Palette,
  
  // Acciones rápidas
  Copy, Clipboard, ExternalLink, Maximize2, Minimize2,
  
  // Estados especiales
  PauseCircle, PlayCircle, FastForward, SkipForward,
  
  // Notificaciones
  BellRing, BellDot, Mail, MessageSquare,
} from 'lucide-react';
```

---

## Sistema de Iconos por Categoría

### Acciones Primarias (Botones principales)
```typescript
const PRIMARY_ACTIONS = {
  confirm: CheckCircle,
  save: Save,
  send: Send,
  create: PlusCircle,
  delete: Trash2,
  edit: Pencil,
  cancel: X,
  print: Printer,
};
```

### Navegación
```typescript
const NAVIGATION = {
  back: ArrowLeft,
  forward: ArrowRight,
  home: Home,
  menu: Menu,
  close: X,
  settings: Settings,
};
```

### Estados del Sistema
```typescript
const SYSTEM_STATES = {
  loading: Loader2,      // Con animación spin
  error: AlertTriangle,
  warning: AlertCircle,
  success: CheckCircle2,
  info: Info,
  empty: PackageOpen,
};
```

---

## Colores Asociados por Icono

```typescript
export const ICON_COLORS = {
  // Estados de pedido
  PENDING: { icon: Clock, text: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  CONFIRMED: { icon: CheckCircle2, text: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' },
  IN_PREPARATION: { icon: Flame, text: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-200' },
  IN_TRANSIT: { icon: Bike, text: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-200' },
  DELIVERED: { icon: CheckCircle, text: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' },
  CANCELLED: { icon: XCircle, text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' },
  
  // Canales
  WHATSAPP: { text: 'text-green-600', bg: 'bg-green-50' },
  PHONE: { text: 'text-blue-600', bg: 'bg-blue-50' },
  WEB: { text: 'text-purple-600', bg: 'bg-purple-50' },
  TABLET: { text: 'text-amber-600', bg: 'bg-amber-50' },
  
  // Prioridades
  HIGH: { icon: AlertTriangle, text: 'text-red-600', bg: 'bg-red-50' },
  NORMAL: { icon: Clock, text: 'text-gray-600', bg: 'bg-gray-50' },
  VIP: { icon: Star, text: 'text-amber-600', bg: 'bg-amber-50' },
};
```

---

## Checklist de Implementación

- [ ] Reemplazar todos los emojis en `KitchenDashboard.tsx`
- [ ] Reemplazar emojis en `NewOrderAlertModal.tsx`
- [ ] Crear componente centralizado `CommandStatusIcons.tsx`
- [ ] Actualizar imports en `Orders.tsx`
- [ ] Actualizar imports en `OrderDetails.tsx`
- [ ] Agregar iconos de acciones rápidas en tarjetas de pedido
- [ ] Implementar sistema de badges en iconos de navegación
- [ ] Crear variantes de iconos para estados hover/active
- [ ] Documentar nuevos iconos en Storybook (si aplica)

---

*Guía generada para implementación de sistema de iconos Lucide*
