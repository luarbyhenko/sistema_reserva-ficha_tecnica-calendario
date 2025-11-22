// ====== CONFIG ======
// UNA sola URL de tu Web App (misma para Pestañas y Faciales)
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzd4ra2DwPqpr2d8GuFVab5aW9RUu4hAhqbMSghDT1n1sy9QMo4Q0xGDKZY9716GkQ/exec';
const TOKEN = ''; // ej: 'mi-super-token' si usas token
const SHEET_BY_TIPO = {
  'Pestañas': 'FT.Pestañas',
  'Faciales': 'FT.Facial',   // ← ESTE es el nombre real de tu hoja
};




// ====== HELPERS ======
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const setHidden = (el, hidden) => { if (!el) return; el.hidden = !!hidden; };
const openModal = (modal) => { if (!modal) return; modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); };
const closeModal = (modal) => { if (!modal) return; modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); };


// 🔹 ESTA FUNCIÓN DEBE ESTAR EN EL NIVEL GLOBAL, FUERA DE IIFEs/BLOQUES
async function loadRecordatoriosHome() {
  try {
    const data = await fetchRecorditoriosHome(); // <-- ojo al nombre real: fetchRecordatoriosHome o fetchRecorditoriosHome

    console.log('[HOME] recordatorios:', data);

    renderListSimple(hoyCumplesHoyList, hoyCumplesHoyEmpty, data.cumple_hoy, { isCumple: true });
    renderListSimple(hoyPreReservasList, hoyPreReservasEmpty, data.prereservas, { withHora: true });
    renderTurnosHoy(turnosHoyList, turnosHoyEmpty, data.turnos_hoy);

    if (cumplesHoyCountEl)  cumplesHoyCountEl.textContent  = String(data.cumple_hoy?.length || 0);
    if (confirmarCountEl)   confirmarCountEl.textContent   = String(data.prereservas?.length || 0);
    if (turnosHoyCountEl)   turnosHoyCountEl.textContent   = String(data.turnos_hoy?.length || 0);

    // cache en ventana
    window.__REC_CACHE = data;
    return data;

  } catch (err) {
    console.error('Recordatorios:', err);
    if (hoyCumplesHoyEmpty)  { hoyCumplesHoyEmpty.hidden  = false; hoyCumplesHoyEmpty.textContent  = 'No se pudieron cargar los cumpleaños de hoy.'; }
    if (hoyPreReservasEmpty) { hoyPreReservasEmpty.hidden = false; hoyPreReservasEmpty.textContent = 'No se pudieron cargar las pre-reservas.'; }
    if (turnosHoyEmpty)      { turnosHoyEmpty.hidden      = false; turnosHoyEmpty.textContent      = 'No se pudieron cargar los turnos de hoy.'; }
    if (cumplesHoyCountEl)  cumplesHoyCountEl.textContent  = '0';
    if (confirmarCountEl)   confirmarCountEl.textContent   = '0';
    if (turnosHoyCountEl)   turnosHoyCountEl.textContent   = '0';
    return { turnos_hoy: [], cumple_hoy: [], prereservas: [] };
  }
}



// === Toast minimalista (para mensajes rápidos) ===
function toast(msg = '', timeout = 3000) {
  // Reutiliza el mismo contenedor si ya existe
  let host = document.getElementById('toaster');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toaster';
    host.style.position = 'fixed';
    host.style.bottom = '20px';
    host.style.right = '20px';
    host.style.zIndex = '9999';
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.gap = '10px';
    document.body.appendChild(host);
  }

  const el = document.createElement('div');
  el.textContent = msg;
  el.style.background = 'rgba(30,28,59,0.95)';
  el.style.color = '#fff';
  el.style.padding = '10px 16px';
  el.style.borderRadius = '8px';
  el.style.fontSize = '0.9rem';
  el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
  el.style.transition = 'all 0.3s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';

  host.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  // Auto-cierre
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    setTimeout(() => el.remove(), 300);
  }, timeout);
}



// ========= NOTIFICACIONES (toast + modal de error) =========

// Limpia texto para evitar inyección accidental al meter HTML
function escapeHTML(str){
  return String(str || '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

/* === Helpers: estado de carga con puntos suspensivos en botones === */
function startBtnEllipsis(btn, baseLabel = 'Actualizando') {
  if (!btn) return () => {};
  // Guardar estado original
  const original = {
    text: btn.textContent,
    disabled: btn.disabled,
    ariaBusy: btn.getAttribute('aria-busy') // puede ser null
  };

  // Bloquear botón y marcar accesibilidad
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');

  // Evitar “saltos” de ancho
  const w = btn.getBoundingClientRect().width;
  btn.style.minWidth = w ? `${Math.ceil(w)}px` : btn.style.minWidth;

  // Animación de puntos …
  let i = 0;
  const tick = () => {
    i = (i + 1) % 4; // 0..3
    const dots = '…'.repeat(i || 1); // al menos 1
    btn.textContent = `${baseLabel} ${dots}`;
  };
  tick();
  const id = setInterval(tick, 350);

  // Función para detener y restaurar
  return function stopBtnEllipsis() {
    clearInterval(id);
    btn.textContent = original.text;
    btn.disabled = original.disabled;
    if (original.ariaBusy === null) btn.removeAttribute('aria-busy');
    else btn.setAttribute('aria-busy', original.ariaBusy);
    // Quita minWidth si quieres: btn.style.minWidth = '';
  };
}

/** Decorador práctico: ejecuta una función async mostrando el estado de carga en el botón */
async function withButtonLoading(btn, baseLabel, fn) {
  const stop = startBtnEllipsis(btn, baseLabel);
  try {
    return await fn();
  } finally {
    stop();
  }
}



// ——— Normaliza nombres para comparar de forma robusta ———
function normalizeNameFull(s){
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sin tildes
    .replace(/\s+/g,' ')      // espacios múltiples -> uno
    .trim()                   // sin bordes
    .toLowerCase();           // comparar en minúsculas
}

/**
 * Busca duplicado por NOMBRE COMPLETO en el servicio (tipo) dado.
 * - tipo: 'Pestañas' | 'Faciales'
 * - fullName: nombre completo (Nombre + Apellido si lo tienes, o el campo 'nombre' tal cual)
 * Devuelve: { duplicate: boolean, match?: {...rowEncontrada} }
 */

async function checkDuplicateFullName({ tipo, fullName }){
  const wanted = normalizeNameFull(fullName);
  if (!wanted) return { duplicate:false };

  // Trae fichas del tipo actual y compara por 'nombre'
  const rows = await window.apiFetchFichas(tipo).catch(() => []);
  const match = rows.find(r => normalizeNameFull(r?.nombre) === wanted);
  return { duplicate: !!match, match };
}



/* === Modal genérico reutilizable para ver detalles === */
function ensureDetalleModal(){
  let modal = document.getElementById('detalleModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'detalleModal';
  modal.className = 'modal modal--success';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal__overlay" data-close="true"></div>
    <div class="modal__content" role="dialog" aria-modal="true" aria-labelledby="detalleTitle">
      <div class="modal__header modal__header--success">
       <h3 id="detalleTitle">Detalle</h3>
        <button class="modal__close" type="button" aria-label="Cerrar" data-close="true">✕</button>
      </div>
      <div class="modal__body" id="detalleBody"></div>
      <div class="modal__footer">
        <button class="btn btn--ghost" type="button" data-close="true">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Cierre por overlay, botón ✕ y botón "Cerrar"
  modal.addEventListener('click', (e) => {
    const close = e.target?.closest('[data-close]');
    if (close) closeModal(modal);
  });
  return modal;
}

function showDetalleModal(titulo, html){
  const modal = ensureDetalleModal();
  const titleEl = modal.querySelector('#detalleTitle');
  const bodyEl  = modal.querySelector('#detalleBody');
  if (titleEl) titleEl.textContent = titulo || 'Detalle';
  if (bodyEl)  bodyEl.innerHTML    = html || '';
  openModal(modal);
}

// Render simple clave→valor en columnas; respeta tu estética
function kvTable(obj){
  const rows = Object.entries(obj)
    .filter(([_,v]) => String(v ?? '').trim() !== '')
    .map(([k,v]) => `
      <div style="display:grid;grid-template-columns:1fr auto;gap:.5rem;padding:.35rem .5rem;border-bottom:1px solid rgba(255,255,255,.08)">
        <span style="opacity:.8">${escapeHTML(k)}</span>
        <strong>${escapeHTML(v)}</strong>
      </div>
    `).join('');
  return `<div>${rows || '<p>Sin datos</p>'}</div>`;
}


// Crea y muestra un toast con el MISMO encabezado "banda" que la ficha
function showReservationToast({ titulo='Reserva guardada', cliente, fecha, hora, servicio } = {}){
  const host = document.getElementById('toaster') || (() => {
    const d = document.createElement('div'); d.id = 'toaster'; document.body.appendChild(d); return d;
  })();

  // Formatea hora a 12h si está disponible tu helper
  const hora12 = (typeof formatHora12 === 'function' && hora) ? formatHora12(hora) : (hora || '');

  const el = document.createElement('div');
  el.className = 'toast toast--ficha';

  el.innerHTML = `
    <div class="toast__header">
      <span class="toast__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>
          <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <div class="toast__title">${escapeHTML(titulo)}</div>
      <button class="toast__close" aria-label="Cerrar">&times;</button>
    </div>
    <div class="toast__body">
      <div class="toast__grid">
        ${[
          ['Cliente',  cliente || '—'],
          ['Fecha',    fecha   || '—'],
          ['Hora',     hora12  || '—'],
          servicio ? ['Servicio', servicio] : null
        ].filter(Boolean).map(([k,v]) => `
          <div class="toast__row">
            <span>${escapeHTML(k)}</span>
            <strong>${escapeHTML(v)}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  el.querySelector('.toast__close').onclick = () => closeToast(el);
  host.appendChild(el);
  setTimeout(() => closeToast(el), 4500);
}

function dayFrom(any, y, m){
  if (!any) return 0;
  const s = String(any).trim();

  // YYYY-MM-DD o YYYY/MM/DD
  let a = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (a){
    const Y = +a[1], M = +a[2], D = +a[3];
    return (Y === y && M === m) ? D : 0;
  }
  // DD-MM-YYYY o DD/MM/YYYY
  a = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (a){
    const D = +a[1], M = +a[2], Y = +a[3];
    return (Y === y && M === m) ? D : 0;
  }
  // DD/MM (sin año)
  a = s.match(/^(\d{1,2})[-\/](\d{1,2})$/);
  if (a){
    const D = +a[1], M = +a[2];
    return (M === m) ? D : 0;
  }
  // Date nativo
  const d = new Date(s);
  if (!isNaN(d)) {
    const Y = d.getFullYear(), M = d.getMonth()+1, D = d.getDate();
    return (Y === y && M === m) ? D : 0;
  }
  return 0;
}


// Hora robusta a 12h (AM/PM) para TODO el sistema
function formatHora12(anyHora) {
  if (anyHora == null) return '';
  const raw = String(anyHora).trim();
  if (!raw) return '';

  // 1) HH:mm o HH:mm:ss
  let m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (!isNaN(h) && !isNaN(mi)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr12 = h % 12 || 12;
      return `${hr12}:${String(mi).padStart(2, '0')} ${ampm}`;
    }
  }

  // 2) ¿Parseable como Date?
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // 3) ¿Fracción de día (0–1) tipo Excel/Sheets?
  const f = parseFloat(raw);
  if (!isNaN(f) && f >= 0 && f < 1) {
    const totalMin = Math.round(f * 24 * 60);
    const h24 = Math.floor(totalMin / 60) % 24;
    const mi = totalMin % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const hr12 = h24 % 12 || 12;
    return `${hr12}:${String(mi).padStart(2, '0')} ${ampm}`;
  }

  // 4) Fallback
  return raw;
}


function closeToast(el){
  if(!el) return;
  el.style.animation = 'toast-out .2s ease forwards';
  setTimeout(() => el.remove(), 180);
}

// Decide el título correcto del encabezado según el tipo
function computeToastTitle(payload){
  // Si ya viene un title explícito, respétalo:
  if (payload && payload.title) return payload.title;

  const tipo = String(payload?.tipo || '').toLowerCase();

  // Mapeo simple por tipo (extensible sin romper nada)
  if (tipo === 'reserva') return 'Reserva';
  if (tipo.includes('ficha')) return 'Ficha técnica';

  // Fallback genérico
  return 'Detalle';
}


// Normaliza claves de encabezados (igual estilo que en otras partes de tu app)
function normKeyFicha(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sin tildes
    .toLowerCase()
    .trim();
}

// Devuelve la lista de campos a mostrar en el popup de ficha,
// según el tipo/hoja (Pestañas / Faciales).
// Cada entrada es [nombreColumnaEnData, etiquetaParaMostrar]
function getFichaCampos(tipoFicha) {
  const t = String(tipoFicha || '').toLowerCase();

  // ----- PESTAÑAS -----
  // Claves REALES según tu log de pestañas:
  // "row", "nombre", "telefono", "correo", "cumple", "alergias",
  // "grosor_mm", "medida_mm", "forma_ojos", "tipo_diseno", "notas", "creado_en"
  const PESTANAS_MAP = {
    nombre:      'Nombre',
    telefono:    'Teléfono',
    correo:      'Correo',
    cumple:      'Cumpleaños',
    alergias:    'Alergias',
    grosor_mm:   'Tipo',          // renombrado
    medida_mm:   'Medida',        // renombrado
    forma_ojos:  'Forma de ojos',
    tipo_diseno: 'Tipo de diseño',
    notas:       'Notas'
  };

  // ----- FACIALES -----
  // Claves REALES según tu log de faciales:
  // "row", "nombre", "telefono", "correo", "cumple",
  // "procedimiento", "notas", "creado_en"
  // Solo podemos mostrar lo que realmente llega en match.data.
  const FACIAL_MAP = {
    nombre:                 'Nombre',
    telefono:               'Teléfono',
    correo:                 'Correo',
    cumple:                 'Cumpleaños',
    edad:                   'Edad',
    genero:                 'Género',
    motivo_de_consulta:     'Motivo de consulta',
    manchas:                'Manchas',
    procedimiento:          'Procedimiento',
    tipo_de_limpieza:       'Tipo de limpieza',
    notas:                  'Notas'
  };

  // Selección según el tipo
  if (t.includes('facial')) return FACIAL_MAP;
  return PESTANAS_MAP;
}



// Busca un valor dentro de obj por nombre de columna, pero de forma tolerante
// (sin tildes, minúsculas, sin espacios). Ej: "Teléfono", "telefono", "Teléfono " → mismo campo.
function getFieldValueFicha(obj, desiredKey) {
  if (!obj) return '';
  const target = normKeyFicha(desiredKey);
  let foundKey = null;

  for (const k of Object.keys(obj)) {
    if (normKeyFicha(k) === target) {
      foundKey = k;
      break;
    }
  }

  if (!foundKey) return '';
  return obj[foundKey];
}



// Devuelve una lista de [columnaEnData, etiqueta] en función del tipo de ficha
function getFichaCamposForToast(match) {
  const data = match?.data || {};
  const baseTipo = match?.tipo || match?.sheet || '';

  let tipoFicha = '';

  // 1) Intento por tipo/sheet (si en el futuro vienen rellenos)
  const base = String(baseTipo || '').toLowerCase();
  if (base.includes('facial')) {
    tipoFicha = 'Faciales';
  } else if (base.includes('pesta')) {
    tipoFicha = 'Pestañas';
  } else {
    // 2) Fallback por forma de los datos (sin inventar nombres):
    const keys = Object.keys(data);

    // Si tiene grosor_mm → seguro es ficha de pestañas
    if (keys.includes('grosor_mm')) {
      tipoFicha = 'Pestañas';
    }
    // Si no tiene grosor_mm pero sí procedimiento → ficha facial
    else if (keys.includes('procedimiento')) {
      tipoFicha = 'Faciales';
    }
    // Si no podemos distinguir, usamos pestañas como default
    else {
      tipoFicha = 'Pestañas';
    }
  }

  const map = getFichaCampos(tipoFicha);
  return Object.entries(map); // [[colName, label], ...]
}



// Intenta obtener el valor de una columna de forma tolerante
function getFieldValueFicha(data, colName) {
  if (!data) return '';

  // 1) Directo por key exacta (ej: "grosor_mm")
  if (Object.prototype.hasOwnProperty.call(data, colName)) {
    return data[colName];
  }

  // 2) Fallback tolerante por nombre normalizado (por si viniera "Grosor (mm)" o similar)
  const norm = s => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();

  const target = norm(colName);

  for (const [k, v] of Object.entries(data)) {
    if (norm(k) === target) return v;
  }

  return '';
}



// ====== FICHA TÉCNICA / RESERVA → Toast con detalle ======
// ====== FICHA TÉCNICA / RESERVA → Toast con detalle ======
function showFichaToast(match){
  if (!match?.exists && !match?.customHTML) return;

  // 🔎 Debug útil: puedes dejarlo o quitarlo después
  try {
    console.log('[TOAST ficha] tipo:', match?.tipo, 'sheet:', match?.sheet, 'keys:', Object.keys(match?.data || {}));
  } catch (_) {}

  // Función formateador suave de fechas
  function fmtVal(k, v){
    const s = String(v ?? '').trim();
    if (!s) return s;
    if (/(fecha|cumple|creación|creacion)/i.test(String(k))) {
      const d = new Date(s);
      if (!isNaN(d)) {
        return d.toLocaleDateString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit' });
      }
    }
    return s;
  }

  // Derivar etiqueta de servicio para el título
  const baseTipo = match?.tipo || match?.sheet || '';
  const servicio =
    String(baseTipo || '').toLowerCase().includes('facial')
      ? 'Facial'
      : 'Pestañas';

  // Resolver título según el tipo
  const tipoRaw   = String(match.tipo || '').toLowerCase();
  const isReserva = tipoRaw === 'reserva' || tipoRaw.includes('reserva');

  const titleText = match.title
    ? String(match.title)
    : (isReserva ? 'Reserva' : `Ficha técnica — ${servicio}`);

  // 🔥 NUEVO: Usar HTML personalizado si existe
  let bodyContent = '';
  
  if (match.customHTML) {
    bodyContent = match.customHTML;

  } else {
    const d = match.data || {};

    if (isReserva) {
      // 🔹 Caso RESERVA → comportamiento original (todas las columnas)
      const entries = Object.entries(d)
        .filter(([_, v]) => String(v ?? '').trim() !== '')
        .map(([k, v]) => `
          <div class="toast__row">
            <span>${escapeHTML(k)}</span>
            <strong>${escapeHTML(fmtVal(k, v))}</strong>
          </div>
        `)
        .join('');
      
      bodyContent = `
        <div class="toast__grid">
          ${entries || '<div class="toast__row"><span>Sin datos</span><strong>—</strong></div>'}
        </div>
      `;

    } else {
      // 🔹 Caso FICHA TÉCNICA (Pestañas / Facial) → solo campos seleccionados
      const fields = getFichaCamposForToast(match);

      const entries = fields
        .map(([colName, label]) => {
          const raw = getFieldValueFicha(d, colName);
          if (String(raw ?? '').trim() === '') return null; // ocultar vacíos

          const value = fmtVal(colName, raw);
          return `
            <div class="toast__row">
              <span>${escapeHTML(label)}</span>
              <strong>${escapeHTML(value)}</strong>
            </div>
          `;
        })
        .filter(Boolean)
        .join('');

      bodyContent = `
        <div class="toast__grid">
          ${entries || '<div class="toast__row"><span>Sin datos</span><strong>—</strong></div>'}
        </div>
      `;
    }
  }

  // Host del toaster
  const host = document.getElementById('toaster') || (() => {
    const c = document.createElement('div'); 
    c.id = 'toaster'; 
    document.body.appendChild(c); 
    return c;
  })();

  // Variante visual
  const variant = match.variant || 'ficha';

  // Estructura del popup con header "de banda"
  const el = document.createElement('div');
  el.className = `toast toast--info toast--${variant}`;
  el.innerHTML = `
    <div class="toast__header">
      <span class="toast__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle>
          <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </span>
      <div class="toast__title">${escapeHTML(titleText)}</div>
      <button class="toast__close" aria-label="Cerrar">&times;</button>
    </div>
    <div class="toast__body">
      ${bodyContent}
    </div>
  `;
  
  el.querySelector('.toast__close').onclick = () => closeToast(el);
  host.appendChild(el);
}



// ====== PRE-RESERVA → Toast con detalle (igual estilo que reservas) ======
function showPreReservaToast(p) {
  if (!p) return;
  const data = {
    'Nombre':   p.nombre   || '—',
    'Teléfono': p.telefono || '—',
    'Servicio': p.servicio || '—',
    'Fecha':    p.fecha    || '—',
    'Hora':     (typeof formatHora12 === 'function' && p.hora) ? formatHora12(p.hora) : (p.hora || '—')
  };

  // Usa el mismo componente visual que ya tienes
  if (typeof showFichaToast === 'function') {
    showFichaToast({
      exists: true,
      tipo: 'prereserva',      // para el título
      variant: 'ficha',        // usa tu estilo “ficha”
      data
    });
  } else if (typeof showDetalleModal === 'function') {
    showDetalleModal('Pre-reserva', kvTable(data));
  } else {
    alert('Pre-reserva:\n' + JSON.stringify(data, null, 2));
  }
}


// === Abre el formulario de Reservas con datos precargados ===
function openReservaForm(data) {
  try {
    // 👉 Usa el mismo modal y los mismos IDs que ya usas en el resto del código
    const formModal = document.getElementById('reservaModal');
    if (!formModal) {
      (typeof toast === 'function' ? toast : alert)('No se encontró el formulario de reservas (#reservaModal).');
      return;
    }

    // Abre el modal
    if (typeof openModal === 'function') {
      openModal(formModal);
    } else {
      formModal.style.display = 'block';
    }

    // Inputs (coinciden con tus variables resNombre, resTelefono, etc.)
    const inNombre   = document.getElementById('resNombre')   || formModal.querySelector('[name="nombre"]');
    const inTelefono = document.getElementById('resTelefono') || formModal.querySelector('[name="telefono"]');
    const inServicio = document.getElementById('resServicio') || formModal.querySelector('[name="servicio"]');
    const inFecha    = document.getElementById('resFecha')    || formModal.querySelector('[name="fecha"]');
    const inHora     = document.getElementById('resHora')     || formModal.querySelector('[name="hora"]');

    // Precarga segura (usa los valores crudos, sin formatear a 12h)
    if (inNombre)   inNombre.value   = (data && data.nombre)   || '';
    if (inTelefono) inTelefono.value = (data && data.telefono) || '';
    if (inServicio) inServicio.value = (data && data.servicio) || '';
    if (inFecha)    inFecha.value    = (data && data.fecha)    || '';
    if (inHora)     inHora.value     = (data && data.hora)     || '';

    // Foco inicial
    (inServicio || inNombre || inTelefono || inFecha || inHora)?.focus();

    // Asegura que el CTA se muestre/refresque
    try {
      if (typeof ensureReservaCta === 'function') ensureReservaCta();
      if (typeof clearReservaCta === 'function')  clearReservaCta();
      if (typeof maybeUpdateReservaCTA === 'function') maybeUpdateReservaCTA();
    } catch(_){}

    formModal.dataset.row = data?.id ? String(data.id) : '';  // ← si no hay id, limpiar



  } catch (e) {
    console.error('openReservaForm error:', e);
    if (typeof toast === 'function') toast('No se pudo abrir el formulario de reservas.');
  }
}





// Modal de error (reusa tu .modal del HTML)
function showErrorModal(titulo, mensaje){
  const modal = document.getElementById('errorModal');
  if (!modal){
    // fallback por si no pegaste el HTML del modal
    alert(`${titulo || 'Error'}\n\n${mensaje || 'Ocurrió un problema.'}`);
    return;
  }
  $('#errorTitle', modal).textContent = titulo || 'Error';
  $('#errorBody', modal).innerHTML = `<p>${escapeHTML(mensaje || 'Ocurrió un problema.')}</p>`;
  openModal(modal);
}


function todayStr() {
  const d = new Date();
  return d.toLocaleDateString('es-ES', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
  // Fecha “Hoy”
  const hoyFecha = $('#hoyFecha');
  if (hoyFecha) hoyFecha.textContent = todayStr();

  // Cierre modal de error (overlay y botones con data-close)
  const errorModal = $('#errorModal');
  if (errorModal){
    errorModal.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      const hit = t.closest('.modal__overlay, [data-close]');
      if (hit) closeModal(errorModal);
      try { loadRecordatoriosHome(); } catch(_) {}
    });
  }

  // --- Collapsibles: wire simple y idempotente ---
function wireCollapsibles(root = document){
  root.querySelectorAll('.card[data-collapsible] .card__toggle').forEach((btn) => {
    if (btn.dataset.toggleWired === '1') return; // evita duplicar
    btn.dataset.toggleWired = '1';

    // Sincroniza estado inicial según aria-expanded
    const panelId = btn.getAttribute('aria-controls');
    const panel   = panelId ? document.getElementById(panelId) : null;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (panel) panel.hidden = !expanded;

    // Toggle al hacer clic
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (panel) panel.hidden = isOpen; // si estaba abierto → ciérralo; si estaba cerrado → ábrelo
    });
  });
}

// Llamar una vez al cargar
wireCollapsibles();
});


  // Vistas
  const homeView       = $('#homeView');
  const fichasView     = $('#fichasView');
  const preReservaView = $('#preReservaView');

  // Botones
  const btnHoy        = $('#btnHoy');
  const btnFicha      = $('#btnFicha');
  const btnCrearFicha = $('#btnCrearFicha');
  const btnPreReserva = $('#btnPreReserva');
  const btnRefrescar  = $('#btnRefrescar'); // ← NUEVO

  // Calendario: vista + controles
const calendarioView = $('#calendarioView');   // ← NUEVO
const btnCalendario  = $('#btnCalendario');    // ← NUEVO


  // Modal + Forms (crear)
  const fichaModal   = $('#fichaModal');
  const formPestanas = $('#fichaFormPestanas');
  const formFaciales = $('#fichaFormFaciales');




/* ======================================================
   CRUD de Fichas técnicas (render + create + update + delete)
   ====================================================== */


window.apiFetchFichas = async function apiFetchFichas(tipo = currentType) {
  const sheet = SHEET_BY_TIPO[tipo] || SHEET_BY_TIPO['Pestañas'];

  const url = new URL(ENDPOINT);
  url.searchParams.set('scope', 'fichas');
  url.searchParams.set('tipo',  tipo);
  url.searchParams.set('sheet', sheet);
  url.searchParams.set('page',  '1');
  url.searchParams.set('limit', '200');
  url.searchParams.set('_', Date.now());
  if (TOKEN) url.searchParams.set('token', TOKEN);

  console.log('[GET fichas]', url.toString());

  const r = await fetch(url.toString());
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!r.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${r.status}`);

  const items = Array.isArray(data.data) ? data.data
             : Array.isArray(data.items) ? data.items
             : [];
  console.log(`[GET fichas] ${tipo} (${sheet}) -> ${items.length} registros`);
  return items;
};


// Crea ficha (accion = 'create' en tu GAS)
async function apiCreateFicha({ tipo, sheet, payload }) {
  const fd = new FormData();
  fd.set('action', 'create');
  fd.set('scope',  'fichas');
  fd.set('tipo',   tipo);
  fd.set('sheet',  sheet);
  if (TOKEN) fd.set('token', TOKEN);
  Object.entries(payload).forEach(([k, v]) => fd.set(k, v ?? ''));
  const res = await fetch(ENDPOINT, { method: 'POST', body: fd });
  const txt = await res.text();
  let json = {}; try { json = JSON.parse(txt); } catch(_){}
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}


  async function apiUpdateFicha({ tipo, sheet, row, payload }){
  const fd = new FormData();
  fd.set('action', 'update');
  fd.set('scope',  'fichas');
  fd.set('tipo',   tipo);
  fd.set('sheet',  sheet);
  fd.set('row',    String(row));
  if (TOKEN) fd.set('token', TOKEN);

  // Campos a actualizar (mapea lo que tengas en el form)
  Object.entries(payload).forEach(([k,v]) => fd.set(k, v ?? ''));

  const res  = await fetch(ENDPOINT, { method:'POST', body: fd });
  const txt  = await res.text();
  let json={}; try{ json=JSON.parse(txt);}catch(_){}
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}


// Normaliza “fila” que devuelve el backend (row / Row / _row / Fila, etc.)
function getRowId(obj, i) {
  const cand = obj?.row ?? obj?.Row ?? obj?._row ?? obj?.fila ?? obj?.Fila ?? obj?.__row;
  // Si nada viene del backend, intenta 2 + índice (asumiendo encabezados en fila 1)
  return (cand != null && String(cand).trim() !== '') ? cand : (i + 2);
}

// Renderiza el listado de fichas y cablea acciones (Editar / Eliminar)
// === FICHAS: un solo marco grande (nombre + teléfono + botones dentro) ===
function renderFichasList(listEl, emptyEl, rows, tipoActual) {
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = '';

  const items = Array.isArray(rows) ? rows : [];
  emptyEl.hidden = items.length > 0;
  if (!items.length) return;

  const get = (obj, ...opts) => {
    if (!obj) return '';
    const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const map = new Map(Object.keys(obj).map(k => [norm(k), k]));
    for (const k of opts) {
      const real = map.get(norm(k));
      const v = real ? obj[real] : '';
      if (String(v ?? '').trim()) return String(v).trim();
    }
    return '';
  };

  const frag = document.createDocumentFragment();

  items.forEach((r) => {
    const row      = Number(get(r,'row','fila','_row','id')) || r.row || '';
    const nombre   = get(r,'nombre','cliente') || '—';
    const telefono = get(r,'telefono','tel','phone') || '';
    const tipo     = tipoActual || (get(r,'tipo') || '').trim() || 'Pestañas';

    const li = document.createElement('li');
    li.className = 'ficha-item';

    li.innerHTML = `
      <div class="ficha-content">
        <div class="ficha-header">
          <span class="ficha-name">${nombre}</span>
          <span class="ficha-phone">${telefono}</span>
        </div>
        <div class="ficha-actions">
          <button type="button" class="btn btn--ghost js-ver">Ver</button>
          <button type="button" class="btn js-edit">Editar</button>
          <button type="button" class="btn btn--ghost js-delete">Eliminar</button>
        </div>
      </div>
    `;

    const btnVer = li.querySelector('.js-ver');
    const btnEdit = li.querySelector('.js-edit');
    const btnDel = li.querySelector('.js-delete');

    btnVer.addEventListener('click', () => {
      const plain = {};
      Object.entries(r).forEach(([k,v]) => { plain[k] = v; });
      showFichaToast?.({
        exists: true,
        tipo: 'ficha',
        variant: 'ficha',
        data: plain,
        title: `Ficha técnica — ${tipo}`
      });
    });

    btnEdit.addEventListener('click', () => openEditFicha?.({ ...r, row }, tipo));

    btnDel.addEventListener('click', async () => {
      if (!row) { toast?.('No se puede eliminar: fila desconocida.'); return; }
      try {
        await withButtonLoading(btnDel, 'Eliminando', async () => {
          await apiDeleteFichaByRow({ tipo, row });
        });
        await loadFichas();
      } catch(e){
        console.error(e);
        toast?.('No se pudo eliminar la ficha.');
      }
    });

    frag.appendChild(li);
  });

  listEl.appendChild(frag);
}



// Envía el form de ficha: CREA o ACTUALIZA según data-mode
async function submitFicha(form, tipo) {
  const isEdit = form?.dataset?.mode === 'edit';
  const row = form?.dataset?.row ? Number(form.dataset.row) : null;
  const sheet = SHEET_BY_TIPO[tipo] || SHEET_BY_TIPO['Pestañas'];

  const fd = new FormData(form);
  const payload = {};
  for (const [k, v] of fd.entries()) payload[k] = v ?? '';

  // 🔥 VERIFICAR DUPLICADOS POR NOMBRE COMPLETO
  const nombreCompleto = payload.nombre || '';
  if (!nombreCompleto.trim()) {
    toast?.('El nombre es obligatorio.');
    return;
  }

  try {
    const duplicateCheck = await checkDuplicateFullName({
      tipo: tipo,
      fullName: nombreCompleto
    });

    if (duplicateCheck.duplicate && !isEdit) {
      const continuar = confirm(
        `Ya existe una ficha con el nombre "${nombreCompleto}".\n\n` +
        `¿Deseas crear otra ficha con el mismo nombre?`
      );
      if (!continuar) {
        return;
      }
    }
  } catch (e) {
    console.error('Error al verificar duplicados:', e);
  }

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    if (isEdit && row != null) {
      await apiUpdateFicha({ tipo, sheet, row, payload });
      toast?.('Ficha actualizada.');
    } else {
      await apiCreateFicha({ tipo, sheet, payload });
      toast?.('Ficha creada.');
    }

    form.reset();
    delete form.dataset.mode;
    delete form.dataset.row;
    const sb = form.querySelector('button[type="submit"]');
    if (sb && form.dataset.submitOriginal) {
      sb.textContent = form.dataset.submitOriginal;
      delete form.dataset.submitOriginal;
    }
    const modal = document.getElementById('fichaModal');
    closeModal?.(modal);

    await loadFichas();

  } catch (e) {
    console.error('submitFicha error:', e);
    showErrorModal?.('No se pudo guardar la ficha', String(e).replace('Error:', '').trim());
  } finally {
    if (btn) btn.disabled = false;
  }
}


  // === RESERVA (nuevo modal) ===
  const btnCrear     = $('#btnCrear');
  const reservaModal = $('#reservaModal');
  const reservaForm  = $('#reservaForm');

  // Inputs del formulario de Reserva
  const resNombre   = $('#resNombre');
  const resTelefono = $('#resTelefono');
  const resServicio = $('#resServicio');
  const resFecha    = $('#resFecha');
  const resHora     = $('#resHora');
  const resAdelanto = $('#resAdelanto');
  const resPrecio   = $('#resPrecio');

  // CTA dinámico al final del form de Reserva
  function ensureReservaCta() {
    if (!reservaForm) return null;
    let cta = $('#reservaCta', reservaForm);
    if (!cta) {
      cta = document.createElement('div');
      cta.id = 'reservaCta';
      cta.className = 'mt-3';
      cta.setAttribute('aria-live','polite');
      reservaForm.appendChild(cta);
    }
    return cta;
  }
  function clearReservaCta() {
    const cta = ensureReservaCta();
    if (cta) cta.innerHTML = '';
  }

  // Estado tipo activo
  let currentType = 'Pestañas';
  const tipoToggle  = $('#tipoToggle');



// Actualiza una ficha por fila en la hoja correspondiente
// Elimina una ficha por fila en la hoja correspondiente
async function apiDeleteFichaByRow({ tipo, row }) {
  const sheet = SHEET_BY_TIPO[tipo] || SHEET_BY_TIPO['Pestañas'];

  const fd = new FormData();
  fd.set('action', 'delete');
  fd.set('scope',  'fichas');
  fd.set('tipo',   tipo);
  fd.set('sheet',  sheet);
  fd.set('row',    String(row));
  if (TOKEN) fd.set('token', TOKEN);

  console.log('[DELETE ficha] ->', tipo, sheet, 'row=', row);

  const res  = await fetch(ENDPOINT, { method:'POST', body: fd });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  console.log('[DELETE ficha] <-', res.status, text);

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}



// Carga y pinta el listado (usa el renderer de arriba)
async function loadFichas() {
  try {
    if (!fichasList || !fichasEmpty) return;
    fichasList.innerHTML = '';
    fichasEmpty.hidden = true;

    const rows = await apiFetchFichas(currentType);
    renderFichasList(fichasList, fichasEmpty, rows, currentType);
  } catch (e) {
    console.error('loadFichas:', e);
    if (fichasEmpty) {
      fichasEmpty.textContent = 'No se pudieron cargar las fichas.';
      fichasEmpty.hidden = false;
    }
  }
}



  // Listado Fichas
  const fichasList  = $('#fichasList');
  const fichasEmpty = $('#fichasEmpty');

  // --- Contenedores "Hoy" (recordatorios) ---
  const hoyCumplesHoyList   = $('#hoyCumplesHoyList');
  const hoyCumplesHoyEmpty  = $('#hoyCumplesHoyEmpty');
  const hoyPreReservasList  = $('#hoyPreReservasList');
  const hoyPreReservasEmpty = $('#hoyPreReservasEmpty');
  const turnosHoyList       = $('#turnosHoyList');
  const turnosHoyEmpty      = $('#turnosHoyEmpty');

  // Contadores (badges)
  const turnosHoyCountEl  = $('#turnosHoyCount');
  const cumplesHoyCountEl = $('#cumplesHoyCount');
  const confirmarCountEl  = $('#confirmarCount');

  // ====== Recordatorios (HOME) ======
async function fetchRecorditoriosHome() {
  const url = new URL(ENDPOINT);
  url.searchParams.set('tipo', 'Recordatorios');
  if (TOKEN) url.searchParams.set('token', TOKEN);
  // 🔥 cache-busting para RECORDATORIOS
  url.searchParams.set('_tsRec', Date.now().toString());

  const res  = await fetch(url.toString());
  const json = await res.json().catch(()=> ({}));
  if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

  const payload = json.data || json || {};
  const turnos = payload.turnos_hoy || payload.turnos || payload.reservas || [];
  const cumple = payload.cumple_hoy || payload.cumples || [];
  const preres = payload.prereservas || payload.recordatorios || [];

  return { turnos_hoy: turnos, cumple_hoy: cumple, prereservas: preres };
}





// GET directo con cache-bust para forzar lectura fresca del backend
async function apiGetRecordatorios() {
  const url = new URL(ENDPOINT);
  url.searchParams.set('tipo', 'Recordatorios');
  url.searchParams.set('_', Date.now()); // cache-bust
  if (TOKEN) url.searchParams.set('token', TOKEN);

  const res  = await fetch(url.toString());
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  // Normaliza salida a { prereservas, turnos_hoy, cumple_hoy }
  const payload = json.data || json || {};
  return {
    prereservas: payload.prereservas || payload.recordatorios || [],
    turnos_hoy:  payload.turnos_hoy  || payload.turnos       || payload.reservas || [],
    cumple_hoy:  payload.cumple_hoy  || payload.cumples      || []
  };
}






function renderListSimple(targetList, emptyEl, items, { withHora = false, isCumple = false } = {}) {
  if (!targetList || !emptyEl) return;

  // marca esta lista para aplicar el CSS de prereservas solo cuando corresponda
  if (withHora && !isCumple) {
    targetList.classList.add('list--prereservas');
  } else {
    targetList.classList.remove('list--prereservas');
  }

  // ⭐ NUEVO: marcar explícitamente las listas de cumpleaños
  if (isCumple) {
    targetList.classList.add('list--cumples');
  } else {
    targetList.classList.remove('list--cumples');
  }

  targetList.innerHTML = '';
  const has = Array.isArray(items) && items.length > 0;
  emptyEl.hidden = !!has;
  if (!has) return;

  const norm = s => String(s || '');
  const get = (row, keys) => {
    if (!row) return '';
    const n = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const map = new Map(Object.keys(row).map(k => [n(k), k]));
    for (const k of keys) {
      const real = map.get(n(k));
      const v = real ? row[real] : '';
      if (String(v ?? '').trim()) return String(v).trim();
    }
    return '';
  };

  const fmtHora = (h) =>
    (typeof formatHora12 === 'function' && h) ? formatHora12(h) : norm(h);

  const frag = document.createDocumentFragment();

  for (const it of items) {
    const li = document.createElement('div');
    li.className = 'list__item';

    // --- Datos base ---
    const nombre   = norm(it?.nombre   || get(it, ['Nombre']) || '—');
    const telefono = norm(it?.telefono || get(it, ['Teléfono','Telefono']));
    const fecha    = norm(it?.fecha    || get(it, ['Fecha'])  || '');
    const hora     = norm(it?.hora     || get(it, ['Hora'])   || '');
    const servicio = norm(it?.servicio || get(it, ['Servicio','Servicio principal','servicio_principal']));

    // 🔹 NUEVO: intentar recuperar el row real de la prereserva
    const rowId = it?.row || it?.Row || it?._row || '';

    // --- Header ---
    const header = document.createElement('div');
    header.className = 'pr-header';

    const title = document.createElement('div');
    title.className = 'pr-title';
    title.textContent = nombre;

    const phone = document.createElement('div');
    phone.className = 'pr-phone';
    phone.textContent = telefono;

    // ⭐ útil: mostrar completo al pasar mouse
    if (nombre)  title.title  = nombre;
    if (telefono) phone.title = telefono;

    header.append(title, phone);

    // --- Meta (fecha/hora o cumpleaños + servicio) ---
    const meta = document.createElement('div');
    meta.className = 'pr-meta';

    if (withHora) {
      const sFecha = document.createElement('span');
      sFecha.className = 'pr-muted';
      sFecha.textContent = fecha;

      const sHora = document.createElement('span');
      sHora.className = 'pr-muted';
      sHora.textContent = fmtHora(hora);

      meta.append(sFecha, sHora);

    } else if (isCumple) {
      // ⭐ IMPORTANTE: el backend manda { fecha: 'YYYY-MM-DD' } para cumple_hoy
      const sCumple = norm(
        it?.fecha ||
        it?.cumple ||
        get(it, ['Cumple','Cumpleaños','Cumpleanos','Fecha'])
      );

      if (sCumple) {
        const el = document.createElement('span');
        el.className = 'pr-muted';
        el.textContent = sCumple;
        meta.append(el);
      }
    }

    if (servicio) {
      const badge = document.createElement('span');
      badge.className = 'badge-service';
      badge.textContent = servicio;
      meta.append(badge);
    }

    // --- Acciones (solo prereservas) ---
    let actions = null;
    if (withHora && !isCumple) {
      actions = document.createElement('div');
      actions.className = 'pr-actions';

      // Botón Confirmado
      const btnOk = document.createElement('button');
      btnOk.type = 'button';
      btnOk.className = 'btn btn--block';
      btnOk.textContent = 'Confirmado';
      btnOk.setAttribute('aria-label', 'Confirmar reserva');
      btnOk.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try {
          if (typeof openReservaForm === 'function') {
            openReservaForm({ nombre, telefono, servicio, fecha, hora });
          } else {
            (typeof toast === 'function' ? toast : alert)('Falta implementar openReservaForm()');
          }
        } catch (e) {
          console.error(e);
          if (typeof toast === 'function') toast('No se pudo abrir el formulario de reservas.');
        }
      });
      actions.appendChild(btnOk);

      // Botón Eliminar (único, usando rowId)
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn--ghost btn--block';
      btnDel.textContent = 'Eliminar';
      btnDel.setAttribute('aria-label', 'Eliminar recordatorio');
      btnDel.style.marginTop = '8px';

      btnDel.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          await withButtonLoading(btnDel, 'Eliminando', async () => {
            await apiDeletePreReserva({
              row: rowId,
              nombre,
              telefono,
              fecha,
              hora
            });
          });

          // 🔄 Refrescar TODA la UI relacionada con agenda
          if (typeof refreshAgendaUI === 'function') {
            await refreshAgendaUI();
          }
        } catch (e) {
          console.error('Eliminar recordatorio:', e);
          toast?.('No se pudo eliminar el recordatorio.');
        }
      });

      actions.appendChild(btnDel);
    }

    // --- Ensamblado final de cada ítem ---
    if (actions) li.append(header, meta, actions);
    else li.append(header, meta);

    frag.appendChild(li);
  }

  targetList.appendChild(frag);
}



function renderTurnosHoy(listEl, emptyEl, items) {
  try {
    if (!listEl || !emptyEl) return;

    listEl.classList.remove('list--prereservas');
    listEl.innerHTML = '';

    const turnos = Array.isArray(items) ? items : [];
    emptyEl.hidden = turnos.length > 0;
    if (!turnos.length) return;

    const safeHora = (h) => {
      try { return (typeof formatHora12 === 'function' && h) ? formatHora12(h) : (h || ''); }
      catch { return h || ''; }
    };

    const get = (row, keys) => {
      if (!row) return '';
      const n = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const map = new Map(Object.keys(row).map(k => [n(k), k]));
      for (const k of keys) {
        const real = map.get(n(k));
        const v = real ? row[real] : '';
        if (String(v ?? '').trim()) return String(v).trim();
      }
      return '';
    };

    const frag = document.createDocumentFragment();

    turnos.forEach((it) => {
      const name  = get(it, ['nombre','cliente','name']);
      const svc   = get(it, ['servicio','servicio principal','servicio_principal']);
      const hr    = get(it, ['hora','time']);
      const tel   = get(it, ['telefono','tel','phone']);
      const rowId = it?.row || it?.Row || it?._row || '';

      const li = document.createElement('div');
      li.className = 'turno-item';

      const top = document.createElement('div');
      top.className = 'turno-top';

      const elNombre = document.createElement('div');
      elNombre.className = 'turno-name';
      elNombre.textContent = name || '—';

      const elServicio = document.createElement('div');
      elServicio.className = 'turno-service';
      elServicio.textContent = svc || '';

      const elHora = document.createElement('div');
      elHora.className = 'turno-hour';
      elHora.textContent = safeHora(hr);

      top.append(elNombre, elServicio, elHora);
      li.appendChild(top);

      // 👇 Toda la tarjeta abre el MISMO popup que el calendario
      li.addEventListener('click', () => {
        try {
          const reserva = {
            row:      rowId || '',
            nombre:   name || '',
            telefono: tel  || '',
            servicio: svc  || '',
            fecha:    it?.fecha   || '',
            hora:     hr || '',
            adelanto: it?.adelanto || '',
            precio:   it?.precio   || ''
          };

          if (typeof showReservaPopup === 'function') {
            // 🟣 Popup “pro” del calendario (con Editar / Eliminar)
            showReservaPopup(reserva);
          } else {
            // 🔙 Fallback: popup plano (por si algo falla)
            const dataPlano = {
              'Nombre':   reserva.nombre   || '—',
              'Teléfono': reserva.telefono || '—',
              'Servicio': reserva.servicio || '—',
              'Fecha':    reserva.fecha    || '',
              'Hora':     safeHora(reserva.hora),
              'Adelanto': reserva.adelanto || '',
              'Precio':   reserva.precio   || ''
            };

            showFichaToast?.({
              exists: true,
              tipo:   'reserva',
              variant:'ficha',
              data:   dataPlano
            });
          }

        } catch (e) {
          console.error('Click turno hoy error:', e);
          if (typeof toast === 'function') toast('No se pudo abrir el detalle de la reserva.');
        }
      });

      frag.appendChild(li);
    });

    listEl.appendChild(frag);
  } catch (e) {
    console.error('renderTurnosHoy ERROR:', e);
    try {
      if (typeof toast === 'function') toast('No se pudieron mostrar los turnos.');
    } catch {}
  }
}


// 🔄 Refresca TODA la agenda: sección "Hoy" + Calendario
async function refreshAgendaUI() {
  try {
    // 1) Refrescar sección HOY (cumpleaños, prereservas, turnos hoy)
    if (typeof loadRecordatoriosHome === 'function') {
      await loadRecordatoriosHome();
    }

    // 2) Refrescar calendario en el mes visible actual
    if (typeof initOrRenderCalendar === 'function') {
      await initOrRenderCalendar();
    }
  } catch (e) {
    console.error('refreshAgendaUI error:', e);
  }
}









async function fetchRecordatoriosHome() {
  const url = new URL(ENDPOINT);
  url.searchParams.set('tipo', 'Recordatorios');
  // cache-bust para evitar respuestas cacheadas
  url.searchParams.set('_', Date.now().toString());
  if (TOKEN) url.searchParams.set('token', TOKEN);

  let res, text, json = {};
  try {
    res  = await fetch(url.toString());
    text = await res.text();
  } catch (e) {
    console.error('[Recordatorios] Error de red/fetch:', e);
    throw new Error('No se pudo contactar al servidor de Recordatorios');
  }

  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    console.error('[Recordatorios] JSON inválido. Respuesta cruda:', text);
    throw new Error('Respuesta inválida del servidor de Recordatorios');
  }

  // Logs de diagnóstico útiles
  console.log('[Recordatorios] HTTP status:', res.status);
  console.log('[Recordatorios] JSON recibido:', json);

  if (!res.ok || json.ok !== true) {
    const msg = json?.error || `HTTP ${res.status}`;
    console.error('[Recordatorios] Backend devolvió error:', msg);
    throw new Error(msg);
  }

  const payload = json.data || json || {};
  const turnos  = payload.turnos_hoy   || payload.turnos    || payload.reservas || [];
  const cumple  = payload.cumple_hoy   || payload.cumples   || [];
  const preres  = payload.prereservas  || payload.recordatorios || [];

  return { turnos_hoy: turnos, cumple_hoy: cumple, prereservas: preres };
}



  // Estado en memoria fichas
  let fichasState = [];

  // ====== Navegación ======
  function showHome()   {
    setHidden(homeView, false);
    setHidden(fichasView, true);
    setHidden(preReservaView, true);
    setHidden(calendarioView, true); 
    loadRecordatoriosHome();
  }
  function showFichas() {
    setHidden(homeView, true);
    setHidden(fichasView, false);
    setHidden(preReservaView, true);
    setHidden(calendarioView, true); 
    loadFichas();
  }
  function showPreReserva() {
    setHidden(homeView, true);
    setHidden(fichasView, true);
    setHidden(preReservaView, false);
    setHidden(calendarioView, true);
    resetPreReserva();
  }

// ---- NAV: mostrar solo la vista Calendario ----
function showCalendario() {
  // Oculta el resto de vistas
  setHidden(homeView,       true);
  setHidden(fichasView,     true);
  setHidden(preReservaView, true);

  // Muestra calendario
  setHidden(calendarioView, false);

  // Inicializa/pinta el mes visible
  initOrRenderCalendar();
}



/* ===================== CALENDARIO (mensual) ===================== */

// Referencias dentro de la vista de calendario
const calTitle = $('#calTitle');
const calGrid  = $('#calGrid');
const calPrev  = $('#calPrev');
const calNext  = $('#calNext');

// Estado del calendario (año/mes visibles)
const calState = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth() + 1, // 1..12
  inited: false
};

// Utilidades de fecha
function pad2(n) { return String(n).padStart(2, '0'); }
function toISODate(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
function firstWeekdayIndex(y, m) { // Lunes=1..Domingo=7
  const jsDay = new Date(y, m - 1, 1).getDay(); // 0=Dom..6=Sáb
  return jsDay === 0 ? 7 : jsDay;               // ajustamos a L=1
}
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}
const ES_MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];


// Abre detalle de un día: si hay 1 reserva → muestra esa ficha;
// si hay varias → lista todas en un modal.
// Abre detalle de un día: si hay eventos → los muestra inline debajo del calendario
// Abre detalle de un día: muestra eventos clicables debajo del calendario
function openCalendarDayDetail(day, y, m, items) {
  // 🔹 Cachear el último día abierto para poder refrescarlo luego
  window.__CAL_DAY_DETAIL = {
    day,
    year: y,
    month: m
  };

  const reservas    = items?.reservas    || [];
  const prereservas = items?.prereservas || [];
  const cumples     = items?.cumples     || items?.cumple_hoy || [];

  const a12 = (typeof formatHora12 === 'function') ? formatHora12 : null;
  const escape = (s) => String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  // 🔥 NUEVO: Construir HTML de reservas CLICABLES
  const secReservas = reservas.length ? `
    <div class="calgroup">
      <h4>Reservas (${reservas.length})</h4>
      ${reservas.map((r, idx) => {
        const h = a12 ? a12(r.hora) : (r.hora || '');
        return `
          <div class="calitem calitem--reserva calitem--clickable" data-type="reserva" data-index="${idx}" data-row="${r.row || ''}">
            <div class="calitem__time">${escape(h)}</div>
            <div class="calitem__name"><strong>${escape(r.nombre || '')}</strong> · ${escape(r.servicio || '')}</div>
          </div>`;
      }).join('')}
    </div>` : '';

  const secPreRes = prereservas.length ? `
    <div class="calgroup">
      <h4>Pre-reservas (${prereservas.length})</h4>
      ${prereservas.map((p, idx) => {
        const h = a12 ? a12(p.hora) : (p.hora || '');
        return `
          <div class="calitem calitem--prereserva calitem--clickable" data-type="prereserva" data-index="${idx}">
            <div class="calitem__time">${escape(h)}</div>
            <div class="calitem__name"><strong>${escape(p.nombre || '')}</strong> · ${escape(p.servicio || '')}</div>
          </div>`;
      }).join('')}
    </div>` : '';

  const secCumples = cumples.length ? `
    <div class="calgroup">
      <h4>Cumpleaños (${cumples.length})</h4>
      ${cumples.map((c, idx) => {
        return `
          <div class="calitem calitem--cumple calitem--clickable" data-type="cumple" data-index="${idx}">
            <div class="calitem__name">🎂 <strong>${escape(c.nombre || '')}</strong></div>
          </div>`;
      }).join('')}
    </div>` : '';

  const html = `
    <div class="caldaydetail">
      <h3 style="margin:6px 0 8px 0;">${day} ${ES_MONTHS[m - 1]} ${y}</h3>
      ${secReservas}
      ${secPreRes}
      ${secCumples}
      ${!secReservas && !secPreRes && !secCumples ? '<p style="color:var(--muted);text-align:center;padding:20px 0;">Sin eventos este día</p>' : ''}
    </div>`;

  const inline = document.getElementById('calDayInline');
  if (inline) {
    inline.hidden = false;
    inline.innerHTML = html;
    wireCalendarDayClicks(inline, { reservas, prereservas, cumples });
    inline.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (typeof showDetalleModal === 'function') {
    showDetalleModal(`${day} ${ES_MONTHS[m - 1]} ${y}`, html);
    const modalBody = document.querySelector('#detalleModal .modal__body');
    if (modalBody) {
      wireCalendarDayClicks(modalBody, { reservas, prereservas, cumples });
    }
  }
}




// 🔥 NUEVA FUNCIÓN: Cablea los clics en los eventos del detalle del día
function wireCalendarDayClicks(container, data) {
   console.log('🟡 [wireCalendarDayClicks] Datos recibidos:', data);
  if (!container) return;
  
  const { reservas = [], prereservas = [], cumples = [] } = data;
  
  // Buscar todos los items clicables
  const clickableItems = container.querySelectorAll('.calitem--clickable');
  
  clickableItems.forEach(item => {
    item.style.cursor = 'pointer';
    
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const type = item.dataset.type;
      const index = parseInt(item.dataset.index, 10);
      
      // Mostrar popup según el tipo de evento
      if (type === 'reserva' && reservas[index]) {
        showReservaPopup(reservas[index]);
      } else if (type === 'prereserva' && prereservas[index]) {
        showPrereservaPopup(prereservas[index]);
      } else if (type === 'cumple' && cumples[index]) {
        showCumplePopup(cumples[index]);
      }
    });
  });
}

// 🔥 NUEVA FUNCIÓN: Mostrar popup de reserva
// 🔥 POPUP INTERACTIVO: Reserva con botones Editar y Eliminar
// 🔥 POPUP INTERACTIVO: Reserva con botones Editar y Eliminar
function showReservaPopup(reserva) {
  console.log('🔴 [showReservaPopup] Datos recibidos:', reserva);
  const data = {
    'Nombre':   reserva.nombre   || '—',
    'Teléfono': reserva.telefono || '—',
    'Servicio': reserva.servicio || '—',
    'Fecha':    reserva.fecha    || '—',
    'Hora':     (typeof formatHora12 === 'function' && reserva.hora) 
                  ? formatHora12(reserva.hora) 
                  : (reserva.hora || '—'),
    'Adelanto': reserva.adelanto || '—',
    'Precio':   reserva.precio   || '—'
  };
  
  const detailHTML = `
    <div class="event-detail">
      ${Object.entries(data).map(([k, v]) => `
        <div class="event-detail__row">
          <span class="event-detail__label">${escapeHTML(k)}</span>
          <strong class="event-detail__value">${escapeHTML(v)}</strong>
        </div>
      `).join('')}
      
      <div class="event-detail__actions">
        <button type="button" class="btn btn--edit" id="btnEditReserva">
          <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Editar
        </button>
        <button type="button" class="btn btn--ghost btn--delete" id="btnDeleteReserva">
          <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Eliminar
        </button>
      </div>
    </div>
  `;
  
  if (typeof showFichaToast === 'function') {
    showFichaToast({ 
      exists: true, 
      tipo: 'reserva', 
      variant: 'ficha', 
      data,
      title: 'Reserva',
      customHTML: detailHTML
    });
    
    setTimeout(() => {
      const btnEdit = document.getElementById('btnEditReserva');
      const btnDelete = document.getElementById('btnDeleteReserva');
      
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          closeAllToasts();
          editReserva(reserva);
        });
      }
      
      if (btnDelete) {
  btnDelete.addEventListener('click', async () => {
    if (!safeConfirm(`¿Eliminar la reserva de ${reserva.nombre}?`)) return;
    
    btnDelete.disabled = true;
    btnDelete.textContent = 'Eliminando...';
    
        try {
      await apiReservaDelete({
        row:      reserva.row      || '',
        nombre:   reserva.nombre   || '',
        servicio: reserva.servicio || '',
        fecha:    reserva.fecha    || '',
        hora:     reserva.hora     || ''
      });
      
      toast?.('Reserva eliminada correctamente');
      closeAllToasts();
      
      try { await loadRecordatoriosHome?.(); } catch(_) {}
      try { await initOrRenderCalendar?.(); } catch(_) {}
      try { await refreshCalendarDayDetailIfOpen?.(); } catch(_) {}
      
    } catch (e) {
      console.error('Error al eliminar reserva:', e);
      showErrorModal?.('Error al eliminar', String(e).replace('Error:', '').trim());
    } finally {
      btnDelete.disabled = false;
      btnDelete.textContent = 'Eliminar';
    }
  });
}

    }, 100);
  }
}

// 🔥 POPUP INTERACTIVO: Pre-reserva con botones
function showPrereservaPopup(prereserva) {
  const data = {
    'Nombre':   prereserva.nombre   || '—',
    'Teléfono': prereserva.telefono || '—',
    'Servicio': prereserva.servicio || '—',
    'Fecha':    prereserva.fecha    || '—',
    'Hora':     (typeof formatHora12 === 'function' && prereserva.hora) 
                  ? formatHora12(prereserva.hora) 
                  : (prereserva.hora || '—')
  };
  
  const detailHTML = `
    <div class="event-detail">
      ${Object.entries(data).map(([k, v]) => `
        <div class="event-detail__row">
          <span class="event-detail__label">${escapeHTML(k)}</span>
          <strong class="event-detail__value">${escapeHTML(v)}</strong>
        </div>
      `).join('')}
      
      <div class="event-detail__actions">
        <button type="button" class="btn" id="btnConfirmPrereserva">
          <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Confirmar Reserva
        </button>
        <button type="button" class="btn btn--ghost btn--delete" id="btnDeletePrereserva">
          <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Eliminar
        </button>
      </div>
    </div>
  `;
  
  if (typeof showFichaToast === 'function') {
    showFichaToast({ 
      exists: true, 
      tipo: 'prereserva', 
      variant: 'ficha', 
      data,
      title: 'Pre-reserva',
      customHTML: detailHTML
    });
    
    setTimeout(() => {
      const btnConfirm = document.getElementById('btnConfirmPrereserva');
      const btnDelete = document.getElementById('btnDeletePrereserva');
      
      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
          closeAllToasts();
          openReservaForm(prereserva);
        });
      }
      
      if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
          if (!confirm(`¿Eliminar la pre-reserva de ${prereserva.nombre}?`)) return;
          
          btnDelete.disabled = true;
          btnDelete.textContent = 'Eliminando...';
          
          try {
            await apiDeletePreReserva({
              nombre: prereserva.nombre || '',
              telefono: prereserva.telefono || '',
              fecha: prereserva.fecha || '',
              hora: prereserva.hora || ''
            });
            
            toast?.('Pre-reserva eliminada correctamente');
            closeAllToasts();
            
            try { await loadRecordatoriosHome?.(); } catch(_) {}
            try { await initOrRenderCalendar?.(); } catch(_) {}
            
          } catch (e) {
            console.error('Error al eliminar pre-reserva:', e);
            showErrorModal?.('Error al eliminar', String(e).replace('Error:', '').trim());
          } finally {
            btnDelete.disabled = false;
            btnDelete.textContent = 'Eliminar';
          }
        });
      }
    }, 100);
  }
}






// 🔥 NUEVA FUNCIÓN: Mostrar popup de cumpleaños
// 🔥 POPUP INTERACTIVO: Cumpleaños (solo vista, sin edición)
function showCumplePopup(cumple) {
  const data = {
    'Nombre':     cumple.nombre   || '—',
    'Teléfono':   cumple.telefono || '—',
    'Cumpleaños': cumple.cumple   || cumple.fecha || '—'
  };
  
  const detailHTML = `
    <div class="event-detail">
      ${Object.entries(data).map(([k, v]) => `
        <div class="event-detail__row">
          <span class="event-detail__label">${escapeHTML(k)}</span>
          <strong class="event-detail__value">${escapeHTML(v)}</strong>
        </div>
      `).join('')}
      <p style="text-align:center;margin-top:16px;color:var(--muted);font-size:0.9rem;">
        🎉 ¡Feliz cumpleaños!
      </p>
    </div>
  `;
  
  if (typeof showFichaToast === 'function') {
    showFichaToast({ 
      exists: true, 
      tipo: 'cumple', 
      variant: 'ficha', 
      data,
      title: '🎂 Cumpleaños',
      customHTML: detailHTML
    });
  }
}




// 🔥 EDITAR RESERVA: Abre el formulario con datos precargados
function editReserva(reserva) {
  try {
    const formModal   = document.getElementById('reservaModal');
    const reservaForm = document.getElementById('reservaForm');
    
    if (!formModal || !reservaForm) {
      toast?.('No se encontró el formulario de reservas.');
      return;
    }

    // 🔥 CRÍTICO: marcar modo edición en MODAL y en FORM
    const rowSafe = String(reserva.row || '');
    formModal.dataset.mode   = 'edit';
    formModal.dataset.row    = rowSafe;
    reservaForm.dataset.mode = 'edit';
    reservaForm.dataset.row  = rowSafe;

    // Inputs
    const inNombre   = document.getElementById('resNombre');
    const inTelefono = document.getElementById('resTelefono');
    const inServicio = document.getElementById('resServicio');
    const inFecha    = document.getElementById('resFecha');
    const inHora     = document.getElementById('resHora');
    const inAdelanto = document.getElementById('resAdelanto');
    const inPrecio   = document.getElementById('resPrecio');

    // Precargar valores
    if (inNombre)   inNombre.value   = reserva.nombre   || '';
    if (inTelefono) inTelefono.value = reserva.telefono || '';
    if (inServicio) inServicio.value = reserva.servicio || '';
    if (inFecha)    inFecha.value    = reserva.fecha    || '';
    if (inHora)     inHora.value     = to24h(reserva.hora) || reserva.hora || '';
    if (inAdelanto) inAdelanto.value = reserva.adelanto || '';
    if (inPrecio)   inPrecio.value   = reserva.precio   || '';

    // Cambiar texto del botón submit
    const submitBtn = reservaForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      if (!reservaForm.dataset.submitOriginal) {
        reservaForm.dataset.submitOriginal = submitBtn.textContent;
      }
      submitBtn.textContent = 'Guardar cambios';
    }

    // Abrir modal
    openModal?.(formModal);
    inNombre?.focus();

    console.log('✅ Modo edición activado:', {
      modalMode: formModal.dataset.mode,
      modalRow:  formModal.dataset.row,
      formMode:  reservaForm.dataset.mode,
      formRow:   reservaForm.dataset.row,
    });

  } catch (e) {
    console.error('editReserva error:', e);
    toast?.('No se pudo abrir el formulario de edición.');
  }
}


// 🔥 ELIMINAR RESERVA: Borra del sistema y de Sheets
async function deleteReserva(reserva) {
  try {
    const btnRef = event?.target?.closest('button');
    if (btnRef) btnRef.disabled = true;

    await withButtonLoading(btnRef || document.createElement('button'), 'Eliminando', async () => {
      await apiReservaDelete({
        row:      reserva.row      || '',
        nombre:   reserva.nombre   || '',
        servicio: reserva.servicio || '',
        fecha:    reserva.fecha    || '',
        hora:     reserva.hora     || ''
      });
    });

    toast?.('Reserva eliminada correctamente.');
    closeAllToasts();

    // Refrescar vistas
    try { await loadRecordatoriosHome?.(); } catch(_) {}
    try { await initOrRenderCalendar?.(); } catch(_) {}

  } catch (e) {
    console.error('deleteReserva error:', e);
    showErrorModal?.('Error al eliminar', String(e).replace('Error:', '').trim());
  }
}

// 🔥 ELIMINAR PRE-RESERVA: Borra del sistema y de Sheets
async function deletePrereserva(prereserva) {
  try {
    const btnRef = event?.target?.closest('button');
    if (btnRef) btnRef.disabled = true;

    await withButtonLoading(btnRef || document.createElement('button'), 'Eliminando', async () => {
      await apiDeletePreReserva({
        nombre:   prereserva.nombre   || '',
        telefono: prereserva.telefono || '',
        fecha:    prereserva.fecha    || '',
        hora:     prereserva.hora     || ''
      });
    });

    toast?.('Pre-reserva eliminada correctamente.');
    closeAllToasts();

    // Refrescar vistas
    try { await loadRecordatoriosHome?.(); } catch(_) {}
    try { await initOrRenderCalendar?.(); } catch(_) {}

  } catch (e) {
    console.error('deletePrereserva error:', e);
    showErrorModal?.('Error al eliminar', String(e).replace('Error:', '').trim());
  }
}

// 🔥 HELPER: Cerrar todos los toasts abiertos
function closeAllToasts() {
  const toasts = document.querySelectorAll('.toast');
  toasts.forEach(t => {
    if (typeof closeToast === 'function') closeToast(t);
    else t.remove();
  });
}

// 🔥 HELPER: Convertir hora a formato 24h (para el input time)
function to24h(hora) {
  if (!hora) return '';
  const s = String(hora).trim();
  
  // Si ya está en formato HH:MM (24h), devolver
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  // Si tiene AM/PM, convertir
  const match = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  
  return s;
}






// Render del grid mensual (USANDO la estructura que espera tu CSS)
function renderCalendarGrid(y, m, data = { reservas: [], prereservas: [], cumples: [] }) {
  if (!calGrid || !calTitle) return;

  calTitle.textContent = `${ES_MONTHS[m - 1]} ${y}`;
  calGrid.innerHTML = '';

  const totalDays  = daysInMonth(y, m);
  const startIndex = firstWeekdayIndex(y, m); // 1..7 con L=1
  const frag       = document.createDocumentFragment();

  // Indexar datos por día
  const byDay = {};
  const push = (day, type, payload) => {
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ type, ...payload });
  };

  (data.reservas || []).forEach(r => {
    const d = dayFrom(r.fecha, y, m);
    if (d) push(d, 'reserva', r);
  });

  // 👉 indexar pre-reservas
  (data.prereservas || []).forEach(p => {
    const d = dayFrom(p.fecha, y, m);
    if (d) push(d, 'prereserva', p);
  });

  // 👉 indexar cumpleaños (si existen)
  (data.cumples || []).forEach(c => {
    const d = dayFrom(c.fecha, y, m);
    if (d) push(d, 'cumple', c);
  });

  // Huecos antes del día 1
  for (let i = 1; i < startIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar__cell calendar__cell--muted';
    frag.appendChild(empty);
  }

  // Celdas 1..N
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar__cell';

    // Hoy (resaltado suave)
    const today = new Date();
    if (y === today.getFullYear() &&
        m === (today.getMonth() + 1) &&
        day === today.getDate()) {
      cell.classList.add('calendar__cell--today');
    }

    // Cabecera (número del día)
    const head = document.createElement('div');
    head.className = 'calendar__day';
    head.textContent = String(day);

    // Contenedor de items
    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'calendar__items';

    const items = byDay[day] || [];

    // colorear la celda según su contenido
    const hasR = items.some(it => it.type === 'reserva');
    if (hasR) cell.classList.add('calendar__cell--has-reserva');

    const hasPR = items.some(it => it.type === 'prereserva');
    if (hasPR) cell.classList.add('calendar__cell--has-prereserva');

    const hasC = items.some(it => it.type === 'cumple');
    if (hasC) cell.classList.add('calendar__cell--has-cumple');

    // Pintar items usando .calitem (lo que tu CSS estiliza)
    items.forEach(it => {
      if (it.type !== 'reserva' && it.type !== 'prereserva') return;

      const row  = document.createElement('div');
      row.className = `calitem ${it.type === 'reserva' ? 'calitem--reserva' : 'calitem--prereserva'}`;

      const time = document.createElement('div');
      time.className = 'calitem__time';
      const horaText = (typeof formatHora12 === 'function' && it.hora) ? formatHora12(it.hora) : (it.hora || '');
      time.textContent = horaText;

      const name = document.createElement('div');
      name.className = 'calitem__name';
      name.textContent = `${it.nombre || ''} · ${it.servicio || ''}`;

      row.append(time, name);

      // Click sobre el chip individual
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (it.type === 'reserva') {
          const data = {
            'Nombre':   it.nombre   || '—',
            'Teléfono': it.telefono || '—',
            'Servicio': it.servicio || '—',
            'Fecha':    it.fecha    || toISODate(y, m, day),
            'Hora':     (typeof formatHora12 === 'function' && it.hora) ? formatHora12(it.hora) : (it.hora || ''),
            'Adelanto': it.adelanto || '',
            'Precio':   it.precio   || ''
          };
          if (typeof showFichaToast === 'function') {
            showFichaToast({ exists:true, tipo:'reserva', variant:'ficha', data });
          } else if (typeof showDetalleModal === 'function') {
            showDetalleModal('Reserva', kvTable(data));
          } else {
            alert('Reserva:\n' + JSON.stringify(data, null, 2));
          }
        } else {
          // Pre-reserva
          showPreReservaToast(it);
        }
      });

      itemsWrap.appendChild(row);
    });

    // 🔥 CORREGIDO: Click en la celda → separar items por tipo
    if (items.length >= 1) {
      cell.dataset.clickable = '1';
      
      // Función helper para preparar datos
      const prepareDetailData = () => {
        return {
          reservas: items.filter(it => it.type === 'reserva'),
          prereservas: items.filter(it => it.type === 'prereserva'),
          cumples: items.filter(it => it.type === 'cumple')
        };
      };
      
      // Clic sobre el número del día
      head.style.cursor = 'pointer';
      head.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const detailData = prepareDetailData();
        openCalendarDayDetail(day, y, m, detailData);
      });
      
      // Clic en cualquier parte de la celda
      cell.addEventListener('click', () => {
        const detailData = prepareDetailData();
        openCalendarDayDetail(day, y, m, detailData);
      });
    }

    // 🔥 IMPORTANTE: Ensamblar la celda AQUÍ
    cell.append(head, itemsWrap);
    frag.appendChild(cell);
  } // 🔥 CIERRE del bucle for (day)

  // 🔥 Agregar todo al grid
  calGrid.appendChild(frag);
} // 🔥 CIERRE de renderCalendarGrid


// ================== FETCH MES (CORREGIDO) ==================
async function fetchMes(y, m) {
  // --- RESERVAS ---
  const urlR = new URL(ENDPOINT);
  urlR.searchParams.set('tipo', 'Reservas');
  urlR.searchParams.set('page', '1');
  urlR.searchParams.set('limit', '1000');
  if (TOKEN) urlR.searchParams.set('token', TOKEN);
  // 🔥 cache-busting para RESERVAS
  urlR.searchParams.set('_tsR', Date.now().toString());

  let r1 = {};
  try {
    const txt = await fetch(urlR.toString()).then(r => r.text());
    try { r1 = JSON.parse(txt); } catch {}
  } catch (_) {}

  const rawR = Array.isArray(r1?.data) ? r1.data
            : Array.isArray(r1?.items) ? r1.items
            : Array.isArray(r1?.reservas) ? r1.reservas
            : [];

  // Normalizador de claves tolerante a tildes/mayúsculas
  const normKey = (obj, ...opts) => {
    if (!obj) return '';
    const map = new Map(
      Object.keys(obj).map(k => [k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(), k])
    );
    for (const k of opts) {
      const key  = k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const real = map.get(key);
      if (real && String(obj[real] ?? '').trim()) return String(obj[real]).trim();
    }
    return '';
  };

  const reservas = rawR
    .map(r => ({
      row:      normKey(r, 'row','Row','_row','fila','Fila','__row'),
      fecha:    normKey(r, 'fecha', 'Fecha'),
      hora:     normKey(r, 'hora', 'Hora'),
      nombre:   normKey(r, 'nombre', 'Nombre', 'cliente'),
      telefono: normKey(r, 'telefono', 'Teléfono', 'Telefono'),
      servicio: normKey(r, 'servicio', 'Servicio'),
      adelanto: normKey(r, 'adelanto', 'Adelanto'),
      precio:   normKey(r, 'precio', 'Precio')
    }))
    .filter(x => dayFrom(x.fecha, y, m) > 0);

  // --- PRE-RESERVAS (Recordatorios) ---
  const urlPR = new URL(ENDPOINT);
  urlPR.searchParams.set('tipo', 'Recordatorios');
  urlPR.searchParams.set('page', '1');
  urlPR.searchParams.set('limit', '1000');
  if (TOKEN) urlPR.searchParams.set('token', TOKEN);
  // 🔥 cache-busting para PRE-RESERVAS
  urlPR.searchParams.set('_tsPR', Date.now().toString());

  let rPR = {};
  try {
    const txt = await fetch(urlPR.toString()).then(r => r.text());
    try { rPR = JSON.parse(txt); } catch {}
  } catch (_) {}

  const rawPR =
    (Array.isArray(rPR?.data?.prereservas) && rPR.data.prereservas) ? rPR.data.prereservas :
    (Array.isArray(rPR?.prereservas)       && rPR.prereservas)       ? rPR.prereservas       :
    (Array.isArray(rPR?.data)              && rPR.data)              ? rPR.data              :
    (Array.isArray(rPR?.items)             && rPR.items)             ? rPR.items             :
    [];

  const prereservas = rawPR
    .map(p => ({
      fecha:    normKey(p, 'fecha', 'Fecha'),
      hora:     normKey(p, 'hora', 'Hora'),
      nombre:   normKey(p, 'nombre', 'Nombre', 'cliente'),
      telefono: normKey(p, 'telefono', 'Teléfono', 'Telefono'),
      servicio: normKey(p, 'servicio', 'Servicio', 'servicio_principal')
    }))
    .filter(x => dayFrom(x.fecha, y, m) > 0);

  console.log('[fetchMes] reservas:', reservas.length, '| prereservas:', prereservas.length);
  try { console.log('[fetchMes] PR ejemplos:', prereservas.slice(0,3)); } catch {}

  return { reservas, prereservas, cumples: [] };
}
// ================== /FETCH MES ==================



async function refreshCalendarDayDetailIfOpen() {
  const state = window.__CAL_DAY_DETAIL;
  if (!state || !state.day || !state.year || !state.month) return;

  const inline    = document.getElementById('calDayInline');
  const modalBody = document.querySelector('#detalleModal .modal__body');

  const panelVisible =
    (inline && !inline.hidden && inline.innerHTML.trim()) ||
    (modalBody && modalBody.innerHTML.trim());

  if (!panelVisible) return;

  const { day, year, month } = state;

  let dataMes;
  try {
    dataMes = await fetchMes(year, month);
  } catch (e) {
    console.error('[refreshCalendarDayDetailIfOpen] Error al fetchMes:', e);
    return;
  }

  const toIsoDay = (d) =>
    `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const targetIso = toIsoDay(day);

  const reservasDia = (Array.isArray(dataMes?.reservas) ? dataMes.reservas : [])
    .filter(r => String(r.fecha || '').slice(0,10) === targetIso);

  const preresDia = (Array.isArray(dataMes?.prereservas) ? dataMes.prereservas : [])
    .filter(p => String(p.fecha || '').slice(0,10) === targetIso);

  const cumplesDia = (Array.isArray(dataMes?.cumples) ? dataMes.cumples : [])
    .filter(c => String(c.fecha || '').slice(0,10) === targetIso);

  // 🔁 Vuelve a pintar el panel con datos frescos
  openCalendarDayDetail(day, year, month, {
    reservas: reservasDia,
    prereservas: preresDia,
    cumples: cumplesDia
  });
}





// Render del mes actual del estado (si hay endpoint, pinta datos; si no, pinta el grid vacío)
async function renderCalendar(y, m) {
  const data = await fetchMes(y, m).catch(() => ({ reservas:[], prereservas:[], cumples:[] }));
  renderCalendarGrid(y, m, data);
}

// Inicializa una sola vez y pinta
function initOrRenderCalendar() {
  if (!calState.inited) {
    // Navegación de meses
    calPrev?.addEventListener('click', () => {
      calState.month--;
      if (calState.month < 1) { calState.month = 12; calState.year--; }
      renderCalendar(calState.year, calState.month);
    });
    calNext?.addEventListener('click', () => {
      calState.month++;
      if (calState.month > 12) { calState.month = 1; calState.year++; }
      renderCalendar(calState.year, calState.month);
    });
    calState.inited = true;
  }
  renderCalendar(calState.year, calState.month);
}


// ======= PRE-RESERVA (marcadores/const) =======
const preBuscador         = $('#preBuscador');
const preResultadosWrap   = $('#preResultadosWrap');
const preResultados       = $('#preResultados');
const preResultadosEmpty  = $('#preResultadosEmpty');
const preSeleccionadoWrap = $('#preSeleccionadoWrap');
const preSeleccionado     = $('#preSeleccionado');
const preFecha            = $('#preFecha');
const preHora             = $('#preHora');


  let preCliente = null; // { row, nombre, telefono, correo, ... }


  // Borra una RESERVA existente en la hoja "Reservas"
async function apiReservaDelete({ row, nombre, servicio, fecha, hora }) {
  // Normaliza valores críticos para que el backend matchee bien
  const fechaISO = toISODateYMD(fecha || ''); // YYYY-MM-DD
  const hora24   = to24h(hora || '');         // HH:MM

  // 1) Intento principal: borrar por fila (si la tenemos)
  if (row && String(row).trim() !== '') {
    const fd1 = new FormData();
    fd1.set('action', 'delete');
    fd1.set('scope',  'reservas');
    fd1.set('row',    String(row));
    if (TOKEN) fd1.set('token', TOKEN);

    const r1 = await fetch(ENDPOINT, { method:'POST', body: fd1 });
    const t1 = await r1.text();
    let j1={}; try{ j1=JSON.parse(t1);}catch(_){}
    if (r1.ok && j1?.ok === true) return j1;

    // Fallback posible si tu GAS usa otra acción para borrar por fila
    const fd1b = new FormData();
    fd1b.set('action', 'reserva_delete');
    fd1b.set('row',    String(row));
    if (TOKEN) fd1b.set('token', TOKEN);

    const r1b = await fetch(ENDPOINT, { method:'POST', body: fd1b });
    const t1b = await r1b.text();
    let j1b={}; try{ j1b=JSON.parse(t1b);}catch(_){}
    if (r1b.ok && j1b?.ok === true) return j1b;

    // si no funcionó por fila, seguimos con match por campos ↓
  }

  // 2) Fallback: borrar por combinación de campos (nombre/servicio/fecha/hora)
  const fd2 = new FormData();
  fd2.set('action',  'delete');
  fd2.set('scope',   'reservas');
  fd2.set('nombre',  String(nombre||'').trim());
  fd2.set('servicio',String(servicio||'').trim());
  fd2.set('fecha',   fechaISO);
  fd2.set('hora',    hora24);
  if (TOKEN) fd2.set('token', TOKEN);

  const r2 = await fetch(ENDPOINT, { method:'POST', body: fd2 });
  const t2 = await r2.text();
  let j2={}; try{ j2=JSON.parse(t2);}catch(_){}
  if (r2.ok && j2?.ok === true) return j2;

  // 3) Último intento: algunas implementaciones esperan 'reserva_delete' con campos
  const fd3 = new FormData();
  fd3.set('action',  'reserva_delete');
  fd3.set('nombre',  String(nombre||'').trim());
  fd3.set('servicio',String(servicio||'').trim());
  fd3.set('fecha',   fechaISO);
  fd3.set('hora',    hora24);
  if (TOKEN) fd3.set('token', TOKEN);

  const r3 = await fetch(ENDPOINT, { method:'POST', body: fd3 });
  const t3 = await r3.text();
  let j3={}; try{ j3=JSON.parse(t3);}catch(_){}

  if (j3?.ok === true) return j3;

  // Si llegaste aquí, no hubo forma:
  throw new Error((j3?.error || j2?.error || 'No se pudo eliminar la reserva') + ` → ${t3.slice(0,200)}`);
}






  // Guardar Reserva → "Reservas"
  async function apiSaveReserva({ nombre, telefono, servicio, fecha, hora, adelanto, precio }) {
    const fd = new FormData();
    fd.set('action',  'reserva');
    fd.set('nombre',   nombre || '');
    fd.set('telefono', telefono || '');
    fd.set('servicio', servicio || '');
    fd.set('fecha',    fecha || '');
    fd.set('hora',     hora || '');
    fd.set('adelanto', adelanto || '');
    fd.set('precio',   precio || '');
    if (TOKEN) fd.set('token', TOKEN);

    const res  = await fetch(ENDPOINT, { method: 'POST', body: fd });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok || !data.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
    return data;
  }




  // === ACTUALIZAR una reserva existente por fila (Apps Script: action='reserva_update') ===
// === ACTUALIZAR una reserva existente por fila ===
async function apiUpdateReserva({ row, nombre, telefono, servicio, fecha, hora, adelanto, precio }) {
  const fd = new FormData();
  fd.set('action',  'reserva_update');
  fd.set('row',     String(row || ''));

  // Campos
  fd.set('nombre',   nombre   || '');
  fd.set('telefono', telefono || '');
  fd.set('servicio', servicio || '');
  fd.set('fecha',    fecha    || '');
  fd.set('hora',     hora     || '');
  fd.set('adelanto', adelanto || '');
  fd.set('precio',   precio   || '');
  if (TOKEN) fd.set('token', TOKEN);

  console.log('📤 Enviando actualización:', Object.fromEntries(fd));

  const res  = await fetch(ENDPOINT, { method:'POST', body: fd });
  const txt  = await res.text();
  
  console.log('📥 Respuesta del servidor:', txt);
  
  let json = {};
  try { json = JSON.parse(txt); } catch(_) {}
  
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  
  return json;
}











  // Guardar Pre-reserva → "Recordatorios"
// Normaliza para que el backend matchee bien
function _normPre({ nombre, telefono, fecha, hora }) {
  return {
    nombre:   String(nombre||'').trim(),
    telefono: String(telefono||'').trim(),
    fecha:    toISODateYMD(fecha||''), // YYYY-MM-DD
    hora:     to24h(hora||'')          // HH:MM (24h)
  };
}

// Helpers locales (no dependen de nada externo)
const _n = s => (s ?? '').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const _digits = s => (s ?? '').toString().replace(/\D+/g,'');
const _to24h5 = v => (to24h?.(v || '') || '').slice(0,5);   // usa tu to24h existente
const _isoYMD = v => toISODateYMD?.(v || '') || (v || '');   // usa tu toISODateYMD


function safeConfirm(message) {
  try {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
    console.warn('[safeConfirm] confirm() no está disponible en este entorno. Ejecutando sin diálogo.');
    // DEV: si prefieres NO borrar sin diálogo, devuelve false aquí:
    // return false;
    return true;
  } catch (e) {
    console.warn('[safeConfirm] Error llamando a confirm():', e);
    // Mismo criterio: true para seguir, false para bloquear.
    return true;
  }
}


/**
 * Verifica si la pre-reserva existe dentro de `list` (array ya cargado).
 * No hace fetch, no usa `get(...)` inexistente.
 */
  async function verifyPreReservaExists({ nombre, telefono, fecha, hora, list }) {
  // helpers privados (no contaminan global)
  const __n = s => (s ?? '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const __digits = s => (s ?? '').toString().replace(/\D+/g,'');
  const __to24h5 = v => (typeof to24h === 'function' ? to24h(v || '') : (v || '')).slice(0,5);
  const __isoYMD = v => (typeof toISODateYMD === 'function' ? toISODateYMD(v || '') : (v || ''));

  try {
    const arr = Array.isArray(list) ? list : [];
    const want = {
      nombre: __n(nombre),
      tel:    __digits(telefono),
      fecha:  __isoYMD(fecha),
      hora:   __to24h5(hora)
    };

    return arr.some(row => {
      const haveNombre = __n(row.nombre ?? row.cliente ?? '');
      const haveTel    = __digits(row.telefono ?? row['Teléfono'] ?? row.tel ?? '');
      const haveFecha  = __isoYMD(row.fecha ?? row['Fecha'] ?? '');
      const haveHora   = __to24h5(row.hora ?? row['Hora'] ?? '');

      const sameNombre = haveNombre === want.nombre;
      const sameTel    = haveTel && want.tel ? haveTel.endsWith(want.tel.slice(-8)) : true;
      const sameFecha  = haveFecha === want.fecha;
      const sameHora   = (!want.hora || !haveHora) ? true : (haveHora === want.hora);

      return sameNombre && sameTel && sameFecha && sameHora;
    });
  } catch (e) {
    console.warn('[verifyPreReservaExists] error:', e);
    return false;
  }
}



// ✅ NEW – creación alineada con la hoja "Recordatorios"
// ✅ GUARDA COMO PRE-RESERVA
async function apiSavePreReserva_v2({ nombre, telefono, fecha, hora, servicio = '' }) {
  const payload = {
    action:   'prereserva',      // 👈 clave
    nombre:   String(nombre||'').trim(),
    telefono: String(telefono||'').trim(),
    servicio: String(servicio||'').trim(),   // opcional
    fecha:    toISODateYMD(fecha||''),       // YYYY-MM-DD
    hora:     to24h(hora||'')                // HH:MM
  };

  const fd = new FormData();
  Object.entries(payload).forEach(([k,v]) => fd.set(k, v));
  if (TOKEN) fd.set('token', TOKEN);

  const res  = await fetch(ENDPOINT, { method:'POST', body: fd });
  const text = await res.text();
  let data = {}; try { data = JSON.parse(text); } catch(_){}
  if (data?.ok !== true) throw new Error(data?.error || text);
  return data;
}







  // === Helpers de fecha y hora para eliminar pre-reservas correctamente ===
function toISODateYMD(any) {
  const s = String(any || '').trim();
  if (!s) return '';
  // 1️⃣ Detectar formato YYYY-MM-DD
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  // 2️⃣ Detectar formato DD/MM/YYYY o DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  // 3️⃣ Intentar parsear automáticamente
  const d = new Date(s);
  if (!isNaN(d)) {
    const Y = d.getFullYear(), M = d.getMonth() + 1, D = d.getDate();
    return `${Y}-${String(M).padStart(2,'0')}-${String(D).padStart(2,'0')}`;
  }
  return s; // si no se reconoce, se devuelve igual
}

function to24h(hhmm) {
  const s = String(hhmm || '').trim();
  if (!s) return '';
  // 1️⃣ Formato con AM/PM
  let m = s.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    const pm = /p/i.test(m[3]);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
  }
  // 2️⃣ Formato 24h tipo 10:30 o 10:30:00
  m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${String(m[1]).padStart(2,'0')}:${m[2]}`;
  // 3️⃣ Hora numérica (por ejemplo, fracción de día en Sheets)
  const f = parseFloat(s);
  if (!isNaN(f) && f >= 0 && f < 1) {
    const total = Math.round(f * 24 * 60);
    const h = Math.floor(total / 60) % 24;
    const mi = total % 60;
    return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
  }
  return s;
}




// Eliminar una pre-reserva (recordatorio) por nombre+tel+fecha+hora
// Eliminar una pre-reserva (recordatorio) por nombre+tel+fecha+hora
async function apiDeletePreReserva({ row, nombre, telefono, fecha, hora }) {
  const payload = {
    action: 'delete',
    scope:  'recordatorios'
  };

  // 🔹 Si tenemos row válido, lo usamos como vía principal
  if (row && String(row).trim() !== '') {
    payload.row = String(row).trim();
  }

  // 🔹 Normalizar nombre y teléfono
  payload.nombre   = String(nombre || '').trim();
  payload.telefono = String(telefono || '').trim();

  // 🔹 Normalizar fecha a YYYY-MM-DD
  payload.fecha = toISODateYMD(fecha || '');

  // 🔹 Normalizar hora a HH:MM (24h)
  let horaNorm = to24h(hora || '');

  // 💥 Parche crítico:
  // Si la hora NO queda en formato HH:MM (por ejemplo, es un "Sat Dec 30 1899 14:00:00 ..."),
  // no la enviamos, para que el backend NO filtre por hora.
  if (!/^\d{2}:\d{2}$/.test(horaNorm)) {
    horaNorm = '';
  }
  payload.hora = horaNorm;

  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => fd.set(k, v));
  if (TOKEN) fd.set('token', TOKEN);

  console.log('[DELETE Recordatorio] ->', Object.fromEntries(fd.entries()));

  const res  = await fetch(ENDPOINT, { method: 'POST', body: fd });
  const text = await res.text();
  let data   = {};
  try { data = JSON.parse(text); } catch (_) {}

  console.log('[DELETE Recordatorio] <- status:', res.status, 'body:', text);

  if (data?.ok !== true) {
    const msg = data?.error || `Respuesta no OK del servidor (status ${res.status}): ${text.slice(0,300)}`;
    throw new Error(msg);
  }
  return data;
}








  // Buscar clientes con ficha (por tipo actual)
// 🔥 NUEVA VERSIÓN: Busca clientes en AMBAS hojas (Pestañas Y Facial)
async function fetchClientesConFicha(query) {
  if (!query || !query.trim()) return [];
  
  const q = query.toLowerCase().trim();
  
  try {
    // Buscar en ambas hojas en paralelo
    const [resultPestanas, resultFacial] = await Promise.all([
      fetchFromSheet('Pestañas'),
      fetchFromSheet('Faciales')
    ]);
    
    // Combinar resultados y eliminar duplicados por teléfono
    const combined = [...resultPestanas, ...resultFacial];
    const seen = new Set();
    const unique = combined.filter(item => {
      const tel = String(item.telefono || '').trim();
      if (!tel || seen.has(tel)) return false;
      seen.add(tel);
      return true;
    });
    
    // Filtrar por query
    const filtered = unique.filter(r => {
      const n = String(r.nombre || '').toLowerCase();
      const t = String(r.telefono || '').toLowerCase();
      return n.includes(q) || t.includes(q);
    });
    
    return filtered.slice(0, 10);
    
  } catch (err) {
    console.error('Error buscando clientes:', err);
    return [];
  }
}

// Helper: busca en una hoja específica
async function fetchFromSheet(tipo) {
  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set('tipo', tipo);
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', '500');
    url.searchParams.set('_', Date.now());
    if (TOKEN) url.searchParams.set('token', TOKEN);
    
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok || !data.ok) return [];
    
    const rows = Array.isArray(data.data) ? data.data : 
                 Array.isArray(data.items) ? data.items : 
                 Array.isArray(data.rows) ? data.rows : [];
    
    // Agregar el tipo de hoja a cada resultado
    return rows.map(r => ({ ...r, _tipo: tipo }));
    
  } catch (err) {
    console.error(`Error fetching ${tipo}:`, err);
    return [];
  }
}

  function renderResultados(items){
  preResultados.innerHTML = '';
  if (!items.length){
    setHidden(preResultadosEmpty, false);
    return;
  }
  setHidden(preResultadosEmpty, true);

  const frag = document.createDocumentFragment();
  items.forEach(it => {
    const li = document.createElement('div');
    li.className = 'list__item';
    const c1 = document.createElement('div'); c1.textContent = '👤';
    const c2 = document.createElement('div');
    c2.className = 'list__main';
    const t1 = document.createElement('div'); 
    t1.className='list__title'; 
    t1.textContent = it.nombre || '';
    
    const t2 = document.createElement('div'); 
    t2.className='list__meta';
    // 🔥 NUEVO: Muestra teléfono + tipo de ficha
    const tipoFicha = it._tipo ? ` • ${it._tipo}` : '';
    t2.textContent = (it.telefono || '') + tipoFicha;
    
    c2.append(t1,t2);
    const c3 = document.createElement('div');
    const btn = document.createElement('button');
    btn.className = 'btn btn--ghost';
    btn.textContent = 'Seleccionar';
    btn.addEventListener('click', () => seleccionarCliente(it));
    c3.appendChild(btn);
    li.append(c1,c2,c3);
    frag.appendChild(li);
  });
  preResultados.appendChild(frag);
}

  function seleccionarCliente(c){
    preCliente = c;
    preSeleccionado.textContent = `${c.nombre} · ${c.telefono || ''}`;
    setHidden(preSeleccionadoWrap, false);
    preResultados.innerHTML = '';
    setHidden(preResultadosWrap, true);
    preBuscador.value = '';
    validarPreReserva();
  }

  function resetPreReserva(){
    preCliente = null;
    if (preBuscador) preBuscador.value = '';
    if (preFecha) preFecha.value = '';
    if (preHora)  preHora.value = '';
    setHidden(preResultadosWrap, true);
    setHidden(preResultadosEmpty, true);
    preResultados.innerHTML = '';
    setHidden(preSeleccionadoWrap, true);
    if (preGuardar) preGuardar.disabled = true;
  }

  function validarPreReserva(){
    const ok = !!(preCliente && preFecha?.value && preHora?.value);
    if (preGuardar) preGuardar.disabled = !ok;
  }

  // Eventos Pre-reserva
  if (btnPreReserva) btnPreReserva.addEventListener('click', showPreReserva);

  if (btnCalendario) btnCalendario.addEventListener('click', showCalendario);


  if (preBuscador){
    let t;
    preBuscador.addEventListener('input', async (e) => {
      const val = e.target.value;
      preCliente = null;
      setHidden(preSeleccionadoWrap, true);
      clearTimeout(t);
      if (!val.trim()){
        setHidden(preResultadosWrap, true);
        preResultados.innerHTML = '';
        return;
      }
      t = setTimeout(async () => {
        const items = await fetchClientesConFicha(val);
        setHidden(preResultadosWrap, false);
        renderResultados(items);
      }, 200);
    });
  }

  if (preFecha) preFecha.addEventListener('change', validarPreReserva);
  if (preHora)  preHora.addEventListener('change', validarPreReserva);

  if (preCancelar) preCancelar.addEventListener('click', () => {
    showHome();
  });

 // ====== Guardar Pre-reserva ======
if (preGuardar) {
  preGuardar.addEventListener('click', async () => {
    // Evita dobles clics
    if (preGuardar.disabled) return;

    // 1) Validación fuerte
    if (!preCliente) { toast?.('Selecciona un cliente de la lista.'); return; }
    const fechaVal = preFecha?.value?.trim();
    const horaVal = to24h(preHora.value || '');
    if (!fechaVal || !horaVal) { toast?.('Completa Fecha y Hora.'); return; }

    const nombre   = preCliente?.nombre   ?? '';
    const telefono = preCliente?.telefono ?? '';

    try {
      preGuardar.disabled = true;

      // 2) Guardar en hoja Recordatorios (alineado con delete)
     // 2) Guardar en hoja Recordatorios
     // 2) Guardar
await apiSavePreReserva_v2({ nombre, telefono, fecha: fechaVal, hora: horaVal });

// 3) Verificar SOLO si puedes leer la lista actualizada
let verified = false;
try {
  // Latencia GAS: espera breve
  await new Promise(r => setTimeout(r, 350));

  // Primer intento con la función que AHORA sí retorna datos
  const rec = await loadRecordatoriosHome();
  const list = rec?.prereservas
             ?? window.__REC_CACHE?.prereservas
             ?? [];

  verified = await verifyPreReservaExists({
    nombre, telefono, fecha: fechaVal, hora: horaVal, list
  });

  // Segundo intento: lectura directa (cache-bust)
  if (!verified) {
    const rec2 = await apiGetRecordatorios();
    verified = await verifyPreReservaExists({
      nombre, telefono, fecha: fechaVal, hora: horaVal, list: rec2.prereservas
    });
  }
} catch (e) {
  console.warn('verifyPreReservaExists fallback:', e);
}

// Si aun así no aparece, evita el modal ruidoso (latencia/snapshot viejo)
if (!verified) {
  console.warn('[PRERESERVA] Guardado OK pero no apareció en la lectura inmediata (posible latencia).');
}



      // 4) Feedback visual + volver al Home + refrescar
      showReservationToast?.({
        titulo:  'Pre-reserva guardada',
        cliente: nombre,
        fecha:   fechaVal,
        hora:    horaVal
      });

      resetPreReserva?.();
      showHome?.();

      try { await loadRecordatoriosHome?.(); } catch(_) {}
      try { await initOrRenderCalendar?.(); } catch(_) {}

    } catch (err) {
      console.error(err);
      showErrorModal?.(
        'No se pudo guardar la pre-reserva',
        String(err).replace('Error:', '').trim()
      );
    } finally {
      preGuardar.disabled = false;
    }
  });
}

// ====== Navegación secundaria ======
if (btnFicha) btnFicha.addEventListener('click', showFichas);

// Botón Hoy
if (btnHoy) {
  btnHoy.addEventListener('click', () => {
    showHome?.();
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const hoyHeading = document.getElementById('hoyHeading');
      hoyHeading?.focus?.();
    } catch(_) {}
  });
}


  // ===== Helpers de carga (asegúrate de tenerlos definidos antes) =====
// startBtnEllipsis(...) y withButtonLoading(...) aquí arriba

// ====== BOTÓN REFRESCAR (ÚNICO LISTENER + ANIMACIÓN) ======
// ====== BOTÓN REFRESCAR (sin animación de puntos) ======
(function setupBtnRefrescar(){
  const btnRefrescar = document.getElementById('btnRefrescar');
  if (!btnRefrescar) return;

  async function refreshAll(){
    // Refresca TODAS las secciones visibles
    try {
      await loadRecordatoriosHome();
    } catch(e) {
      console.error('Error en recordatorios:', e);
    }
    
    // Si estás en la vista de calendario, también refresca el calendario
    try {
      const calView = document.getElementById('calendarioView');
      if (calView && !calView.hidden) {
        await initOrRenderCalendar();
      }
    } catch(e) {
      console.error('Error en calendario:', e);
    }
  }

  btnRefrescar.addEventListener('click', async () => {
    if (btnRefrescar.disabled) return; // Evita doble clic
    
    // Deshabilita el botón visualmente
    btnRefrescar.disabled = true;
    btnRefrescar.style.opacity = '0.6';
    btnRefrescar.style.cursor = 'not-allowed';
    
    try {
      await refreshAll();
      toast?.('Datos actualizados correctamente');
    } catch(e) {
      console.error('Error al actualizar:', e);
      toast?.('Error al actualizar los datos');
    } finally {
      // Rehabilita el botón
      btnRefrescar.disabled = false;
      btnRefrescar.style.opacity = '1';
      btnRefrescar.style.cursor = 'pointer';
    }
  });
})();


// Activa/desactiva visualmente los botones del toggle (y su aria-pressed)
function updateTipoToggleUI(selected) {
  if (!tipoToggle) return;
  const btns = tipoToggle.querySelectorAll('.toggle__btn');
  btns.forEach((btn) => {
    const isActive = (btn.getAttribute('data-type') === selected);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}




  // Toggle Tipo (Pestañas / Faciales)
  function applyType(type) {
  // Normaliza el tipo
  currentType = (type === 'Faciales') ? 'Faciales' : 'Pestañas';

  // Refresca UI del toggle
  updateTipoToggleUI(currentType);

  // Muestra el form correcto en el modal de ficha
  if (formPestanas && formFaciales) {
    formPestanas.hidden = currentType !== 'Pestañas';
    formFaciales.hidden = currentType !== 'Faciales';
  }
}


// Listener ÚNICO para el toggle (Pestañas / Faciales)
(function wireTipoToggle(){
  if (!tipoToggle || tipoToggle.dataset.wired === '1') return;
  tipoToggle.dataset.wired = '1';

  tipoToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle__btn');
    if (!btn) return;

    const nextType = btn.getAttribute('data-type') || 'Pestañas';
    if (nextType === currentType) return;  // nada que hacer

    applyType(nextType);  // cambia el tipo + UI
    loadFichas();         // recarga SIEMPRE el listado del tipo seleccionado
  });
})();


 // Envío del formulario de Reserva
if (reservaForm) {
  reservaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      nombre:   resNombre?.value.trim()   || '',
      telefono: resTelefono?.value.trim() || '',
      servicio: resServicio?.value        || '',
      fecha:    resFecha?.value           || '',
      hora:     resHora?.value            || '',
      adelanto: resAdelanto?.value        || '',
      precio:   resPrecio?.value          || ''
    };

    // Validación
    if (!payload.nombre || !payload.servicio || !payload.fecha || !payload.hora) {
      toast('Faltan datos obligatorios (Nombre, Servicio, Fecha, Hora).');
      return;
    }

    const submitBtn = reservaForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // 🔥 DETECTAR MODO EDICIÓN
      const isEditMode = reservaForm && reservaForm.dataset.mode === 'edit';
      const rowId      = reservaForm ? (reservaForm.dataset.row || '') : '';

      if (isEditMode && rowId) {
  // 🔥 MODO EDICIÓN: Actualizar reserva existente
  console.log('🔄 Actualizando reserva en fila:', rowId);
  
  await apiUpdateReserva({ 
    row: rowId, 
    ...payload 
  });
  
  toast?.('Reserva actualizada correctamente.');

  // 🟣 NUEVO: mostrar popup con los datos recién guardados
  if (typeof showReservaPopup === 'function') {
    showReservaPopup({
      row: rowId,
      ...payload
    });
  }

  // Limpiar modo edición
  delete reservaForm.dataset.mode;
  delete reservaForm.dataset.row;

} else {
  // 🔥 MODO CREAR: Nueva reserva
  console.log('✨ Creando nueva reserva');
  
  await apiSaveReserva(payload);
  toast?.('Reserva creada correctamente.');
}


      // Mostrar notificación visual
      showReservationToast({
        titulo: isEditMode ? 'Reserva actualizada' : 'Reserva guardada',
        cliente: payload.nombre,
        fecha: payload.fecha,
        hora: payload.hora,
        servicio: payload.servicio
      });

      // Resetear formulario
      reservaForm.reset();
      clearReservaCta?.();
      
      // Restaurar texto del botón
      if (submitBtn && reservaForm.dataset.submitOriginal) {
        submitBtn.textContent = reservaForm.dataset.submitOriginal;
        delete reservaForm.dataset.submitOriginal;
      }
      
      // Cerrar modal
      closeModal(reservaModal);
      btnCrear?.focus();
      
      // Refrescar vistas
      try { await loadRecordatoriosHome?.(); } catch(_) {}
      try { await initOrRenderCalendar?.(); } catch(_) {}

    } catch (err) {
      console.error('Error al guardar reserva:', err);
      showErrorModal?.('No se pudo guardar la reserva', String(err).replace('Error:', '').trim());
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

  /// Estado inicial
applyType(currentType); // Pestañas o Faciales según tu estado

// Listener ÚNICO para el toggle (Pestañas / Faciales)
(function wireTipoToggle(){
  const el = document.getElementById('tipoToggle');
  if (!el || el.dataset.wired === '1') return; // evita duplicar
  el.dataset.wired = '1';

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle__btn');
    if (!btn || !el.contains(btn)) return;

    // Normaliza el tipo
    const next = btn.getAttribute('data-type') === 'Faciales' ? 'Faciales' : 'Pestañas';
    if (next === currentType) return;

    applyType(next);   // cambia UI y formularios
    loadFichas?.();    // recarga listado para el tipo seleccionado
  });
})();


  // Modal Crear Ficha
  function abrirModalFicha() {
    applyType(currentType);
    openModal(fichaModal);

    const first = (currentType === 'Pestañas'
      ? formPestanas?.querySelector('input[name="nombre"]')
      : formFaciales?.querySelector('input[name="nombre"]'));
    if (first) first.focus();
  }

  if (btnCrearFicha) btnCrearFicha.addEventListener('click', abrirModalFicha);

  if (fichaModal) {
    fichaModal.addEventListener('click', (e) => {
      const t = e.target;
      if (t instanceof Element && t.hasAttribute('data-close')) closeModal(fichaModal);
    });
  }


function fillFormValues(form, data){
  if (!form || !data) return;

  // Normaliza strings (sin tildes, minúsculas, sin espacios extra)
  const norm = (s) => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();

  // Mapa normalizado de claves que viene del backend
  const dataNormMap = new Map(
    Object.entries(data).map(([k, v]) => [norm(k), v])
  );

  // Busca un valor en data probando varias claves posibles
  const findVal = (...keys) => {
    for (const k of keys) {
      if (!k) continue;
      // 1) prueba directa
      if (Object.prototype.hasOwnProperty.call(data, k) && data[k] != null && String(data[k]).trim() !== '') {
        return data[k];
      }
      // 2) prueba normalizada
      const nk = norm(k);
      if (dataNormMap.has(nk)) {
        const v = dataNormMap.get(nk);
        if (v != null && String(v).trim() !== '') return v;
      }
    }
    return '';
  };

  // Helper para setear un campo del form (input / textarea / select / checkbox simple)
  const set = (name, ...candidateKeys) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return;

    const raw = findVal(name, ...candidateKeys);
    if (raw == null || String(raw).trim() === '') {
      // Limpia si no hay dato
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        // no tocamos radios/checkbox sin dato claro
      } else {
        el.value = '';
      }
      return;
    }

    let value = String(raw).trim();

    // 📅 INPUT TYPE="DATE" → dd/MM/yyyy o ISO → yyyy-MM-dd
    if (el.type === 'date') {
      if (!value) {
        el.value = '';
        return;
      }
      let iso = value;
      // si viene como 31/12/2025
      const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        iso = `${m[3]}-${m[2]}-${m[1]}`; // 2025-12-31
      }
      el.value = iso;
      return;
    }

    // 🔽 SELECT: buscar por value o por texto visible
    if (el.tagName === 'SELECT') {
      const target = norm(value);
      let matched = false;

      for (const opt of Array.from(el.options)) {
        const vNorm = norm(opt.value);
        const tNorm = norm(opt.textContent || '');
        if (vNorm === target || tNorm === target) {
          opt.selected = true;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // último intento directo
        el.value = value;
      }
      return;
    }

    // 🔘 RADIO
    if (el.type === 'radio') {
      const radios = form.querySelectorAll(`input[type="radio"][name="${name}"]`);
      const target = norm(value);
      radios.forEach(r => {
        r.checked = (norm(r.value) === target);
      });
      return;
    }

    // ☑️ CHECKBOX booleano (sí/no)
    if (el.type === 'checkbox') {
      const vNorm = norm(value);
      el.checked = (vNorm === 'true' || vNorm === '1' || vNorm === 'si' || vNorm === 'sí');
      return;
    }

    // 📝 Inputs / textarea normales
    el.value = value;
  };

  // 🧩 CAMPOS COMUNES
  set('nombre',   'Nombre', 'cliente');
  set('telefono', 'Teléfono','Telefono','tel','phone');
  set('correo',   'Correo','Email','email');
  set('cumple',   'cumple','cumpleaños','Cumpleaños','Cumpleanos','fecha_nacimiento');
  set('notas',    'notas','Notas','nota');

  // 👁‍🗨 FICHA PESTAÑAS
  // HTML usa name="grosor" y name="medida", el backend manda grosor_mm / medida_mm
  set('alergias', 'alergias','Alergias');

  // Antes usábamos 'grosor_mm' y 'medida_mm' como name: ahora correcto
  set('grosor',   'grosor','grosor_mm','Grosor (mm)','Grosor');
  set('medida',   'medida','medida_mm','Medida (mm)','Medida');

  set('forma_ojos',  'forma_ojos','Forma de ojos','Forma ojos');
  set('tipo_diseno', 'tipo_diseno','Tipo de diseño','Tipo de diseno','diseño','diseno');

  // 💆‍♀️ FICHA FACIAL

  // Edad (input number)
  set('edad', 'edad','Edad');

  // Género (select)
  set('genero', 'genero','Genero','Género');

  // Motivo de consulta
  // 🔴 OJO: en el formulario el name es "motivo_consulta" (sin "_de")
  // pero en la hoja la cabecera es "Motivo de consulta".
  set('motivo_consulta', 'motivo_consulta','motivo_de_consulta','Motivo de consulta');

  // Tipo de limpieza
  // 🔴 Igual: name="tipo_limpieza" en el form, cabecera "Tipo de limpieza" en la hoja.
  set('tipo_limpieza', 'tipo_limpieza','tipo_de_limpieza','Tipo de limpieza');

  // Procedimiento
  set('procedimiento', 'procedimiento','Procedimiento');

  // Manchas (selección múltiple con checkboxes: name="manchas[]")
  (function(){
    const raw = findVal('manchas','Manchas');
    if (!raw) return;

    const valNorm = norm(String(raw));
    const checks = form.querySelectorAll('input[type="checkbox"][name="manchas[]"]');
    if (!checks.length) return;

    checks.forEach(chk => {
      const cVal = norm(chk.value);
      // Marcamos si el valor del checkbox aparece en el texto guardado
      chk.checked = valNorm.includes(cVal);
    });
  })();
}










function openEditFicha(item, tipo){
  // Selecciona el tipo correcto y abre el modal
  applyType(tipo);
  openModal(fichaModal);

  // 👇 Normalizamos el tipo para evitar problemas entre 'Facial' / 'Faciales'
  const t = String(tipo || '').toLowerCase();
  const isFacial = (t === 'faciales' || t === 'facial');
  const form = isFacial ? formFaciales : formPestanas;

  // Marca modo edición + guarda fila
  form.dataset.mode = 'edit';
  form.dataset.row  = String(item.row || '');

  // Cambia texto del botón submit mientras editas
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    form.dataset.submitOriginal = submitBtn.textContent || 'Guardar';
    submitBtn.textContent = 'Guardar cambios';
  }

  // 🔎 (opcional pero útil para comprobar qué llega)
  // console.log('[EDIT FICHA]', tipo, item);

  // Precarga campos
  fillFormValues(form, item);

  // Foco
  const first = form.querySelector('input[name="nombre"]') || form.querySelector('input,select,textarea');
  first?.focus();
}




  // Modal Crear Reserva
  // Modal Crear Reserva (LIMPIA cualquier modo edición previo)
function abrirModalReserva() {
  if (!reservaModal || !reservaForm) return;
  
  // 🔥 Limpiar cualquier modo edición previo
  delete reservaModal.dataset.mode;
  delete reservaModal.dataset.row;
  
  // Resetear formulario
  reservaForm.reset();
  
  // Restaurar texto del botón
  const submitBtn = reservaForm.querySelector('button[type="submit"]');
  if (submitBtn && reservaForm.dataset.submitOriginal) {
    submitBtn.textContent = reservaForm.dataset.submitOriginal;
    delete reservaForm.dataset.submitOriginal;
  }
  
  openModal(reservaModal);
  ensureReservaCta?.();
  clearReservaCta?.();
  
  const resNombre = document.getElementById('resNombre');
  resNombre?.focus();
  
  try { maybeUpdateReservaCTA?.(); } catch(_) {}
}


  if (reservaModal) {
  reservaModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof Element && t.hasAttribute('data-close')) {
      // 🔥 Limpiar modo edición al cerrar
      delete reservaModal.dataset.mode;
      delete reservaModal.dataset.row;
      
      reservaForm?.reset();
      clearReservaCta?.();
      
      // Restaurar texto del botón
      const submitBtn = reservaForm?.querySelector('button[type="submit"]');
      if (submitBtn && reservaForm?.dataset.submitOriginal) {
        submitBtn.textContent = reservaForm.dataset.submitOriginal;
        delete reservaForm.dataset.submitOriginal;
      }
      
      closeModal(reservaModal);
      btnCrear?.focus();
    }
  });
}

  if (formPestanas) {
    formPestanas.addEventListener('submit', (e) => {
      e.preventDefault();
      submitFicha(formPestanas, 'Pestañas');
    });
  }
  if (formFaciales) {
    formFaciales.addEventListener('submit', (e) => {
      e.preventDefault();
      submitFicha(formFaciales, 'Faciales');
    });
  }

  // ====== CTA “Ver/Crear ficha técnica” en Reserva ======
// ====== CTA "Ver/Crear ficha técnica" en Reserva ======
async function apiFichaMatch({ servicio, nombre, telefono }) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('tipo', 'ficha_match');
  url.searchParams.set('servicio', (servicio || '').trim());
  url.searchParams.set('nombre', (nombre || '').trim());
  if (telefono) url.searchParams.set('telefono', (telefono || '').trim());
  if (TOKEN)    url.searchParams.set('token', TOKEN);

  console.log('[apiFichaMatch] Consultando:', {
    servicio,
    nombre,
    telefono
  });

  try {
    const r     = await fetch(url.toString(), { method: 'GET' });
    const text  = await r.text();

    console.log('[apiFichaMatch] Respuesta raw:', text);

    let data = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[apiFichaMatch] Error parseando JSON:', e);
      throw new Error('Respuesta inválida del servidor');
    }

    // 👇 IMPORTANTE: NO usar JSON.stringify aquí
    console.log('[apiFichaMatch] Respuesta parseada (objeto):', data);

    if (!r.ok || data?.ok === false) {
      console.warn('[apiFichaMatch] Error en respuesta:', r.status, data);
      throw new Error(data?.error || `HTTP ${r.status}`);
    }

    // devolvemos el objeto tal cual, con pestanas/facial/etc
    return data;
  } catch (error) {
    console.error('[apiFichaMatch] Error completo:', error);
    throw error;
  }
}

function normalizeFichaDataForToast(ficha, servicioNorm) {
  const raw = ficha?.data || ficha || {};
  const out = {};

  // Intentamos detectar por tipo de hoja
  const tipoHoja = String(ficha?.tipo || ficha?.sheet || '').toLowerCase();
  const isPestanas = /pesta/.test(tipoHoja) || /pesta/.test(servicioNorm);
  const isFacial   = /facial/.test(tipoHoja) || /facial/.test(servicioNorm);

  // Helper para leer campos con tolerancia
  const get = (obj, ...candidatos) => {
    if (!obj) return '';
    const norm = s => String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .trim();

    const map = new Map(
      Object.keys(obj).map(k => [norm(k), k])
    );

    for (const c of candidatos) {
      const real = map.get(norm(c));
      if (real && String(obj[real] ?? '').trim() !== '') {
        return obj[real];
      }
    }
    return '';
  };

  // Formateo sencillo de fechas (igual que el backend)
  const fmtFecha = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleDateString('es-ES', { year:'numeric', month:'2-digit', day:'2-digit' });
  };

  // 🟣 PESTAÑAS → replicamos el shape del endpoint de listado FT.Pestañas
  if (isPestanas) {
    out.row        = ficha.rowIndex || ficha.row || null;
    out.nombre     = get(raw, 'Nombre', 'nombre', 'Cliente');
    out.telefono   = get(raw, 'Teléfono', 'Telefono', 'telefono', 'tel');
    out.correo     = get(raw, 'Correo', 'correo', 'email');
    out.cumple     = fmtFecha(get(raw, 'Cumpleaños', 'Cumpleanos', 'cumple'));
    out.alergias   = get(raw, 'Alergias', 'alergias');
    out.grosor_mm  = get(raw, 'Grosor (mm)', 'grosor_mm', 'grosor');
    out.medida_mm  = get(raw, 'Medida (mm)', 'medida_mm', 'medida');
    out.forma_ojos = get(raw, 'Forma de ojos', 'forma_ojos');
    out.tipo_diseno= get(raw, 'Tipo de diseño', 'tipo_diseno', 'diseño');
    out.notas      = get(raw, 'Notas', 'notas');
    out.creado_en  = fmtFecha(get(raw, 'Fecha de creación', 'Fecha de creacion', 'creado_en'));
    return out;
  }

  // 🟣 FACIAL → replicamos el shape del endpoint de listado FT.Facial
  if (isFacial) {
    out.row                = ficha.rowIndex || ficha.row || null;
    out.nombre             = get(raw, 'Nombre', 'nombre', 'Cliente');
    out.telefono           = get(raw, 'Teléfono', 'Telefono', 'telefono', 'tel');
    out.correo             = get(raw, 'Correo', 'correo', 'email');
    out.cumple             = fmtFecha(get(raw, 'Cumpleaños', 'Cumpleanos', 'cumple'));
    out.genero             = get(raw, 'Genero', 'Género');
    out.motivo_de_consulta = get(raw, 'Motivo de consulta');
    out.manchas            = get(raw, 'Manchas');
    out.tipo_de_limpieza   = get(raw, 'Tipo de limpieza');
    out.procedimiento      = get(raw, 'Procedimiento');
    out.notas              = get(raw, 'Notas', 'notas');
    out.creado_en          = fmtFecha(get(raw, 'Fecha de creación', 'Fecha de creacion', 'creado_en'));
    return out;
  }

  // Fallback por si el tipo es raro → devolvemos tal cual
  return raw;
}



//Funcion que hace la busqueda por servicios de ficha tecnica//
function renderReservaCTA(match, ctx) {
  const cta = ensureReservaCta();
  if (!cta) return;
  cta.innerHTML = '';

  const m = match || {};
  const servicioRaw  = String(ctx?.servicio || '');
  const servicioNorm = servicioRaw.toLowerCase();

  console.log('[renderReservaCTA] Contexto servicio:', servicioRaw);
  console.log('[renderReservaCTA] Match recibido:', m);

  // Helper para interpretar "exists"
  const hasExists = (obj) => !!(
    obj &&
    (obj.exists === true ||
     obj.exists === 'true' ||
     obj.exists === 1 ||
     obj.exists === '1')
  );

  let fichaToUse = null;

  // 1) Priorizar según el servicio del formulario
  if (/facial/.test(servicioNorm) && hasExists(m.facial)) {
    console.log('[renderReservaCTA] ✅ Usando ficha FACIAL (por servicio)');
    fichaToUse = m.facial;
  }

  if (!fichaToUse && /pesta/.test(servicioNorm) && hasExists(m.pestanas)) {
    console.log('[renderReservaCTA] ✅ Usando ficha PESTAÑAS (por servicio)');
    fichaToUse = m.pestanas;
  }

  // 2) Fallback: si el backend marcó el main como existente
  if (!fichaToUse && hasExists(m)) {
    console.log('[renderReservaCTA] ✅ Usando ficha MAIN (top-level exists)');
    fichaToUse = m;
  }

  // 3) Fallback extra: si hay exactamente UNA ficha existente en pestanas/facial, úsala
  if (!fichaToUse) {
    const candidatos = [];
    if (hasExists(m.pestanas)) candidatos.push(m.pestanas);
    if (hasExists(m.facial))   candidatos.push(m.facial);

    if (candidatos.length === 1) {
      console.log('[renderReservaCTA] ✅ Usando ficha única encontrada en hojas:', candidatos[0]);
      fichaToUse = candidatos[0];
    }
  }

  const exists = !!fichaToUse;

  console.log('[renderReservaCTA] ¿Hay ficha para este contexto?', exists, '→ fichaToUse:', fichaToUse);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';

  if (exists) {
    console.log('[renderReservaCTA] ✅ Mostrando botón VER FICHA');
    btn.textContent = 'Ver ficha técnica';
    btn.setAttribute('aria-label', 'Ver ficha técnica');

    btn.addEventListener('click', () => {
  try {
    console.log('[renderReservaCTA] Abriendo ficha con objeto:', fichaToUse);

    // 🔹 NORMALIZAMOS para que tenga la misma forma que en el listado
    const dataPlain = normalizeFichaDataForToast(fichaToUse, servicioNorm);

    // Detectar servicio para el título, usando primero el contexto del formulario
    let servicioLabel;
    if (/facial/.test(servicioNorm)) {
      servicioLabel = 'Facial';
    } else if (/pesta/.test(servicioNorm)) {
      servicioLabel = 'Pestañas';
    } else {
      const baseTipo = String(fichaToUse.tipo || fichaToUse.sheet || '').toLowerCase();
      servicioLabel = baseTipo.includes('facial') ? 'Facial' : 'Pestañas';
    }

    const payload = {
      exists: true,
      tipo: 'ficha',
      variant: 'ficha',
      data: dataPlain,
      title: `Ficha técnica — ${servicioLabel}`,
      // por si en el futuro quieres usarlo en showFichaToast
      sheet: fichaToUse.tipo || fichaToUse.sheet || ''
    };

    console.log('[renderReservaCTA] Payload unificado →', {
      keys: Object.keys(payload.data || {}),
      title: payload.title
    });

    showFichaToast(payload);
  } catch (e) {
    console.error('showFichaToast error:', e);
    toast?.('No se pudo abrir la ficha técnica.');
  }
});

  } else {
    console.log('[renderReservaCTA] ➕ Mostrando botón CREAR FICHA');
    btn.textContent = 'Crear ficha técnica';
    btn.setAttribute('aria-label', 'Crear ficha técnica');

    btn.addEventListener('click', () => {
      const svc = servicioNorm;
      const isFacial = /facial/.test(svc);

      const reservaModalEl = document.getElementById('reservaModal');
      if (reservaModalEl) closeModal(reservaModalEl);

      applyType(isFacial ? 'Faciales' : 'Pestañas');
      const fichaModalEl = document.getElementById('fichaModal');
      openModal(fichaModalEl);

      const form = isFacial
        ? document.getElementById('fichaFormFaciales')
        : document.getElementById('fichaFormPestanas');

      const inNombre = form?.querySelector('input[name="nombre"]');
      const inTel    = form?.querySelector('input[name="telefono"]');
      if (inNombre) inNombre.value = ctx?.nombre || '';
      if (inTel)    inTel.value    = ctx?.telefono || '';
      inNombre?.focus();
    });
  }

  cta.appendChild(btn);
}





let fichaMatchDebounce;
async function maybeUpdateReservaCTA() {
  clearTimeout(fichaMatchDebounce);
  fichaMatchDebounce = setTimeout(async () => {
    const servicio = (resServicio?.value || '').trim();
    const fullName = (resNombre?.value || '').trim();
    
    console.log('[CTA] ========== INICIANDO VERIFICACIÓN ==========');
    console.log('[CTA] Servicio:', servicio);
    console.log('[CTA] Nombre:', fullName);
    
    const cta = ensureReservaCta();
    if (!servicio || !fullName) {
      if (cta) {
        cta.innerHTML = '<div class="toast__meta">Completá Servicio y Nombre para verificar la ficha técnica.</div>';
      }
      return;
    }

    const nombre = fullName;
    const telefono = (document.getElementById('resTelefono')?.value || '').trim();
    
    console.log('[CTA] Teléfono:', telefono);

    if (cta) {
      cta.innerHTML = '<div class="toast__meta">🔍 Comprobando ficha técnica...</div>';
    }

    try {
      const match = await apiFichaMatch({ servicio, nombre, telefono });
      
      console.log('[CTA] ========== RESPUESTA RECIBIDA ==========');
      console.log('[CTA] Exists:', match.exists);
      console.log('[CTA] Tipo:', match.tipo);
      console.log('[CTA] Data:', match.data);
      console.log('[CTA] Match completo:', match);
      
      renderReservaCTA(match, { servicio, nombre: fullName, telefono });
    } catch (err) {
      console.error('[CTA] ========== ERROR ==========');
      console.error('[CTA] Error completo:', err);
      renderReservaCTA({ exists: false }, { servicio, nombre: fullName, telefono });
    }
  }, 300);
}

  // Listeners que disparan la verificación de ficha
  ['input','change','blur'].forEach(ev => {
    resNombre?.addEventListener(ev, maybeUpdateReservaCTA);
    resTelefono?.addEventListener(ev, maybeUpdateReservaCTA);
    resServicio?.addEventListener(ev, maybeUpdateReservaCTA);
  });

  // Abrir modal de Reserva
  function abrirModalReservaSafe() {
    openModal(reservaModal);
    delete reservaModal.dataset.row;
    ensureReservaCta();
    clearReservaCta();
    resNombre?.focus();
    try { maybeUpdateReservaCTA(); } catch(_) {}
  }

  // Abrir al hacer clic en el botón del header
  if (btnCrear) btnCrear.addEventListener('click', abrirModalReservaSafe); // 👈 CORREGIDO

  // Llamada inicial al cargar la app
  // ==== APP INIT ====

// Llamada inicial cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  // usamos la promesa correctamente
  loadRecordatoriosHome()
    .catch(e => {
      console.error('init home', e);
    });
});




/* =====================================================================
   Collapsibles
   =====================================================================*/
function initCollapsibles(root){
  const scope = root instanceof Element ? root : document;
  
  function togglePanel(btn){
    if (!btn) return;
    const panelId = btn.getAttribute('aria-controls');
    if (!panelId) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const expanded = btn.getAttribute('aria-expanded') === 'true';
    const next = !expanded;

    btn.setAttribute('aria-expanded', String(next));
    panel.hidden = !next;
  }

  function wireButton(btn){
    if (!btn || btn.dataset.toggleWired === '1') return;
    btn.dataset.toggleWired = '1';

    btn.addEventListener('click', () => togglePanel(btn));

    const panelId = btn.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      panel.hidden = !expanded;
    } else {
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  scope.querySelectorAll('.card[data-collapsible] .card__toggle').forEach(wireButton);
}

// Inicializa cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCollapsibles();
  });
} else {
  initCollapsibles();
}