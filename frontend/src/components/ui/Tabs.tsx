import type { ReactNode } from 'react';

interface TabItem {
  id: string;
  label: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div
      className={`flex gap-1 bg-brand-surface p-1 rounded-lg border border-brand-border ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              const idx = tabs.findIndex((t) => t.id === tab.id);
              if (e.key === 'ArrowRight') onChange(tabs[(idx + 1) % tabs.length].id);
              if (e.key === 'ArrowLeft') onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id);
            }}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-brand-accent/50
              ${
                isActive
                  ? 'bg-brand-accent text-white shadow-sm'
                  : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-card'
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
