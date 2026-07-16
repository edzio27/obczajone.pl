'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMapInstance, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  popupHtml: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type LeafletMapViewProps = {
  markers: MapMarker[];
  center: [number, number];
  zoom: number;
  heightClassName?: string;
};

export function LeafletMapView({
  markers,
  center,
  zoom,
  heightClassName = 'h-64',
}: LeafletMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Create the map once on mount.
  useEffect(() => {
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers whenever the list changes, without recreating the map.
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current) return;

    import('leaflet').then((L) => {
      const layer = markersLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      markers.forEach((marker) => {
        L.marker([marker.lat, marker.lng]).addTo(layer).bindPopup(marker.popupHtml);
      });
    });
  }, [markers, mapReady]);

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-lg overflow-hidden`} />;
}
