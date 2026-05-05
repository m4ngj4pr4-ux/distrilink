"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

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

// NEW: Component to automatically fit markers on screen
function FitBounds({ stores }) {
  const map = useMap();
  useEffect(() => {
    if (stores && stores.length > 0) {
      const latLngs = stores
        .map(s => [parseFloat(s.latitude), parseFloat(s.longitude)])
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
      
      if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [stores, map]);
  return null;
}

export default function RetailMap({ stores, center, onMarkerClick, onMapClick, tempMarker }) {
  useEffect(() => {
    // Fix for Leaflet icon issues in Next.js (Only on Client)
    const DefaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

  const fallbackCenter = [-3.3166, 114.5901]; // Banjarmasin fallback

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-400/10">
      <MapContainer
        center={center || fallbackCenter}
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
        <FitBounds stores={stores} />

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
                <div className="flex flex-col gap-2 min-w-[180px] p-0.5">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-0.5">{store.namaToko}</h3>
                    <p className="text-[11px] text-slate-600 mb-1 leading-tight">{store.alamat}</p>
                    <div className="space-y-0.5">
                      {store.pemilik && <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">👤 {store.pemilik}</p>}
                      {store.nomorHp && (
                        <a href={`https://wa.me/${store.nomorHp}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 font-semibold">
                          📞 {store.nomorHp} (WA)
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-200 pt-2 mt-1">
                    <a 
                      href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors no-underline shadow-sm"
                    >
                      🗺️ Buka Google Maps
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
