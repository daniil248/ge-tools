// =============================================================================
// sketch/shape-library.js — каталог фигур для модуля «Скетч / Whiteboard».
// =============================================================================
// Drawio-like подход: каждая фигура — это SVG-фрагмент в bounding box [0,0,100,100].
// При рендере в холсте — масштабируется до текущих w/h фигуры.
//
// ВАЖНО: shape-функция возвращает строку <path|<rect|<ellipse|<polygon...
// БЕЗ обёртки <g>. Внешний код добавляет <g class="sk-shape" transform="..."
// с position. Цвета берутся из CSS-классов (.sk-shape rect{fill:...}).
//
// Каждая категория содержит фигуры с {id, label, render(w, h), defaults}.
// =============================================================================

/** Универсальный helper: <rect|<ellipse|... с относительным расчётом. */
const r = (w, h, attrs = {}) => {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<rect width="${w}" height="${h}" ${a}/>`;
};

export const SHAPE_LIBRARY = {
  basic: {
    label: '📐 Базовые',
    shapes: [
      { id: 'rect', label: 'Прямоугольник', render: (w, h) => `<rect width="${w}" height="${h}"/>`, defaults: { w: 120, h: 60 } },
      { id: 'roundRect', label: 'Прямоугольник скругл.', render: (w, h) => `<rect width="${w}" height="${h}" rx="10" ry="10"/>`, defaults: { w: 120, h: 60 } },
      { id: 'ellipse', label: 'Эллипс / Овал', render: (w, h) => `<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2-1}" ry="${h/2-1}"/>`, defaults: { w: 120, h: 60 } },
      { id: 'circle', label: 'Круг', render: (w, h) => { const r = Math.min(w, h)/2-1; return `<ellipse cx="${w/2}" cy="${h/2}" rx="${r}" ry="${r}"/>`; }, defaults: { w: 80, h: 80 } },
      { id: 'diamond', label: 'Ромб', render: (w, h) => `<polygon points="${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}"/>`, defaults: { w: 100, h: 80 } },
      { id: 'triangle', label: 'Треугольник', render: (w, h) => `<polygon points="${w/2},0 ${w},${h} 0,${h}"/>`, defaults: { w: 100, h: 80 } },
      { id: 'hexagon', label: 'Шестиугольник', render: (w, h) => {
        const dx = w * 0.25;
        return `<polygon points="${dx},0 ${w-dx},0 ${w},${h/2} ${w-dx},${h} ${dx},${h} 0,${h/2}"/>`;
      }, defaults: { w: 120, h: 70 } },
      { id: 'parallelogram', label: 'Параллелограмм', render: (w, h) => {
        const dx = w * 0.18;
        return `<polygon points="${dx},0 ${w},0 ${w-dx},${h} 0,${h}"/>`;
      }, defaults: { w: 120, h: 60 } },
      { id: 'trapezoid', label: 'Трапеция', render: (w, h) => {
        const dx = w * 0.2;
        return `<polygon points="${dx},0 ${w-dx},0 ${w},${h} 0,${h}"/>`;
      }, defaults: { w: 120, h: 70 } },
      { id: 'cylinder', label: 'Цилиндр (БД)', render: (w, h) => {
        const ry = Math.min(h * 0.15, 14);
        return `<path d="M 0,${ry} A ${w/2},${ry} 0 0,0 ${w},${ry} L ${w},${h-ry} A ${w/2},${ry} 0 0,1 0,${h-ry} Z" />`
          + `<path d="M 0,${ry} A ${w/2},${ry} 0 0,1 ${w},${ry}" fill="none"/>`;
      }, defaults: { w: 100, h: 110 } },
      { id: 'cloud', label: 'Облако', render: (w, h) => {
        // упрощённое облако (drawio cloud-shape)
        return `<path d="M ${w*0.25},${h*0.7} C ${w*0.05},${h*0.6} ${w*0.05},${h*0.3} ${w*0.25},${h*0.3} C ${w*0.25},${h*0.05} ${w*0.55},${h*0.05} ${w*0.6},${h*0.25} C ${w*0.85},${h*0.15} ${w*0.95},${h*0.45} ${w*0.85},${h*0.6} C ${w*0.95},${h*0.85} ${w*0.6},${h*0.95} ${w*0.45},${h*0.85} C ${w*0.25},${h*0.95} ${w*0.05},${h*0.85} ${w*0.25},${h*0.7} Z"/>`;
      }, defaults: { w: 140, h: 90 } },
      { id: 'document', label: 'Документ', render: (w, h) => {
        // лист с волной снизу
        return `<path d="M 0,0 L ${w},0 L ${w},${h*0.85} Q ${w*0.75},${h} ${w*0.5},${h*0.92} Q ${w*0.25},${h*0.85} 0,${h*0.95} Z"/>`;
      }, defaults: { w: 120, h: 80 } },
    ],
  },
  flowchart: {
    label: '📊 Блок-схемы (BPMN)',
    shapes: [
      { id: 'fc-process', label: 'Процесс', render: (w, h) => `<rect width="${w}" height="${h}"/>`, defaults: { w: 120, h: 60 } },
      { id: 'fc-decision', label: 'Решение', render: (w, h) => `<polygon points="${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}"/>`, defaults: { w: 120, h: 80 } },
      { id: 'fc-terminator', label: 'Терминатор (старт/стоп)', render: (w, h) => `<rect x="0" y="0" width="${w}" height="${h}" rx="${h/2}" ry="${h/2}"/>`, defaults: { w: 110, h: 50 } },
      { id: 'fc-data', label: 'Данные', render: (w, h) => {
        const dx = w * 0.15;
        return `<polygon points="${dx},0 ${w},0 ${w-dx},${h} 0,${h}"/>`;
      }, defaults: { w: 120, h: 60 } },
      { id: 'fc-document', label: 'Документ', render: (w, h) => {
        return `<path d="M 0,0 L ${w},0 L ${w},${h*0.85} Q ${w*0.75},${h} ${w*0.5},${h*0.92} Q ${w*0.25},${h*0.85} 0,${h*0.95} Z"/>`;
      }, defaults: { w: 120, h: 80 } },
      { id: 'fc-manual-input', label: 'Ручной ввод', render: (w, h) => {
        return `<polygon points="0,${h*0.3} ${w},0 ${w},${h} 0,${h}"/>`;
      }, defaults: { w: 120, h: 60 } },
      { id: 'fc-preparation', label: 'Подготовка', render: (w, h) => {
        const dx = w * 0.15;
        return `<polygon points="${dx},0 ${w-dx},0 ${w},${h/2} ${w-dx},${h} ${dx},${h} 0,${h/2}"/>`;
      }, defaults: { w: 130, h: 60 } },
      { id: 'fc-display', label: 'Дисплей', render: (w, h) => {
        return `<path d="M ${w*0.2},0 L ${w*0.85},0 Q ${w},${h/2} ${w*0.85},${h} L ${w*0.2},${h} L 0,${h/2} Z"/>`;
      }, defaults: { w: 130, h: 60 } },
      { id: 'fc-off-page', label: 'Соединитель', render: (w, h) => {
        return `<polygon points="0,0 ${w},0 ${w},${h*0.6} ${w/2},${h} 0,${h*0.6}"/>`;
      }, defaults: { w: 100, h: 80 } },
    ],
  },
  network: {
    label: '🌐 Сеть / IT',
    shapes: [
      { id: 'net-server', label: 'Сервер', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="3"/>`
          + `<rect x="${w*0.15}" y="${h*0.15}" width="${w*0.7}" height="${h*0.12}" fill="#94a3b8" stroke="none"/>`
          + `<rect x="${w*0.15}" y="${h*0.35}" width="${w*0.7}" height="${h*0.12}" fill="#94a3b8" stroke="none"/>`
          + `<rect x="${w*0.15}" y="${h*0.55}" width="${w*0.7}" height="${h*0.12}" fill="#94a3b8" stroke="none"/>`
          + `<circle cx="${w*0.85}" cy="${h*0.85}" r="${Math.min(w,h)*0.04}" fill="#22c55e" stroke="none"/>`;
      }, defaults: { w: 80, h: 110 } },
      { id: 'net-router', label: 'Роутер', render: (w, h) => {
        const r = Math.min(w, h) * 0.45;
        return `<circle cx="${w/2}" cy="${h/2}" r="${r}" />`
          + `<text x="${w/2}" y="${h/2 + 4}" text-anchor="middle" font-size="10" fill="#1f2937" stroke="none">R</text>`
          + `<path d="M ${w*0.25},${h*0.4} L ${w*0.4},${h*0.55}" stroke="#1f2937" stroke-width="1.5" fill="none"/>`
          + `<path d="M ${w*0.6},${h*0.45} L ${w*0.75},${h*0.6}" stroke="#1f2937" stroke-width="1.5" fill="none"/>`;
      }, defaults: { w: 80, h: 80 } },
      { id: 'net-switch', label: 'Свитч / коммутатор', render: (w, h) => {
        return `<rect x="0" y="${h*0.35}" width="${w}" height="${h*0.3}" rx="3"/>`
          + `<path d="M ${w*0.15},${h*0.15} L ${w*0.85},${h*0.15} M ${w*0.85},${h*0.15} L ${w*0.78},${h*0.1} M ${w*0.85},${h*0.15} L ${w*0.78},${h*0.2}" stroke="#1f2937" stroke-width="1.5" fill="none"/>`
          + `<path d="M ${w*0.85},${h*0.85} L ${w*0.15},${h*0.85} M ${w*0.15},${h*0.85} L ${w*0.22},${h*0.8} M ${w*0.15},${h*0.85} L ${w*0.22},${h*0.9}" stroke="#1f2937" stroke-width="1.5" fill="none"/>`;
      }, defaults: { w: 110, h: 80 } },
      { id: 'net-firewall', label: 'Файрвол', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="2" fill="#fef3c7" stroke="#d97706"/>`
          + `<path d="M 0,${h*0.25} L ${w},${h*0.25} M 0,${h*0.5} L ${w},${h*0.5} M 0,${h*0.75} L ${w},${h*0.75}" stroke="#d97706" stroke-width="1" fill="none"/>`
          + `<path d="M ${w*0.2},${h*0.25} L ${w*0.2},${h*0.5} M ${w*0.5},${h*0.25} L ${w*0.5},${h*0.5} M ${w*0.8},${h*0.25} L ${w*0.8},${h*0.5} M ${w*0.35},${h*0.5} L ${w*0.35},${h*0.75} M ${w*0.65},${h*0.5} L ${w*0.65},${h*0.75}" stroke="#d97706" stroke-width="1" fill="none"/>`;
      }, defaults: { w: 100, h: 70 } },
      { id: 'net-computer', label: 'ПК / Workstation', render: (w, h) => {
        return `<rect x="${w*0.05}" y="0" width="${w*0.9}" height="${h*0.7}" rx="3"/>`
          + `<rect x="0" y="${h*0.7}" width="${w}" height="${h*0.08}" />`
          + `<rect x="${w*0.4}" y="${h*0.78}" width="${w*0.2}" height="${h*0.18}" fill="none"/>`;
      }, defaults: { w: 100, h: 90 } },
      { id: 'net-database', label: 'База данных', render: (w, h) => {
        const ry = Math.min(h * 0.12, 12);
        return `<path d="M 0,${ry} A ${w/2},${ry} 0 0,0 ${w},${ry} L ${w},${h-ry} A ${w/2},${ry} 0 0,1 0,${h-ry} Z" />`
          + `<path d="M 0,${ry} A ${w/2},${ry} 0 0,1 ${w},${ry}" fill="none"/>`
          + `<path d="M 0,${ry*2.5} A ${w/2},${ry} 0 0,1 ${w},${ry*2.5}" fill="none" opacity="0.5"/>`;
      }, defaults: { w: 100, h: 110 } },
      { id: 'net-cloud', label: 'Облако / Internet', render: (w, h) => {
        return `<path d="M ${w*0.25},${h*0.7} C ${w*0.05},${h*0.6} ${w*0.05},${h*0.3} ${w*0.25},${h*0.3} C ${w*0.25},${h*0.05} ${w*0.55},${h*0.05} ${w*0.6},${h*0.25} C ${w*0.85},${h*0.15} ${w*0.95},${h*0.45} ${w*0.85},${h*0.6} C ${w*0.95},${h*0.85} ${w*0.6},${h*0.95} ${w*0.45},${h*0.85} C ${w*0.25},${h*0.95} ${w*0.05},${h*0.85} ${w*0.25},${h*0.7} Z"/>`;
      }, defaults: { w: 140, h: 90 } },
      { id: 'net-laptop', label: 'Ноутбук', render: (w, h) => {
        return `<rect x="${w*0.1}" y="${h*0.1}" width="${w*0.8}" height="${h*0.55}" rx="2"/>`
          + `<polygon points="0,${h*0.85} ${w},${h*0.85} ${w*0.95},${h*0.95} ${w*0.05},${h*0.95}"/>`;
      }, defaults: { w: 110, h: 80 } },
      { id: 'net-mobile', label: 'Смартфон', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="${Math.min(w,h)*0.1}"/>`
          + `<rect x="${w*0.1}" y="${h*0.12}" width="${w*0.8}" height="${h*0.7}" fill="none" opacity="0.5"/>`
          + `<circle cx="${w/2}" cy="${h*0.92}" r="${Math.min(w,h)*0.04}" fill="none"/>`;
      }, defaults: { w: 50, h: 90 } },
    ],
  },
  electrical: {
    label: '⚡ Электрика',
    shapes: [
      { id: 'el-source', label: 'Источник питания', render: (w, h) => {
        const r = Math.min(w, h) * 0.4;
        return `<circle cx="${w/2}" cy="${h/2}" r="${r}"/>`
          + `<path d="M ${w/2-r/2},${h/2-r*0.4} L ${w/2-r/2},${h/2+r*0.4} M ${w/2},${h/2-r*0.5} L ${w/2},${h/2+r*0.5}" stroke="#1f2937" stroke-width="2" fill="none"/>`
          + `<path d="M ${w/2+r/3},${h/2} L ${w/2+r/3},${h/2-r*0.3}" stroke="#1f2937" stroke-width="2" fill="none"/>`;
      }, defaults: { w: 80, h: 80 } },
      { id: 'el-ground', label: 'Земля', render: (w, h) => {
        return `<path d="M ${w/2},0 L ${w/2},${h*0.5}" stroke="#1f2937" stroke-width="2" fill="none"/>`
          + `<path d="M ${w*0.2},${h*0.5} L ${w*0.8},${h*0.5} M ${w*0.3},${h*0.7} L ${w*0.7},${h*0.7} M ${w*0.4},${h*0.9} L ${w*0.6},${h*0.9}" stroke="#1f2937" stroke-width="2" fill="none"/>`;
      }, defaults: { w: 60, h: 60 } },
      { id: 'el-motor', label: 'Двигатель (M)', render: (w, h) => {
        const r = Math.min(w, h) * 0.4;
        return `<circle cx="${w/2}" cy="${h/2}" r="${r}"/>`
          + `<text x="${w/2}" y="${h/2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#1f2937" stroke="none">M</text>`;
      }, defaults: { w: 70, h: 70 } },
      { id: 'el-transformer', label: 'Трансформатор', render: (w, h) => {
        const r = Math.min(w * 0.25, h * 0.4);
        const cx1 = w * 0.4, cx2 = w * 0.6, cy = h / 2;
        return `<circle cx="${cx1}" cy="${cy}" r="${r}" fill="none"/>`
          + `<circle cx="${cx2}" cy="${cy}" r="${r}" fill="none"/>`;
      }, defaults: { w: 100, h: 60 } },
      { id: 'el-breaker', label: 'Автомат / выключатель', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="2"/>`
          + `<path d="M ${w*0.3},${h*0.7} L ${w*0.7},${h*0.3}" stroke="#1f2937" stroke-width="2" fill="none"/>`
          + `<circle cx="${w*0.3}" cy="${h*0.7}" r="2.5" fill="#1f2937"/>`
          + `<circle cx="${w*0.7}" cy="${h*0.3}" r="2.5" fill="#1f2937"/>`;
      }, defaults: { w: 60, h: 80 } },
      { id: 'el-panel', label: 'Щит распределит.', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="2"/>`
          + `<rect x="${w*0.1}" y="${h*0.1}" width="${w*0.8}" height="${h*0.15}" fill="#cbd5e1" stroke="#475569"/>`
          + `<rect x="${w*0.1}" y="${h*0.35}" width="${w*0.35}" height="${h*0.55}" fill="#fff" stroke="#475569"/>`
          + `<rect x="${w*0.55}" y="${h*0.35}" width="${w*0.35}" height="${h*0.55}" fill="#fff" stroke="#475569"/>`;
      }, defaults: { w: 100, h: 130 } },
      { id: 'el-ups', label: 'ИБП', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="3"/>`
          + `<rect x="${w*0.1}" y="${h*0.1}" width="${w*0.8}" height="${h*0.3}" fill="none"/>`
          + `<text x="${w/2}" y="${h*0.3}" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2937" stroke="none">UPS</text>`
          + `<rect x="${w*0.15}" y="${h*0.55}" width="${w*0.15}" height="${h*0.3}" fill="#22c55e" stroke="none"/>`
          + `<rect x="${w*0.35}" y="${h*0.55}" width="${w*0.15}" height="${h*0.3}" fill="#22c55e" stroke="none"/>`
          + `<rect x="${w*0.55}" y="${h*0.55}" width="${w*0.15}" height="${h*0.3}" fill="#22c55e" stroke="none"/>`
          + `<rect x="${w*0.75}" y="${h*0.55}" width="${w*0.15}" height="${h*0.3}" fill="#fbbf24" stroke="none"/>`;
      }, defaults: { w: 100, h: 110 } },
      { id: 'el-rack', label: 'Серверная стойка', render: (w, h) => {
        let s = `<rect width="${w}" height="${h}" rx="2"/>`;
        const rows = 8;
        for (let i = 1; i < rows; i++) {
          s += `<line x1="${w*0.1}" y1="${h*i/rows}" x2="${w*0.9}" y2="${h*i/rows}" stroke="#94a3b8" stroke-width="0.7"/>`;
        }
        return s;
      }, defaults: { w: 70, h: 130 } },
      { id: 'el-generator', label: 'Дизель-генератор', render: (w, h) => {
        const r = Math.min(w, h) * 0.4;
        return `<circle cx="${w/2}" cy="${h/2}" r="${r}"/>`
          + `<text x="${w/2}" y="${h/2 + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#1f2937" stroke="none">G</text>`;
      }, defaults: { w: 70, h: 70 } },
    ],
  },
  hvac: {
    label: '❄ HVAC / Климат',
    shapes: [
      { id: 'hv-chiller', label: 'Чиллер', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="3"/>`
          + `<text x="${w/2}" y="${h*0.3}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e40af" stroke="none">CHILLER</text>`
          + `<path d="M ${w*0.2},${h*0.55} l 5,-5 l 5,5 m -10,5 l 5,-5 l 5,5 M ${w*0.4},${h*0.55} l 5,-5 l 5,5 m -10,5 l 5,-5 l 5,5 M ${w*0.6},${h*0.55} l 5,-5 l 5,5 m -10,5 l 5,-5 l 5,5 M ${w*0.8},${h*0.55} l 5,-5 l 5,5 m -10,5 l 5,-5 l 5,5" stroke="#1e40af" fill="none"/>`;
      }, defaults: { w: 130, h: 80 } },
      { id: 'hv-crac', label: 'CRAC / прецизионник', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="2"/>`
          + `<text x="${w/2}" y="${h*0.4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1e40af" stroke="none">CRAC</text>`
          + `<path d="M ${w*0.2},${h*0.65} L ${w*0.8},${h*0.65} M ${w*0.2},${h*0.8} L ${w*0.8},${h*0.8}" stroke="#1e40af" stroke-width="1.5" fill="none"/>`;
      }, defaults: { w: 90, h: 110 } },
      { id: 'hv-dx', label: 'DX-сплит', render: (w, h) => {
        return `<rect width="${w}" height="${h}" rx="3"/>`
          + `<path d="M ${w*0.15},${h*0.5} L ${w*0.85},${h*0.5}" stroke="#1f2937" stroke-width="2" fill="none"/>`
          + `<path d="M ${w*0.25},${h*0.7} L ${w*0.75},${h*0.7}" stroke="#94a3b8" stroke-width="1.5" fill="none"/>`;
      }, defaults: { w: 110, h: 50 } },
      { id: 'hv-fan', label: 'Вентилятор', render: (w, h) => {
        const r = Math.min(w, h) * 0.4;
        return `<circle cx="${w/2}" cy="${h/2}" r="${r}"/>`
          + `<path d="M ${w/2},${h/2-r*0.7} A ${r*0.5},${r*0.5} 0 0,1 ${w/2+r*0.5},${h/2} A ${r*0.5},${r*0.5} 0 0,1 ${w/2},${h/2+r*0.7} A ${r*0.5},${r*0.5} 0 0,1 ${w/2-r*0.5},${h/2} A ${r*0.5},${r*0.5} 0 0,1 ${w/2},${h/2-r*0.7} Z" fill="#94a3b8" stroke="#1f2937"/>`;
      }, defaults: { w: 70, h: 70 } },
      { id: 'hv-pump', label: 'Насос', render: (w, h) => {
        const r = Math.min(w, h) * 0.4;
        return `<circle cx="${w/2}" cy="${h/2}" r="${r}"/>`
          + `<text x="${w/2}" y="${h/2 + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#1f2937" stroke="none">P</text>`;
      }, defaults: { w: 70, h: 70 } },
      { id: 'hv-cooltower', label: 'Градирня', render: (w, h) => {
        return `<polygon points="${w*0.1},0 ${w*0.9},0 ${w},${h} 0,${h}"/>`
          + `<path d="M ${w*0.2},${h*0.5} L ${w*0.8},${h*0.5}" stroke="#1f2937" stroke-width="1" fill="none" stroke-dasharray="3,2"/>`;
      }, defaults: { w: 90, h: 100 } },
    ],
  },
  arrows: {
    label: '➡ Стрелки и блоки',
    shapes: [
      { id: 'ar-right', label: 'Стрелка вправо', render: (w, h) => {
        const ay = h * 0.25, by = h * 0.75;
        return `<polygon points="0,${ay} ${w*0.7},${ay} ${w*0.7},0 ${w},${h/2} ${w*0.7},${h} ${w*0.7},${by} 0,${by}"/>`;
      }, defaults: { w: 130, h: 50 } },
      { id: 'ar-down', label: 'Стрелка вниз', render: (w, h) => {
        const ax = w * 0.25, bx = w * 0.75;
        return `<polygon points="${ax},0 ${bx},0 ${bx},${h*0.7} ${w},${h*0.7} ${w/2},${h} 0,${h*0.7} ${ax},${h*0.7}"/>`;
      }, defaults: { w: 60, h: 130 } },
      { id: 'ar-double', label: 'Двойная стрелка', render: (w, h) => {
        const ay = h * 0.25, by = h * 0.75;
        return `<polygon points="0,${h/2} ${w*0.2},0 ${w*0.2},${ay} ${w*0.8},${ay} ${w*0.8},0 ${w},${h/2} ${w*0.8},${h} ${w*0.8},${by} ${w*0.2},${by} ${w*0.2},${h}"/>`;
      }, defaults: { w: 130, h: 50 } },
      { id: 'callout', label: 'Выноска / комментарий', render: (w, h) => {
        return `<path d="M 0,0 L ${w},0 L ${w},${h*0.7} L ${w*0.5},${h*0.7} L ${w*0.4},${h} L ${w*0.4},${h*0.7} L 0,${h*0.7} Z"/>`;
      }, defaults: { w: 130, h: 80 } },
      { id: 'note', label: 'Стикер / Note', render: (w, h) => {
        return `<path d="M 0,0 L ${w*0.85},0 L ${w},${h*0.15} L ${w},${h} L 0,${h} Z" fill="#fef9c3" stroke="#ca8a04"/>`
          + `<path d="M ${w*0.85},0 L ${w*0.85},${h*0.15} L ${w},${h*0.15}" fill="#fde68a" stroke="#ca8a04"/>`;
      }, defaults: { w: 110, h: 80 } },
    ],
  },
};

/** Возвращает shape definition по id (поиск по всем категориям). */
export function findShapeDef(shapeId) {
  for (const cat of Object.values(SHAPE_LIBRARY)) {
    const s = cat.shapes.find(sh => sh.id === shapeId);
    if (s) return s;
  }
  return null;
}

/** Возвращает массив всех shape ids. */
export function listAllShapeIds() {
  const ids = [];
  for (const cat of Object.values(SHAPE_LIBRARY)) {
    for (const sh of cat.shapes) ids.push(sh.id);
  }
  return ids;
}
