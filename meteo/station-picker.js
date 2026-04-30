// meteo/station-picker.js — v0.59.898
// Универсальный picker метеостанции с двумя режимами:
//   1. Список с поиском по имени/коду/стране
//   2. Карта (Leaflet, OpenStreetMap tiles, lazy-loaded из CDN)
// Возвращает { id, name, country, lat, lon } или null.

import { STATIONS, findStation, countryLabel, nearestStations } from './stations/wmo-list.js';
import { escHtml, escAttr } from './util.js';

let _leafletLoaded = false;
let _leafletLoading = null;

function loadLeaflet() {
  if (_leafletLoaded) return Promise.resolve(window.L);
  if (_leafletLoading) return _leafletLoading;
  _leafletLoading = new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.leaflet = '1';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.onload = () => { _leafletLoaded = true; resolve(window.L); };
    script.onerror = () => reject(new Error('Не удалось загрузить Leaflet (нет интернета или CDN недоступен)'));
    document.head.appendChild(script);
  });
  return _leafletLoading;
}

export function pickStation(opts = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'mt-modal-overlay';
    overlay.innerHTML = `<div class="mt-modal mt-station-picker" role="dialog" aria-modal="true">
      <div class="mt-modal-head">
        <h3>${escHtml(opts.title || '🌐 Выбор метеостанции')}</h3>
        <div class="mt-sp-modes">
          <button type="button" class="mt-sp-mode active" data-mode="list">📋 Список</button>
          <button type="button" class="mt-sp-mode" data-mode="map">🗺 Карта</button>
        </div>
      </div>
      <div class="mt-modal-body mt-sp-body">
        <div class="mt-sp-search-row">
          <input type="text" class="mt-sp-search" placeholder="🔍 Поиск по городу / коду / стране..." autofocus>
          <span class="muted mt-sp-count">${STATIONS.length}</span>
        </div>
        <div class="mt-sp-list" id="mt-sp-list"></div>
        <div class="mt-sp-map" id="mt-sp-map" hidden></div>
      </div>
      <div class="mt-modal-actions">
        <span class="muted mt-sp-hint">Не нашли свой город? Введите координаты вручную (кнопка ниже).</span>
        <span style="flex:1"></span>
        <button type="button" class="mt-modal-btn mt-sp-manual">✏ Ввести вручную</button>
        <button type="button" class="mt-modal-btn mt-modal-cancel">Отмена</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.mt-modal-cancel').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    overlay.querySelector('.mt-sp-manual').addEventListener('click', () => close({ manual: true }));

    // Список (режим по умолчанию)
    const renderList = (q) => {
      const matches = findStation(q);
      const list = overlay.querySelector('#mt-sp-list');
      list.innerHTML = matches.length === 0
        ? '<div class="mt-empty-list">Ничего не найдено. Попробуйте «Москва», «Almaty», «UAAA», «KZ».</div>'
        : matches.map(s => `<button type="button" class="mt-sp-row" data-id="${escAttr(s.id || '')}" data-name="${escAttr(s.name)}" data-lat="${s.lat}" data-lon="${s.lon}">
            <span class="mt-sp-name">${escHtml(s.name)}</span>
            <span class="mt-sp-country">${escHtml(countryLabel(s.country))}</span>
            <span class="mt-sp-coords">${s.lat.toFixed(2)}, ${s.lon.toFixed(2)}</span>
            <span class="mt-sp-id muted">${escHtml(s.id || '')}</span>
          </button>`).join('');
      overlay.querySelector('.mt-sp-count').textContent = `${matches.length} из ${STATIONS.length}`;
      list.querySelectorAll('.mt-sp-row').forEach(row => {
        row.addEventListener('click', () => {
          close({
            id: row.dataset.id || null,
            name: row.dataset.name,
            lat: Number(row.dataset.lat),
            lon: Number(row.dataset.lon),
            country: matches.find(m => (m.id || '') === row.dataset.id)?.country || '',
          });
        });
      });
    };
    renderList('');
    const search = overlay.querySelector('.mt-sp-search');
    search.addEventListener('input', () => renderList(search.value));

    // Режимы
    let mapInstance = null;
    overlay.querySelectorAll('.mt-sp-mode').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        overlay.querySelectorAll('.mt-sp-mode').forEach(b => b.classList.toggle('active', b === btn));
        overlay.querySelector('#mt-sp-list').hidden = (mode !== 'list');
        overlay.querySelector('#mt-sp-map').hidden = (mode !== 'map');
        overlay.querySelector('.mt-sp-search-row').hidden = (mode !== 'list');
        if (mode === 'map' && !mapInstance) {
          const mapEl = overlay.querySelector('#mt-sp-map');
          mapEl.innerHTML = '<div class="mt-sp-map-loading">Загрузка карты…</div>';
          try {
            const L = await loadLeaflet();
            mapEl.innerHTML = '';
            mapInstance = L.map(mapEl, { center: [45, 50], zoom: 3 });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap',
              maxZoom: 13,
            }).addTo(mapInstance);
            // Маркеры на каждую станцию
            STATIONS.forEach(s => {
              const marker = L.circleMarker([s.lat, s.lon], {
                radius: 5, color: '#1e40af', fillColor: '#3b82f6', fillOpacity: 0.7, weight: 1,
              }).addTo(mapInstance);
              marker.bindTooltip(`<b>${escHtml(s.name)}</b><br>${escHtml(countryLabel(s.country))}<br>${s.lat.toFixed(2)}, ${s.lon.toFixed(2)} ${s.id ? `· ${escHtml(s.id)}` : ''}`);
              marker.on('click', () => {
                close({
                  id: s.id || null,
                  name: s.name,
                  lat: s.lat, lon: s.lon, country: s.country,
                });
              });
            });
            // Клик по карте → показать ближайшие станции (как ashrae-meteo.info)
            let clickPin = null;
            mapInstance.on('click', (e) => {
              if (clickPin) clickPin.remove();
              clickPin = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapInstance);
              const nearest = nearestStations(e.latlng.lat, e.latlng.lng, 10);
              const nearestRows = nearest.map((s, i) => {
                const letter = String.fromCharCode(65 + i);
                return `<div class="mt-sp-near-row" data-near-i="${i}">
                  <span class="mt-sp-near-letter">${letter}</span>
                  <span class="mt-sp-near-name"><b>${escHtml(s.name)}</b><br>${escHtml(countryLabel(s.country))} · <span class="muted">${s.distanceKm.toFixed(0)} км</span>${s.wmo ? ' · WMO ' + s.wmo : ''}${s.id ? ' · ' + s.id : ''}</span>
                </div>`;
              }).join('');
              clickPin.bindPopup(
                `<div class="mt-sp-near-popup">
                  <b>📍 Ближайшие станции</b>
                  <span class="muted" style="font-size:10.5px">от точки ${e.latlng.lat.toFixed(2)}, ${e.latlng.lng.toFixed(2)}</span>
                  <div class="mt-sp-near-list">${nearestRows}</div>
                  <button type="button" class="mt-sp-pick-here-btn">✓ Использовать произвольную точку</button>
                </div>`,
                { closeButton: true, maxWidth: 360, minWidth: 320 }
              ).openPopup();
              setTimeout(() => {
                document.querySelectorAll('.mt-sp-near-row').forEach(row => {
                  row.addEventListener('click', () => {
                    const i = Number(row.dataset.nearI);
                    const s = nearest[i];
                    if (s) close({ id: s.id || null, name: s.name, lat: s.lat, lon: s.lon, country: s.country });
                  });
                });
                const btnHere = document.querySelector('.mt-sp-pick-here-btn');
                if (btnHere) btnHere.addEventListener('click', () => {
                  close({
                    id: null,
                    name: `Точка ${e.latlng.lat.toFixed(2)}, ${e.latlng.lng.toFixed(2)}`,
                    lat: e.latlng.lat, lon: e.latlng.lng, country: '',
                  });
                });
              }, 100);
            });
            // Force resize after appending
            setTimeout(() => mapInstance.invalidateSize(), 100);
          } catch (e) {
            mapEl.innerHTML = `<div class="mt-empty-list" style="padding:20px">⚠ ${escHtml(e.message)}<br><br>Используйте поиск в списке.</div>`;
          }
        } else if (mode === 'map' && mapInstance) {
          setTimeout(() => mapInstance.invalidateSize(), 100);
        }
      });
    });
  });
}
