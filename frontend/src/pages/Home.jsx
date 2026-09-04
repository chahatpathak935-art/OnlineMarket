import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <section className="border-b border-ledger bg-ink text-paper">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h1 className="font-display text-5xl leading-tight max-w-xl">
            Every shop in the market, one doorstep at a time.
          </h1>
          <p className="mt-4 text-paper/70 max-w-md">
            Pick a shop from across the district, fill your basket, and a delivery partner
            brings it straight to you.
          </p>
          <div className="mt-8 flex gap-3">
            {user ? (
              <Link to="/shops" className="btn-accent">Browse shops</Link>
            ) : (
              <>
                <Link to="/register" className="btn-accent">Get started</Link>
                <Link to="/shops" className="btn-outline !border-paper !text-paper hover:!bg-paper hover:!text-ink">
                  Browse shops
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-14 grid sm:grid-cols-3 gap-6">
        <div>
          <h3 className="font-display text-xl mb-1">Find your shop</h3>
          <p className="text-sm text-ink/60">Search the whole district's market by name, or browse the full list.</p>
        </div>
        <div>
          <h3 className="font-display text-xl mb-1">Order in one place</h3>
          <p className="text-sm text-ink/60">Shop from a single store per order — packed exactly as you asked.</p>
        </div>
        <div>
          <h3 className="font-display text-xl mb-1">Tracked delivery</h3>
          <p className="text-sm text-ink/60">A delivery partner picks up from the shop and brings it to your door.</p>
        </div>
      </section>
    </div>
  );
}
