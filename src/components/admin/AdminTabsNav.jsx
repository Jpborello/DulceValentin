'use client';

import { BarChart3, Package, DollarSign, Image as ImageIcon, Layers, Users, Sparkles, FolderPlus, FileSpreadsheet, CreditCard, MessageSquare } from 'lucide-react';

export default function AdminTabsNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'metrics', label: 'Métricas & Arqueo de Caja', icon: BarChart3 },
    { id: 'whatsapp', label: '💬 WhatsApp CRM & IA', icon: MessageSquare },
    { id: 'settings', label: '💳 Alias de Transferencia', icon: CreditCard },
    { id: 'stock', label: 'Control de Stock', icon: Package },
    { id: 'prices', label: 'Cambio de Precios', icon: DollarSign },
    { id: 'bulk', label: 'Carga Masiva (CSV)', icon: FileSpreadsheet },
    { id: 'categories', label: 'Categorías & Subcategorías', icon: FolderPlus },
    { id: 'images', label: 'Gestión de Imágenes', icon: ImageIcon },
    { id: 'orders', label: 'Órdenes & Comprobantes', icon: Layers },
    { id: 'clients', label: 'Ranking de Clientes', icon: Users },
    { id: 'raffle', label: '🎰 Sorteo en Vivo', icon: Sparkles }
  ];

  return (
    <div className="admin-tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            <Icon size={16} style={{ display: 'inline', marginRight: '6px' }} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
