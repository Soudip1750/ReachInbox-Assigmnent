interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-brand-surface flex items-center justify-center mb-4 text-brand-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-brand-text mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-brand-text-muted max-w-xs mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
