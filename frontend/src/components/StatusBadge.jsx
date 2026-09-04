import React from 'react';

const STYLES = {
  placed: 'bg-ledger text-ink',
  accepted: 'bg-marigold-light text-marigold-dark',
  packed: 'bg-marigold text-ink',
  assigned: 'bg-leaf-light text-leaf-dark',
  picked_up: 'bg-leaf text-white',
  delivered: 'bg-leaf-dark text-white',
  cancelled: 'bg-brick/10 text-brick',
};

const LABELS = {
  placed: 'Order placed',
  accepted: 'Accepted by shop',
  packed: 'Packed — awaiting pickup',
  assigned: 'Delivery partner assigned',
  picked_up: 'Picked up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${STYLES[status] || 'bg-ledger text-ink'}`}>{LABELS[status] || status}</span>;
}
