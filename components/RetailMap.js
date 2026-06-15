"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useMemo, useCallback } from "react";

// Sub-component to handle map fly-to animations
function ChangeView({ center, selectedStoreId }) {
  const map = useMap();
  // Use a ref to track previous values and force flyTo even on same coords
  const prevRef = useRef({ center: null, selectedStoreId: null });

  useEffect(() => {
    if (center) {
      const prev = prevRef.current;
      // Fly if center changed OR if selectedStoreId changed (re-click same store)
      const centerChanged = !prev.center || prev.center[0] !== center[0] || prev.center[1] !== center[1];
      const storeChanged = prev.selectedStoreId !== selectedStoreId;

      if (centerChanged || storeChanged) {
        map.flyTo(center, 17, { duration: 1.2 });
        prevRef.current = { center, selectedStoreId };
      }
    }
  }, [center, selectedStoreId, map]);
  return null;
}

// Click handler to pick coordinates
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng);
    },
  });
  return null;
}

// Component to automatically fit markers on screen on first load
function FitBounds({ stores }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current) return; // Only fit once on initial load
    if (stores && stores.length > 0) {
      const latLngs = stores
        .map(s => [parseFloat(s.latitude), parseFloat(s.longitude)])
        .filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]) && (coord[0] !== 0 || coord[1] !== 0));
      
      if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
        hasFitted.current = true;
      }
    }
  }, [stores, map]);
  return null;
}

// Force Leaflet to recalculate container size on fullscreen toggle
function InvalidateSize({ isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);
  return null;
}

// Helper to create custom HTML markers based on store type
const getStoreMarkerIcon = (jenisToko) => {
  let colorClass = "";
  let iconColor = "";

  switch (jenisToko) {
    case "WS":
      colorClass = "bg-purple-600 border-purple-800";
      iconColor = "text-purple-600";
      break;
    case "KS":
      colorClass = "bg-teal-600 border-teal-800";
      iconColor = "text-teal-600";
      break;
    case "TK":
      colorClass = "bg-emerald-600 border-emerald-800";
      iconColor = "text-emerald-600";
      break;
    default:
      colorClass = "bg-slate-600 border-slate-800";
      iconColor = "text-slate-600";
      break;
  }

  return L.divIcon({
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 36px; height: 42px;">
        <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center border-2 border-white ${colorClass}">
          <div class="w-5.5 h-5.5 rounded-full bg-white flex items-center justify-center shadow-inner ${iconColor}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M4 4h16v2H4zm16 3H4L2 11v1c0 1.66 1.34 3 3 3s3-1.34 3-3V11h2v1c0 1.66 1.34 3 3 3s3-1.34 3-3V11h2v1c0 1.66 1.34 3 3 3s3-1.34 3-3v-1L20 7zm-2 10H6v3h12v-3z"/>
            </svg>
          </div>
        </div>
        <div class="w-2.5 h-2.5 rotate-45 -mt-1.5 border-r-2 border-b-2 border-white ${colorClass}"></div>
      </div>
    `,
    className: "custom-store-pin",
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
};

const tempStoreIcon = L.divIcon({
  html: `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 36px; height: 42px;">
      <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center border-2 border-white bg-rose-600">
        <div class="w-5.5 h-5.5 rounded-full bg-white flex items-center justify-center shadow-inner text-rose-600">
          📍
        </div>
      </div>
      <div class="w-2.5 h-2.5 rotate-45 -mt-1.5 border-r-2 border-b-2 border-white bg-rose-600"></div>
    </div>
  `,
  className: "custom-store-pin",
  iconSize: [36, 42],
  iconAnchor: [18, 42],
  popupAnchor: [0, -38],
});

// Marker that auto-opens popup when selected
function StoreMarker({ store, isSelected, onMarkerClick }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (isSelected && markerRef.current) {
      // Small delay to let flyTo start, then open popup
      const timer = setTimeout(() => {
        markerRef.current.openPopup();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isSelected]);

  const lat = parseFloat(store.latitude);
  const lng = parseFloat(store.longitude);

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

  return (
    <Marker 
      key={store.id} 
      ref={markerRef}
      position={[lat, lng]}
      icon={getStoreMarkerIcon(store.jenisToko)}
      eventHandlers={{
        click: () => onMarkerClick && onMarkerClick(store),
      }}
    >
      <Popup className="custom-popup">
        <div className="flex flex-col gap-2 min-w-[180px] p-0.5">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <h3 className="font-bold text-slate-800 text-sm m-0 leading-none">{store.namaToko}</h3>
              {store.jenisToko && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border leading-none shrink-0 ${
                  store.jenisToko === 'WS' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                  store.jenisToko === 'KS' ? 'bg-teal-100 text-teal-700 border-teal-200' :
                  store.jenisToko === 'TK' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {store.jenisToko}
                </span>
              )}
            </div>
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
}

export default function RetailMap({ stores, center, onMarkerClick, onMapClick, tempMarker, selectedStoreId, isFullscreen }) {
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
        
        <ChangeView center={center} selectedStoreId={selectedStoreId} />
        <MapClickHandler onMapClick={onMapClick} />
        <FitBounds stores={stores} />
        <InvalidateSize isFullscreen={isFullscreen} />

        {/* Temp Marker for adding new store */}
        {tempMarker && (
          <Marker position={[tempMarker.lat, tempMarker.lng]} icon={tempStoreIcon}>
            <Popup>📍 Lokasi Toko Baru</Popup>
          </Marker>
        )}

        {stores.map((store) => (
          <StoreMarker
            key={store.id}
            store={store}
            isSelected={selectedStoreId === store.id}
            onMarkerClick={onMarkerClick}
          />
        ))}
      </MapContainer>
    </div>
  );
}
