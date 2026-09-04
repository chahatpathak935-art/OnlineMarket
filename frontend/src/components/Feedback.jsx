import React from 'react';

export function EmptyState({ title, hint }) {
  return (
    <div className="card text-center py-12 text-ink/60">
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="border border-brick/40 bg-brick/5 text-brick text-sm rounded px-4 py-2.5 mb-4">
      {message}
    </div>
  );
}
