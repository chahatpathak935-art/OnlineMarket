import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Leaflet's default marker icons don't load correctly with bundlers like Vite —
// this manually points them at reliable CDN URLs so pins actually render.
const shopIcon = new L.Icon({
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const customerIcon = new L.Icon({
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [31, 50],
  iconAnchor: [15, 50],
});

export default function OrderMap({ shopLat, shopLng, customerLat, customerLng, height = 260 }) {
  const points = [];
  if (shopLat && shopLng) points.push([shopLat, shopLng]);
  if (customerLat && customerLng) points.push([customerLat, customerLng]);

  if (points.length === 0) {
    return (
      <div className="card text-sm text-ink/50 text-center" style={{ height }}>
        <div className="flex items-center justify-center h-full">Location not available for this order.</div>
      </div>
    );
  }

  const center = points[0];

  return (
    <div className="rounded-lg overflow-hidden border border-ledger" style={{ height }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} bounds={points.length > 1 ? points : undefined} boundsOptions={{ padding: [30, 30] }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {shopLat && shopLng && (
          <Marker position={[shopLat, shopLng]} icon={shopIcon}>
            <Popup>Shop</Popup>
          </Marker>
        )}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon}>
            <Popup>Delivery address</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}