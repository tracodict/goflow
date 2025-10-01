"use client";
import React, { useState } from 'react';
import { useBuilderStore } from '@/stores/pagebuilder/editor';

interface MenuItemNode {
  id: string;
  label: string;
  href?: string;
  children?: MenuItemNode[];
}

export const MenuDefinitionPanelStub: React.FC<{
  initialItems?: MenuItemNode[];
  onSave?: (items: MenuItemNode[]) => void;
  onClose?: () => void;
}> = ({ initialItems = [], onSave, onClose }) => {
  const [items, setItems] = useState<MenuItemNode[]>(initialItems.length ? initialItems : [
    { id: 'home', label: 'Home', href: '/' },
    { id: 'products', label: 'Products', children: [ { id: 'software', label: 'Software', href: '/products/software' } ] }
  ]);

  const addRoot = () => {
    const id = `item-${Date.now().toString(36)}`;
    setItems([...items, { id, label: 'New Item' }]);
  };

  const updateLabel = (id: string, label: string) => {
    const patch = (nodes: MenuItemNode[]): MenuItemNode[] => nodes.map(n => n.id === id ? { ...n, label } : { ...n, children: n.children ? patch(n.children) : undefined });
    setItems(patch(items));
  };

  const addChild = (parentId: string) => {
    const id = `item-${Date.now().toString(36)}`;
    const patch = (nodes: MenuItemNode[]): MenuItemNode[] => nodes.map(n => {
      if (n.id === parentId) {
        return { ...n, children: [...(n.children || []), { id, label: 'Child' }] };
      }
      return { ...n, children: n.children ? patch(n.children) : undefined };
    });
    setItems(patch(items));
  };

  const removeItem = (id: string) => {
    const filt = (nodes: MenuItemNode[]): MenuItemNode[] => nodes.filter(n => n.id !== id).map(n => ({ ...n, children: n.children ? filt(n.children) : undefined }));
    setItems(filt(items));
  };

  const flatten = (nodes: MenuItemNode[], depth=0): React.ReactNode[] => {
    return nodes.flatMap(n => [
      <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: depth * 12 }}>
        <input
          style={{ flex: 1, fontSize: 12, padding: '2px 4px' }}
          value={n.label}
          onChange={e => updateLabel(n.id, e.target.value)}
        />
        <button onClick={() => addChild(n.id)} title="Add child" style={{ fontSize: 11 }}>+</button>
        <button onClick={() => removeItem(n.id)} title="Remove" style={{ fontSize: 11 }}>×</button>
      </div>,
      ...(n.children ? flatten(n.children, depth + 1) : [])
    ]);
  };

  const selectedId = useBuilderStore(state => state.selectedElementId);
  const updateElement = useBuilderStore(state => state.updateElement);
  const elements = useBuilderStore(state => state.elements);

  const saveAndPersist = () => {
    if (selectedId && elements[selectedId]) {
      try {
        const currentCfgStr = elements[selectedId].attributes?.['data-config'] || '{}';
        const currentCfg = JSON.parse(currentCfgStr);
        const newCfg = { ...currentCfg, items };
        updateElement(selectedId, { attributes: { ...elements[selectedId].attributes, 'data-config': JSON.stringify(newCfg) } });
      } catch (e) {
        console.warn('Failed to persist menu definition', e);
      }
    }
    onSave?.(items);
    onClose?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Menu Definition (Stub)</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={addRoot} style={{ fontSize: 12 }}>Add Root</button>
          <button onClick={saveAndPersist} style={{ fontSize: 12 }}>Save</button>
        </div>
      </div>
      <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #333', borderRadius: 4, padding: 4 }}>
        {flatten(items)}
      </div>
      <p style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
        This is a temporary stub. The full visual tree editor (drag & drop, script binding UI, live preview) will replace this in a later phase. Editing here updates an in-dialog local model only until you press Save.
      </p>
    </div>
  );
};

export default MenuDefinitionPanelStub;