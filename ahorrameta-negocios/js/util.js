/* ============================================================
   UTILIDADES COMPARTIDAS
   ============================================================ */

const U = {

  /* ---------- DOM ---------- */
  $:  (sel, ctx) => (ctx || document).querySelector(sel),
  $$: (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel)),

  el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  },

  esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /* ---------- Números y dinero ---------- */
  n(v) { const x = parseFloat(v); return isFinite(x) ? x : 0; },

  dinero(v, conSigno) {
    const x = U.n(v);
    const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const signo = conSigno ? (x < 0 ? '− ' : '+ ') : (x < 0 ? '−' : '');
    return signo + APP.moneda + s;
  },

  pct(parte, total, dec) {
    if (!total) return 0;
    const p = (U.n(parte) / U.n(total)) * 100;
    return dec ? Math.round(p * 10) / 10 : Math.round(p);
  },

  /* ---------- Fechas (todo en ISO 'YYYY-MM-DD') ---------- */
  hoy() { return U.iso(new Date()); },

  iso(d) {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  },

  /* Fecha y hora completas, para la bitácora (ej. '2026-09-23T14:05:11') */
  ahora() {
    const d = new Date();
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 19);
  },

  fechaHora(isoStr) {
    if (!isoStr) return '—';
    const [f, h] = String(isoStr).split('T');
    return U.fecha(f) + (h ? ', ' + h.slice(0, 5) : '');
  },

  mesDe(isoStr) { return String(isoStr || '').slice(0, 7); },

  mesActual() { return U.hoy().slice(0, 7); },

  fecha(isoStr) {
    if (!isoStr) return '—';
    const [a, m, d] = String(isoStr).split('-');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${a}`;
  },

  nombreMes(mesIso) {
    const [a, m] = String(mesIso).split('-');
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[parseInt(m, 10) - 1]} ${a}`;
  },

  sumarDias(isoStr, dias) {
    const d = new Date(isoStr + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return U.iso(d);
  },

  diasEntre(a, b) {
    const d1 = new Date(a + 'T12:00:00'), d2 = new Date(b + 'T12:00:00');
    return Math.round((d2 - d1) / 86400000);
  },

  mesesAtras(cantidad) {
    const salida = [];
    const d = new Date();
    d.setDate(1);
    for (let i = cantidad - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      salida.push(U.iso(x).slice(0, 7));
    }
    return salida;
  },

  /* ---------- Ids ---------- */
  id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  /* ---------- Avisos ---------- */
  toast(mensaje, tipo) {
    let zona = U.$('#toastZona');
    if (!zona) {
      zona = U.el('div', { class: 'toast-zona', id: 'toastZona', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(zona);
    }
    const t = U.el('div', { class: 'toast ' + (tipo || '') }, U.esc(mensaje));
    zona.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .25s, transform .25s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 260);
    }, 3200);
  },

  /* ---------- Diálogo de formulario ----------
     campos: [{ k, etiqueta, tipo, opciones, req, ayuda, valor, ancho }]
     tipo: texto | numero | fecha | select | area | mes
     Devuelve una promesa con el objeto de valores, o null si se cancela. */
  formulario({ titulo, subtitulo, campos, valores, textoOk }) {
    return new Promise(resolve => {
      const v = valores || {};
      const fondo = U.el('div', { class: 'modal-fondo' });
      const caja = U.el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });

      let html = `<div class="modal-cabeza">
          <h3>${U.esc(titulo)}</h3>
          ${subtitulo ? `<p class="modal-sub">${U.esc(subtitulo)}</p>` : ''}
        </div>
        <div class="modal-cuerpo"><div class="modal-grid">`;

      campos.forEach(c => {
        const val = v[c.k] !== undefined ? v[c.k] : (c.valor !== undefined ? c.valor : '');
        const ancho = c.ancho === 'completo' ? ' campo-completo' : '';
        html += `<div class="campo${ancho}"><label for="f_${c.k}">${U.esc(c.etiqueta)}${c.req ? ' *' : ''}</label>`;

        if (c.tipo === 'select') {
          html += `<select id="f_${c.k}">` +
            (c.opciones || []).map(o => {
              const ov = typeof o === 'object' ? o.v : o;
              const ot = typeof o === 'object' ? o.t : o;
              return `<option value="${U.esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${U.esc(ot)}</option>`;
            }).join('') + `</select>`;
        } else if (c.tipo === 'area') {
          html += `<textarea id="f_${c.k}" rows="3">${U.esc(val)}</textarea>`;
        } else {
          const t = c.tipo === 'numero' ? 'number' : c.tipo === 'fecha' ? 'date' : c.tipo === 'mes' ? 'month' : 'text';
          const extra = c.tipo === 'numero' ? ' step="0.01"' : '';
          html += `<input type="${t}" id="f_${c.k}" value="${U.esc(val)}"${extra}${c.ph ? ` placeholder="${U.esc(c.ph)}"` : ''}>`;
        }

        if (c.ayuda) html += `<p class="ayuda">${U.esc(c.ayuda)}</p>`;
        html += `</div>`;
      });

      html += `</div><p class="error" id="modalErr" hidden></p></div>
        <div class="modal-pie">
          <button class="btn btn-fantasma" id="modalCancelar">Cancelar</button>
          <button class="btn btn-principal btn-auto" id="modalOk">${U.esc(textoOk || 'Guardar')}</button>
        </div>`;

      caja.innerHTML = html;
      fondo.appendChild(caja);
      document.body.appendChild(fondo);
      document.body.style.overflow = 'hidden';

      const cerrar = res => {
        document.body.style.overflow = '';
        fondo.remove();
        document.removeEventListener('keydown', tecla);
        resolve(res);
      };
      const tecla = e => { if (e.key === 'Escape') cerrar(null); };
      document.addEventListener('keydown', tecla);

      fondo.addEventListener('mousedown', e => { if (e.target === fondo) cerrar(null); });
      U.$('#modalCancelar', caja).onclick = () => cerrar(null);

      U.$('#modalOk', caja).onclick = () => {
        const salida = {};
        for (const c of campos) {
          const campo = U.$('#f_' + c.k, caja);
          let val = campo.value;
          if (c.tipo === 'numero') val = U.n(val);
          else val = String(val).trim();

          if (c.req && (val === '' || (c.tipo === 'numero' && !val))) {
            const err = U.$('#modalErr', caja);
            err.textContent = `Falta llenar "${c.etiqueta}".`;
            err.hidden = false;
            campo.focus();
            return;
          }
          salida[c.k] = val;
        }
        cerrar(salida);
      };

      const primero = U.$('input, select, textarea', caja);
      if (primero) setTimeout(() => primero.focus(), 40);
    });
  },

  /* ---------- Confirmación ---------- */
  confirmar(mensaje, textoOk) {
    return new Promise(resolve => {
      const fondo = U.el('div', { class: 'modal-fondo' });
      fondo.innerHTML = `<div class="modal modal-angosto" role="alertdialog" aria-modal="true">
          <div class="modal-cabeza"><h3>${U.esc(mensaje)}</h3></div>
          <div class="modal-pie">
            <button class="btn btn-fantasma" id="cNo">Cancelar</button>
            <button class="btn btn-peligro btn-auto" id="cSi">${U.esc(textoOk || 'Eliminar')}</button>
          </div>
        </div>`;
      document.body.appendChild(fondo);
      const cerrar = r => { fondo.remove(); resolve(r); };
      U.$('#cNo', fondo).onclick = () => cerrar(false);
      U.$('#cSi', fondo).onclick = () => cerrar(true);
      fondo.addEventListener('mousedown', e => { if (e.target === fondo) cerrar(false); });
      setTimeout(() => U.$('#cSi', fondo).focus(), 40);
    });
  },

  /* ---------- Ventana de solo lectura ----------
     Muestra html ya armado con un botón de cerrar. Devuelve el nodo
     de la caja para que la vista pueda enganchar botones internos. */
  detalle({ titulo, subtitulo, html }) {
    const fondo = U.el('div', { class: 'modal-fondo' });
    fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <div class="modal-cabeza">
          <h3>${U.esc(titulo)}</h3>
          ${subtitulo ? `<p class="modal-sub">${U.esc(subtitulo)}</p>` : ''}
        </div>
        <div class="modal-cuerpo">${html}</div>
        <div class="modal-pie">
          <button class="btn btn-fantasma btn-auto" data-cerrar>Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(fondo);
    document.body.style.overflow = 'hidden';
    const cerrar = () => {
      document.body.style.overflow = '';
      fondo.remove();
      document.removeEventListener('keydown', tecla);
    };
    const tecla = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    fondo.addEventListener('mousedown', e => { if (e.target === fondo) cerrar(); });
    U.$('[data-cerrar]', fondo).onclick = cerrar;
    setTimeout(() => U.$('[data-cerrar]', fondo).focus(), 40);
    return { caja: fondo, cerrar };
  },

  /* ---------- Tabla ----------
     cols: [{ t: título, k: llave, tipo: 'texto'|'dinero'|'fecha'|'html', ancho, alinear }]
     filas: array de objetos
     acciones: [{ etiqueta, clase, fn(fila) }] */
  tabla(cols, filas, acciones) {
    const cont = U.el('div', { class: 'tabla-marco' });
    let html = '<table class="tabla"><thead><tr>';
    cols.forEach(c => {
      html += `<th${c.alinear === 'der' ? ' class="der"' : ''}${c.ancho ? ` style="width:${c.ancho}"` : ''}>${U.esc(c.t)}</th>`;
    });
    if (acciones && acciones.length) html += '<th class="der col-acciones"></th>';
    html += '</tr></thead><tbody>';

    filas.forEach((f, i) => {
      html += `<tr data-i="${i}">`;
      cols.forEach(c => {
        let contenido;
        if (c.tipo === 'html')        contenido = c.render ? c.render(f) : f[c.k];
        else if (c.tipo === 'dinero') contenido = `<span class="cifra">${U.dinero(f[c.k])}</span>`;
        else if (c.tipo === 'fecha')  contenido = U.esc(U.fecha(f[c.k]));
        else                          contenido = U.esc(f[c.k]);
        html += `<td${c.alinear === 'der' ? ' class="der"' : ''}>${contenido}</td>`;
      });
      if (acciones && acciones.length) {
        html += '<td class="der col-acciones">';
        acciones.forEach((a, j) => {
          html += `<button class="btn-icono ${a.clase || ''}" data-acc="${j}" title="${U.esc(a.etiqueta)}">${U.esc(a.etiqueta)}</button>`;
        });
        html += '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    cont.innerHTML = html;

    if (acciones && acciones.length) {
      U.$$('button[data-acc]', cont).forEach(b => {
        b.onclick = () => {
          const i = parseInt(b.closest('tr').dataset.i, 10);
          acciones[parseInt(b.dataset.acc, 10)].fn(filas[i], i);
        };
      });
    }
    return cont;
  },

  /* ---------- Estado vacío ---------- */
  vacio(titulo, texto, etiquetaAccion, fn) {
    const d = U.el('div', { class: 'vacio' });
    d.innerHTML = `<p class="vacio-titulo">${U.esc(titulo)}</p>
                   <p class="vacio-texto">${U.esc(texto)}</p>`;
    if (etiquetaAccion) {
      const b = U.el('button', { class: 'btn btn-principal btn-auto' }, U.esc(etiquetaAccion));
      b.onclick = fn;
      d.appendChild(b);
    }
    return d;
  },

  /* ---------- Etiqueta de estado ---------- */
  chip(texto, tono) {
    return `<span class="chip chip-${tono || 'neutro'}">${U.esc(texto)}</span>`;
  },

  /* ---------- Barra de progreso ---------- */
  barra(porcentaje, tono) {
    const p = Math.max(0, Math.min(100, porcentaje));
    return `<div class="progreso"><span class="progreso-relleno tono-${tono || 'ocre'}" style="width:${p}%"></span></div>`;
  },

  /* ---------- Descarga CSV ---------- */
  csv(nombreArchivo, cols, filas) {
    const lineas = [cols.map(c => `"${c.t}"`).join(',')];
    filas.forEach(f => {
      lineas.push(cols.map(c => `"${String(f[c.k] === undefined ? '' : f[c.k]).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = U.el('a', { href: URL.createObjectURL(blob), download: nombreArchivo });
    document.body.appendChild(a); a.click(); a.remove();
  },

  /* ---------- Hash simple (SOLO para el modo local de demo) ---------- */
  hashSimple(txt) {
    let h = 5381;
    for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
};
