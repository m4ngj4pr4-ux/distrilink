"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// Fix for Leaflet icon issues in Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Sub-component to handle map fly-to animations
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// NEW: Click handler to pick coordinates
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng);
    },
  });
  return null;
}

export default function RetailMap({ stores, center, onMarkerClick, onMapClick, tempMarker }) {
  const defaultCenter = [-7.9666, 112.6326]; // Malang default

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-400/10">
      <MapContainer
        center={center || defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark" 
        />
        
        <ChangeView center={center} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* Temp Marker for adding new store */}
        {tempMarker && (
          <Marker position={[tempMarker.lat, tempMarker.lng]}>
            <Popup>📍 Lokasi Toko Baru</Popup>
          </Marker>
        )}

        {stores.map((store) => {
          const lat = parseFloat(store.latitude);
          const lng = parseFloat(store.longitude);
          
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker 
              key={store.id} 
              position={[lat, lng]}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(store),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-1">
                  <h3 className="font-bold text-dark-800">{store.namaToko}</h3>
                  <p className="text-xs text-slate-500 mb-2">{store.pemilik}</p>
                  <a 
                    href={`https://wa.me/${store.nomorHp}`} 
                    target="_blank" 
                    className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded block text-center"
                  >
                    WhatsApp
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
