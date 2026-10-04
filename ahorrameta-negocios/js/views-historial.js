/* ============================================================
   HISTORIAL DE INGRESOS Y DE GASTOS  (Sprint 2 · HU9, HU14)
   ------------------------------------------------------------
   Las dos pantallas son la misma vista con un tipo distinto.
   A diferencia de "Movimientos", no se limitan al mes elegido
   arriba: muestran todo el historial, con filtros de fechas.

   Pestaña "Registros": la lista, con editar / eliminar / ver cambios.
   Pestaña "Registro de cambios": la bitácora de ese tipo, con
   la opción de restaurar lo que se eliminó.
   ============================================================ */

const Historial = {

  porPagina: 25,

  crear(tipo) {
    const esIng = tipo === 'ingreso';
    const txt = {
      titulo: esIng ? 'Historial de ingresos' : 'Historial de gastos',
      uno: esIng ? 'ingreso' : 'gasto',
      varios: esIng ? 'ingresos' : 'gastos',
      tono: esIng ? 'jade' : 'barro',
      signo: esIng ? '+' : '−',
      clasePos: esIng ? 'pos' : 'neg'
    };

    return {
      eyebrow: 'Historial',
      titulo: txt.titulo,

      render(cont, ctx) {
        /* El estado de los filtros vive mientras la vista esté abierta;
           se guarda en la propia vista para sobrevivir a ctx.refrescar()
           después de editar o eliminar. */
        const est = this._estado || (this._estado = {
          pestana: 'registros', rango: 'todo', desde: '', hasta: '',
          cat: 'todas', busqueda: '', orden: 'fecha-desc', pagina: 1
        });

        const cats = Store.lista('categorias').filter(c => c.clase === tipo);

        /* ---------- Pestañas ---------- */
        const pestanas = U.el('div', { class: 'pestanas', role: 'tablist' });
        const nCambios = Bitacora.porTipo(tipo).length;
        pestanas.innerHTML = `
          <button class="pestana ${est.pestana === 'registros' ? 'activa' : ''}" data-p="registros" role="tab">Registros</button>
          <button class="pestana ${est.pestana === 'cambios' ? 'activa' : ''}" data-p="cambios" role="tab">Registro de cambios${nCambios ? ` (${nCambios})` : ''}</button>`;
        U.$$('[data-p]', pestanas).forEach(b => {
          b.onclick = () => { est.pestana = b.dataset.p; ctx.refrescar(); };
        });
        cont.appendChild(pestanas);

        if (est.pestana === 'cambios') {
          Historial._pintarCambios(cont, ctx, tipo, txt);
          return;
        }

        /* ---------- Filtros ---------- */
        const filtros = U.el('div', { class: 'filtros' });
        filtros.innerHTML = `
          <select id="hRango" aria-label="Período">
            <option value="todo">Todo el historial</option>
            <option value="mes">${U.esc(U.nombreMes(ctx.mes))}</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="anio">Este año</option>
            <option value="rango">Entre dos fechas…</option>
          </select>
          <input type="date" id="hDesde" aria-label="Desde" value="${U.esc(est.desde)}" ${est.rango === 'rango' ? '' : 'hidden'}>
          <input type="date" id="hHasta" aria-label="Hasta" value="${U.esc(est.hasta)}" ${est.rango === 'rango' ? '' : 'hidden'}>
          <select id="hCat" aria-label="Categoría">
            <option value="todas">Todas las categorías</option>
            ${cats.map(c => `<option value="${U.esc(c.id)}">${U.esc(c.nombre)}</option>`).join('')}
          </select>
          <select id="hOrden" aria-label="Orden">
            <option value="fecha-desc">Más recientes primero</option>
            <option value="fecha-asc">Más antiguos primero</option>
            <option value="monto-desc">Monto mayor primero</option>
            <option value="monto-asc">Monto menor primero</option>
          </select>
          <input type="search" id="hBuscar" placeholder="Buscar concepto…" value="${U.esc(est.busqueda)}">
          <span class="filtro-espacio"></span>
          <button class="btn btn-fantasma btn-chico" id="hCsv">Descargar CSV</button>
          <button class="btn btn-principal btn-auto btn-chico" id="hNuevo">Registrar ${txt.uno}</button>`;
        cont.appendChild(filtros);

        U.$('#hRango', filtros).value = est.rango;
        U.$('#hCat', filtros).value = est.cat;
        U.$('#hOrden', filtros).value = est.orden;

        const zona = U.el('div');
        cont.appendChild(zona);

        const pintar = () => {
          const filas = Historial._filtrar(tipo, est, ctx);
          Historial._pintarLista(zona, filas, est, ctx, tipo, txt, pintar);
        };

        U.$('#hRango', filtros).onchange = e => {
          est.rango = e.target.value; est.pagina = 1;
          const ver = est.rango === 'rango';
          U.$('#hDesde', filtros).hidden = !ver;
          U.$('#hHasta', filtros).hidden = !ver;
          pintar();
        };
        U.$('#hDesde', filtros).onchange = e => { est.desde = e.target.value; est.pagina = 1; pintar(); };
        U.$('#hHasta', filtros).onchange = e => { est.hasta = e.target.value; est.pagina = 1; pintar(); };
        U.$('#hCat', filtros).onchange = e => { est.cat = e.target.value; est.pagina = 1; pintar(); };
        U.$('#hOrden', filtros).onchange = e => { est.orden = e.target.value; pintar(); };
        U.$('#hBuscar', filtros).oninput = e => { est.busqueda = e.target.value.trim(); est.pagina = 1; pintar(); };
        U.$('#hNuevo', filtros).onclick = () => Acciones.movimiento(null, ctx, tipo);
        U.$('#hCsv', filtros).onclick = () => {
          const filas = Historial._filtrar(tipo, est, ctx).map(m => ({
            fecha: m.fecha, concepto: m.descripcion,
            categoria: Store.nombreCategoria(m.categoriaId),
            centro: m.centroCosto || '', monto: U.n(m.monto).toFixed(2),
            ediciones: U.n(m.ediciones), modificado: m.modificado || ''
          }));
          if (!filas.length) return U.toast('No hay nada que descargar con estos filtros.', 'mal');
          U.csv(`historial-${txt.varios}-${U.hoy()}.csv`, [
            { t: 'Fecha', k: 'fecha' }, { t: 'Concepto', k: 'concepto' },
            { t: 'Categoría', k: 'categoria' }, { t: 'Centro de costo', k: 'centro' },
            { t: 'Monto', k: 'monto' }, { t: 'Veces editado', k: 'ediciones' },
            { t: 'Última modificación', k: 'modificado' }
          ], filas);
        };

        pintar();
      }
    };
  },

  /* ---------- Aplica filtros y orden ---------- */
  _filtrar(tipo, est, ctx) {
    let filas = Store.lista('movimientos').filter(m => m.tipo === tipo);

    const hoy = U.hoy();
    let desde = '', hasta = '';
    if (est.rango === 'mes') { desde = ctx.mes + '-01'; hasta = ctx.mes + '-31'; }
    else if (est.rango === '30') { desde = U.sumarDias(hoy, -30); hasta = hoy; }
    else if (est.rango === '90') { desde = U.sumarDias(hoy, -90); hasta = hoy; }
    else if (est.rango === 'anio') { desde = hoy.slice(0, 4) + '-01-01'; hasta = hoy; }
    else if (est.rango === 'rango') { desde = est.desde; hasta = est.hasta; }

    /* Si pusieron las fechas al revés, se voltean en vez de mostrar nada */
    if (desde && hasta && desde > hasta) { const t = desde; desde = hasta; hasta = t; }
    if (desde) filas = filas.filter(m => m.fecha >= desde);
    if (hasta) filas = filas.filter(m => m.fecha <= hasta);

    if (est.cat !== 'todas') filas = filas.filter(m => m.categoriaId === est.cat);
    if (est.busqueda) {
      const q = est.busqueda.toLowerCase();
      filas = filas.filter(m => String(m.descripcion || '').toLowerCase().includes(q));
    }

    const [campo, dir] = est.orden.split('-');
    const s = dir === 'asc' ? 1 : -1;
    filas.sort((a, b) => {
      if (campo === 'monto') return s * (U.n(a.monto) - U.n(b.monto));
      if (a.fecha === b.fecha) return s * String(a.creadoEn || a.creado || '').localeCompare(String(b.creadoEn || b.creado || ''));
      return s * (a.fecha < b.fecha ? -1 : 1);
    });
    return filas;
  },

  /* ---------- Métricas + tabla paginada ---------- */
  _pintarLista(zona, filas, est, ctx, tipo, txt, repintar) {
    zona.innerHTML = '';

    const total = filas.reduce((a, m) => a + U.n(m.monto), 0);
    const mayor = filas.reduce((a, m) => (U.n(m.monto) > U.n(a && a.monto) ? m : a), null);
    const editados = filas.filter(m => U.n(m.ediciones) > 0).length;

    zona.insertAdjacentHTML('beforeend', `<div class="rejilla r4" style="margin-bottom:var(--e4)">
      ${Bloque.metrica(`Total de ${txt.varios}`, U.dinero(total), `${filas.length} ${filas.length === 1 ? 'registro' : 'registros'}`, txt.tono)}
      ${Bloque.metrica('Promedio', U.dinero(filas.length ? total / filas.length : 0), 'Por registro', 'tinta')}
      ${Bloque.metrica(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} más alto`, U.dinero(mayor ? mayor.monto : 0),
          mayor ? U.esc(mayor.descripcion) : 'Sin datos', 'ocre')}
      ${Bloque.metrica('Corregidos', String(editados), 'Registros editados al menos una vez', 'tinta')}
    </div>`);

    if (!filas.length) {
      const hayAlgo = Store.lista('movimientos').some(m => m.tipo === tipo);
      zona.appendChild(U.vacio(
        hayAlgo ? 'Nada coincide con estos filtros' : `Todavía no hay ${txt.varios}`,
        hayAlgo ? 'Probá con otro período, otra categoría o borrá la búsqueda.'
                : `Cuando registres tu primer ${txt.uno} va a aparecer aquí.`,
        `Registrar ${txt.uno}`, () => Acciones.movimiento(null, ctx, tipo)));
      return;
    }

    /* Paginación */
    const paginas = Math.max(1, Math.ceil(filas.length / Historial.porPagina));
    if (est.pagina > paginas) est.pagina = paginas;
    const ini = (est.pagina - 1) * Historial.porPagina;
    const visibles = filas.slice(ini, ini + Historial.porPagina);

    const cols = [
      { t: 'Fecha', k: 'fecha', tipo: 'fecha', ancho: '110px' },
      { t: 'Concepto', k: 'descripcion', tipo: 'html', render: f =>
          U.esc(f.descripcion) + (U.n(f.ediciones) > 0
            ? ` <span title="Última modificación: ${U.esc(U.fechaHora(f.modificado))}">${U.chip('editado', 'ocre')}</span>` : '') },
      { t: 'Categoría', k: 'cat', tipo: 'html', render: f => {
          const c = Store.categoria(f.categoriaId);
          return `<span class="chip" style="background:${c ? c.color + '22' : 'var(--papel-3)'};color:${c ? c.color : 'var(--texto-2)'}">${U.esc(c ? c.nombre : 'Sin categoría')}</span>`;
        } }
    ];
    if (Store.esEmpresa()) cols.push({ t: 'Centro', k: 'centroCosto', tipo: 'html', render: f => U.esc(f.centroCosto || '—') });
    cols.push({ t: 'Monto', k: 'monto', tipo: 'html', alinear: 'der', render: f =>
      `<span class="cifra ${txt.clasePos}">${txt.signo}${U.dinero(f.monto)}</span>` });

    zona.appendChild(U.tabla(cols, visibles, [
      { etiqueta: 'Cambios', fn: f => Acciones.verCambios(f) },
      { etiqueta: 'Editar', fn: f => Acciones.movimiento(f, ctx) },
      { etiqueta: 'Eliminar', clase: 'peligro', fn: f => Acciones.eliminarMovimiento(f, ctx) }
    ]));

    if (paginas > 1) {
      const pie = U.el('div', { class: 'paginacion' });
      pie.innerHTML = `
        <button class="btn btn-fantasma btn-chico btn-auto" data-pag="-1" ${est.pagina === 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${est.pagina} de ${paginas} · ${ini + 1}–${ini + visibles.length} de ${filas.length}</span>
        <button class="btn btn-fantasma btn-chico btn-auto" data-pag="1" ${est.pagina === paginas ? 'disabled' : ''}>Siguiente</button>`;
      U.$$('[data-pag]', pie).forEach(b => {
        b.onclick = () => { est.pagina += parseInt(b.dataset.pag, 10); repintar(); };
      });
      zona.appendChild(pie);
    }
  },

  /* ---------- Pestaña de bitácora ---------- */
  _pintarCambios(cont, ctx, tipo, txt) {
    const entradas = Bitacora.porTipo(tipo);

    if (!entradas.length) {
      cont.appendChild(U.vacio('Sin cambios registrados',
        `Cada vez que registres, edites o elimines un ${txt.uno}, va a quedar anotado aquí con fecha y hora.`));
      return;
    }

    const cols = [
      { t: 'Cuándo', k: 'cuando', tipo: 'html', ancho: '150px', render: e => U.esc(U.fechaHora(e.cuando)) },
      { t: 'Acción', k: 'accion', tipo: 'html', ancho: '110px', render: e => {
          const et = Bitacora.etiqueta(e.accion);
          return U.chip(et.t, et.tono);
        } },
      { t: 'Registro', k: 'descripcion', tipo: 'html', render: e =>
          `${U.esc(e.descripcion)} <span class="cifra" style="color:var(--texto-3)">${U.dinero(e.monto)}</span>` },
      { t: 'Detalle', k: 'det', tipo: 'html', render: e => {
          let h = '';
          if (e.cambios && e.cambios.length) {
            h = e.cambios.map(c => `${U.esc(c.etiqueta)}: <s>${U.esc(c.de)}</s> → ${U.esc(c.a)}`).join('<br>');
          }
          if (e.motivo) h += `${h ? '<br>' : ''}<i>${U.esc(e.motivo)}</i>`;
          return h || '<span style="color:var(--texto-3)">—</span>';
        } }
    ];

    /* Solo las eliminaciones cuyo registro no volvió tienen botón de restaurar */
    const tabla = U.tabla(cols, entradas, [
      { etiqueta: 'Restaurar', fn: e => {
          if (e.accion !== 'eliminado' || Bitacora.existe(e.movimientoId)) {
            return U.toast('Solo se puede restaurar un registro eliminado que no haya vuelto.', 'mal');
          }
          Acciones.restaurar(e, ctx);
        } }
    ]);
    U.$$('tbody tr', tabla).forEach((tr, i) => {
      const e = entradas[i];
      if (e.accion !== 'eliminado' || Bitacora.existe(e.movimientoId)) {
        const b = U.$('button[data-acc]', tr);
        if (b) b.remove();
      }
    });

    const nota = U.el('p', { class: 'tarjeta-nota', style: 'margin-bottom:var(--e3)' },
      'Este registro no se puede editar ni borrar: es el rastro de cada cambio.');
    cont.appendChild(nota);
    cont.appendChild(tabla);
  }
};

Vistas.ingresos = Historial.crear('ingreso');
Vistas.gastos = Historial.crear('gasto');
