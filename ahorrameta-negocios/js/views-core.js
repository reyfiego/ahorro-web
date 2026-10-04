/* ============================================================
   VISTAS COMUNES (cuenta personal y empresarial)
   Cada vista es: { eyebrow, titulo, render(contenedor, ctx) }
   ctx = { mes, refrescar() }
   ============================================================ */

const Vistas = {};

/* ============ Acciones reutilizables ============ */

const Acciones = {

  /* ----------------------------------------------------------
     Alta / edición de un movimiento  (HU6, HU11, HU7, HU12)
     existente: el registro a editar, o null para uno nuevo
     tipoFijo:  'ingreso' | 'gasto' cuando se abre desde el
                historial de uno de los dos (no deja cambiar tipo)
     ---------------------------------------------------------- */
  async movimiento(existente, ctx, tipoFijo) {
    const cats = Store.lista('categorias');
    if (!cats.length) {
      U.toast('Primero creá al menos una categoría.', 'mal');
      location.hash = '#/categorias';
      return;
    }

    /* Al editar, el tipo no cambia: un ingreso sigue siendo ingreso.
       Si alguien lo anotó mal, lo correcto es eliminarlo y registrarlo
       de nuevo; así la bitácora deja claro qué pasó. */
    const tipo = existente ? existente.tipo : (tipoFijo || null);
    const nombreTipo = t => (t === 'ingreso' ? 'ingreso' : 'gasto');

    /* Solo se ofrecen categorías que sirven para ese tipo. Si el registro
       ya tenía una categoría de la otra clase (datos viejos), se deja
       en la lista para no perderla sin avisar. */
    let opcionesCat;
    if (tipo) {
      opcionesCat = cats
        .filter(c => c.clase === tipo || (existente && c.id === existente.categoriaId))
        .map(c => ({ v: c.id, t: c.nombre }));
      if (!opcionesCat.length) {
        U.toast(`No tenés categorías de ${tipo === 'ingreso' ? 'entrada' : 'salida'}. Creá una primero.`, 'mal');
        location.hash = '#/categorias';
        return;
      }
    } else {
      opcionesCat = cats.map(c => ({ v: c.id, t: `${c.nombre} (${c.clase === 'ingreso' ? 'entrada' : 'salida'})` }));
    }

    const campos = [];
    if (!tipo) {
      campos.push({ k: 'tipo', etiqueta: 'Tipo', tipo: 'select', req: true,
        opciones: [{ v: 'gasto', t: 'Sale dinero' }, { v: 'ingreso', t: 'Entra dinero' }] });
    }
    campos.push(
      { k: 'monto', etiqueta: 'Monto', tipo: 'numero', req: true, ph: '0.00' },
      { k: 'descripcion', etiqueta: 'Concepto', tipo: 'texto', req: true, ancho: 'completo',
        ph: 'Ej. Venta del día, compra de mercadería…' },
      { k: 'categoriaId', etiqueta: 'Categoría', tipo: 'select', req: true, opciones: opcionesCat },
      { k: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', req: true, valor: U.hoy() }
    );
    if (Store.esEmpresa()) {
      campos.push({ k: 'centroCosto', etiqueta: 'Centro de costo', tipo: 'select',
        opciones: [{ v: '', t: 'Sin asignar' }].concat(APP.centrosCosto.map(c => ({ v: c, t: c }))) });
    }
    if (existente) {
      campos.push({ k: 'motivo', etiqueta: 'Motivo del cambio', tipo: 'texto', ancho: 'completo',
        ph: 'Opcional. Ej. el monto estaba mal escrito',
        ayuda: 'Queda guardado en el registro de cambios.' });
    }

    let titulo;
    if (existente) titulo = `Editar ${nombreTipo(tipo)}`;
    else if (tipo) titulo = `Registrar ${nombreTipo(tipo)}`;
    else titulo = 'Registrar movimiento';

    let subtitulo = existente ? null : 'Anotalo apenas pase. Los cálculos se actualizan solos.';
    if (existente && existente.origen) {
      subtitulo = `Este registro vino de ${existente.origen.texto}. Cambiarlo aquí no modifica el documento original.`;
    }

    const r = await U.formulario({
      titulo, subtitulo, campos,
      valores: existente ? Object.assign({ motivo: '' }, existente) : null,
      textoOk: existente ? 'Guardar cambios' : 'Registrar'
    });
    if (!r) return;

    /* ---------- Validaciones (consistencia de datos) ---------- */
    const motivo = r.motivo || '';
    delete r.motivo;
    if (tipo) r.tipo = tipo;

    r.monto = Math.round(U.n(r.monto) * 100) / 100;
    if (r.monto <= 0) return U.toast('El monto tiene que ser mayor que cero.', 'mal');
    if (r.monto > 1e9) return U.toast('Ese monto es demasiado grande. Revisalo.', 'mal');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) return U.toast('La fecha no es válida.', 'mal');
    if (r.fecha > U.hoy()) {
      return U.toast('La fecha no puede ser futura. Los pagos que vienen van en Por pagar o Por cobrar.', 'mal');
    }

    const cat = Store.categoria(r.categoriaId);
    if (!cat) return U.toast('Elegí una categoría válida.', 'mal');
    const catVieja = existente && existente.categoriaId === r.categoriaId;
    if (cat.clase !== r.tipo && !catVieja) {
      return U.toast(`"${cat.nombre}" es una categoría de ${cat.clase === 'ingreso' ? 'entradas' : 'salidas'}; no sirve para un ${nombreTipo(r.tipo)}.`, 'mal');
    }

    r.descripcion = String(r.descripcion || '').trim();
    if (r.descripcion.length < 2) return U.toast('Escribí un concepto un poco más claro.', 'mal');

    /* ---------- Guardar ---------- */
    try {
      if (existente) {
        const cambios = Bitacora.diferencias(existente, r);
        if (!cambios.length) return U.toast('No cambiaste nada.', 'ok');

        /* Se parte del registro original para no perder campos que el
           formulario no muestra (origen, fecha de creación, etc.) */
        const nuevo = Object.assign({}, existente, r, {
          id: existente.id,
          modificado: U.ahora(),
          ediciones: U.n(existente.ediciones) + 1
        });
        await Store.guardar('movimientos', nuevo);
        await Bitacora.registrar('editado', nuevo, { cambios, motivo });
        U.toast(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} actualizado.`, 'ok');
      } else {
        const nuevo = await Store.guardar('movimientos', Object.assign(r, { creadoEn: U.ahora(), ediciones: 0 }));
        await Bitacora.registrar('creado', nuevo);
        U.toast(r.tipo === 'ingreso' ? 'Ingreso registrado.' : 'Gasto registrado.', 'ok');
      }
    } catch (e) {
      console.error(e);
      U.toast('No se pudo guardar: ' + Store.mensajeError(e), 'mal');
      return;
    }
    ctx.refrescar();
  },

  /* ----------------------------------------------------------
     Eliminar un ingreso o un gasto  (HU8, HU13)
     Queda una copia completa en la bitácora para poder restaurarlo.
     Si el registro vino de una factura o de un compromiso, ese
     documento vuelve a quedar pendiente, para que los saldos
     de Por cobrar / Por pagar sigan cuadrando.
     ---------------------------------------------------------- */
  async eliminarMovimiento(m, ctx) {
    const nombre = m.tipo === 'ingreso' ? 'ingreso' : 'gasto';
    const origen = Acciones._documentoOrigen(m);

    let texto = `¿Eliminar el ${nombre} "${m.descripcion}" de ${U.dinero(m.monto)} (${U.fecha(m.fecha)})? ` +
                `Queda en el registro de cambios y lo podés restaurar.`;
    if (origen) texto += ` ${origen.etiqueta} volverá a quedar pendiente.`;

    const ok = await U.confirmar(texto, `Eliminar ${nombre}`);
    if (!ok) return;

    try {
      await Store.borrar('movimientos', m.id);
      await Bitacora.registrar('eliminado', m);
      if (origen) {
        await Store.guardar(origen.coleccion,
          Object.assign({}, origen.doc, { estado: 'Pendiente', pagada: null }));
      }
      U.toast(`${nombre === 'ingreso' ? 'Ingreso' : 'Gasto'} eliminado.`, 'ok');
    } catch (e) {
      console.error(e);
      U.toast('No se pudo eliminar: ' + Store.mensajeError(e), 'mal');
      return;
    }
    ctx.refrescar();
  },

  /* Vuelve a poner un movimiento eliminado, con su mismo id. */
  async restaurar(entrada, ctx) {
    if (!entrada.copia || Bitacora.existe(entrada.movimientoId)) {
      return U.toast('Ese registro ya está en tu historial.', 'ok');
    }
    const ok = await U.confirmar(
      `¿Restaurar "${entrada.descripcion}" de ${U.dinero(entrada.monto)}?`, 'Restaurar');
    if (!ok) return;

    try {
      const m = Object.assign({}, entrada.copia, { id: entrada.movimientoId, modificado: U.ahora() });
      await Store.guardar('movimientos', m);
      await Bitacora.registrar('restaurado', m);

      /* Si venía de una factura o compromiso que sigue pendiente, se
         vuelve a marcar como pagado, igual que antes de borrarlo. */
      const origen = Acciones._documentoOrigen(m);
      if (origen && origen.doc.estado === 'Pendiente') {
        await Store.guardar(origen.coleccion,
          Object.assign({}, origen.doc, { estado: 'Pagada', pagada: m.fecha }));
      }
      U.toast('Registro restaurado.', 'ok');
    } catch (e) {
      console.error(e);
      U.toast('No se pudo restaurar: ' + Store.mensajeError(e), 'mal');
      return;
    }
    ctx.refrescar();
  },

  /* Ventana con la línea de tiempo de un solo movimiento. */
  verCambios(m) {
    const entradas = Bitacora.de(m.id);
    const alta = m.creadoEn || m.creado;

    let html = `<div class="traza">`;
    entradas.forEach(e => { html += Acciones._pasoTraza(e); });

    /* Los registros viejos (antes del Sprint 2) no tienen entrada de
       creación en la bitácora; se muestra con la fecha que haya. */
    if (!entradas.some(e => e.accion === 'creado')) {
      html += `<div class="traza-paso">
        <div class="traza-cabeza">${U.chip('Creado', 'jade')}
          <span class="traza-cuando">${U.esc(alta ? U.fechaHora(alta) : 'Fecha no registrada')}</span></div>
        <p class="traza-txt">${m.origen ? 'Se generó desde ' + U.esc(m.origen.texto) + '.' : 'Registro original.'}</p>
      </div>`;
    }
    html += `</div>`;

    U.detalle({
      titulo: 'Historial del registro',
      subtitulo: `${m.descripcion} · ${U.dinero(m.monto)}`,
      html
    });
  },

  /* Pinta una entrada de bitácora como paso de la línea de tiempo. */
  _pasoTraza(e) {
    const et = Bitacora.etiqueta(e.accion);
    let cuerpo = '';
    if (e.accion === 'editado' && e.cambios && e.cambios.length) {
      cuerpo = `<ul class="traza-cambios">` + e.cambios.map(c =>
        `<li><b>${U.esc(c.etiqueta)}:</b> <s>${U.esc(c.de)}</s> → ${U.esc(c.a)}</li>`).join('') + `</ul>`;
    } else if (e.accion === 'eliminado') {
      cuerpo = `<p class="traza-txt">Se eliminó con ${U.esc(U.dinero(e.monto))}.</p>`;
    } else if (e.accion === 'restaurado') {
      cuerpo = `<p class="traza-txt">Se volvió a poner en el historial.</p>`;
    } else if (e.accion === 'creado') {
      cuerpo = `<p class="traza-txt">Se registró con ${U.esc(U.dinero(e.monto))}.</p>`;
    }
    if (e.motivo) cuerpo += `<p class="traza-motivo">Motivo: ${U.esc(e.motivo)}</p>`;

    return `<div class="traza-paso">
      <div class="traza-cabeza">${U.chip(et.t, et.tono)}
        <span class="traza-cuando">${U.esc(U.fechaHora(e.cuando))}</span></div>
      ${cuerpo}
    </div>`;
  },

  /* Si el movimiento vino de una factura o un compromiso, devuelve ese
     documento. Si ya no existe, devuelve null. */
  _documentoOrigen(m) {
    if (!m.origen || !m.origen.coleccion || !m.origen.id) return null;
    const doc = Store.lista(m.origen.coleccion).find(x => x.id === m.origen.id);
    if (!doc) return null;
    const etiqueta = m.origen.coleccion === 'facturas'
      ? `La factura ${doc.numero}`
      : `El compromiso "${doc.concepto}"`;
    return { coleccion: m.origen.coleccion, doc, etiqueta };
  },

  async borrar(coleccion, registro, ctx, texto) {
    const ok = await U.confirmar(texto || '¿Eliminar este registro?');
    if (!ok) return;
    await Store.borrar(coleccion, registro.id);
    U.toast('Eliminado.', 'ok');
    ctx.refrescar();
  }
};

/* ============ Bloques reutilizables ============ */

const Bloque = {

  metrica(etiqueta, valor, pie, tono) {
    return `<div class="metrica m-${tono || 'tinta'}">
      <p class="metrica-etq">${U.esc(etiqueta)}</p>
      <p class="metrica-val">${U.esc(valor)}</p>
      ${pie ? `<p class="metrica-pie">${pie}</p>` : ''}
    </div>`;
  },

  tarjeta(titulo, nota, contenidoHtml) {
    return `<section class="tarjeta">
      <div class="tarjeta-cabeza">
        <h3>${U.esc(titulo)}</h3>
        ${nota ? `<span class="tarjeta-nota">${U.esc(nota)}</span>` : ''}
      </div>
      ${contenidoHtml}
    </section>`;
  },

  /* La cinta de caja: el elemento firma de la aplicación. */
  cintaCaja(compacta) {
    const p = Calc.proyeccionCaja(90);
    const tieneDatos = Store.lista('movimientos').length > 0;

    let respuesta, detalle;
    if (!tieneDatos) {
      respuesta = 'Registrá tu primer movimiento';
      detalle = 'En cuanto anotes lo que entra y lo que sale, calculamos cuántos días de caja te quedan.';
    } else if (p.diasDeCaja === null) {
      respuesta = 'Más de 90 días';
      detalle = `Con el ritmo actual (${U.dinero(p.operacionDiaria)} de gasto diario) la caja aguanta todo el trimestre.`;
    } else {
      respuesta = `${p.diasDeCaja} ${p.diasDeCaja === 1 ? 'día' : 'días'}`;
      detalle = `La caja llega a cero el ${U.fecha(p.fechaQuiebre)} si nada cambia. ` +
                `Hoy tenés ${U.dinero(p.saldoHoy)} y se van ${U.dinero(p.operacionDiaria)} por día.`;
    }

    return `<section class="cinta-caja">
      <div class="cinta-cabeza">
        <div>
          <p class="eyebrow" style="color:var(--ocre-2)">Flujo de caja proyectado</p>
          <p class="cinta-pregunta">Hasta cuándo alcanza:<br><em>${U.esc(respuesta)}</em></p>
          <p class="cinta-sub">${U.esc(detalle)}</p>
        </div>
      </div>
      ${G.cintaCaja(p.dias)}
      <div class="cinta-leyenda">
        <span><i style="background:#6FBF9B"></i>Cobros programados</span>
        <span><i style="background:#E08878"></i>Pagos programados</span>
        <span><i style="background:rgba(224,160,58,.7)"></i>Línea de cero</span>
        ${compacta ? '' : `<span style="margin-left:auto">Saldo a 90 días: <b class="cifra">${U.dinero(p.saldoFinal)}</b></span>`}
      </div>
    </section>`;
  },

  listaAlertas(maximo) {
    const alertas = Calc.alertas();
    if (!alertas.length) {
      return `<div class="aviso aviso-jade">
        <div><p class="aviso-tit">Todo en orden</p>
        <p class="aviso-txt">No hay presupuestos excedidos, cobros vencidos ni riesgos de caja.</p></div>
      </div>`;
    }
    return alertas.slice(0, maximo || alertas.length).map(a => `
      <a class="aviso aviso-${a.tono}" href="${a.ir}" style="text-decoration:none;margin-bottom:8px">
        <div>
          <p class="aviso-tit">${U.esc(a.titulo)}</p>
          <p class="aviso-txt">${U.esc(a.texto)}</p>
        </div>
      </a>`).join('');
  }
};

/* ============================================================
   RESUMEN
   ============================================================ */
Vistas.resumen = {
  eyebrow: 'Panel',
  titulo: 'Resumen',
  render(cont, ctx) {
    const t = Calc.totales(ctx.mes);
    const empresa = Store.esEmpresa();
    const gastos = Calc.porCategoria(ctx.mes, 'gasto');
    const serie = Calc.serieMensual(6);
    const recientes = Calc.movimientosDe(ctx.mes).slice(0, 7);

    let html = '';

    /* --- Métricas --- */
    if (empresa) {
      const r = Calc.resultados(ctx.mes);
      html += `<div class="rejilla r4">
        ${Bloque.metrica('Ventas del mes', U.dinero(r.ventas), U.nombreMes(ctx.mes), 'jade')}
        ${Bloque.metrica('Utilidad neta', U.dinero(r.utilidadNeta),
            `Margen ${r.margenNeto.toFixed(1)}%`, r.utilidadNeta >= 0 ? 'jade' : 'barro')}
        ${Bloque.metrica('Por cobrar', U.dinero(Calc.porCobrar()),
            `${Calc.facturasAbiertas().length} facturas abiertas`, 'ocre')}
        ${Bloque.metrica('Por pagar', U.dinero(Calc.porPagar()),
            `${Calc.obligacionesAbiertas().length} compromisos`, 'barro')}
      </div>`;
    } else {
      html += `<div class="rejilla r3">
        ${Bloque.metrica('Entró', U.dinero(t.entra), U.nombreMes(ctx.mes), 'jade')}
        ${Bloque.metrica('Salió', U.dinero(t.sale), U.nombreMes(ctx.mes), 'barro')}
        ${Bloque.metrica('Te queda', U.dinero(t.saldo),
            t.saldo >= 0 ? 'Vas con saldo a favor' : 'Estás gastando de más', t.saldo >= 0 ? 'jade' : 'barro')}
      </div>`;
    }

    /* --- Cinta (firma) --- */
    html += Bloque.cintaCaja(true);

    /* --- Alertas + reparto --- */
    html += `<div class="r-2-1" style="display:grid">
      <div>
        ${Bloque.tarjeta('Qué necesita tu atención', null, Bloque.listaAlertas(4))}
      </div>
      <div>
        ${Bloque.tarjeta('En qué se va el dinero', U.nombreMes(ctx.mes),
          gastos.length
            ? G.dona(gastos, { centroTitulo: 'Total', centroValor: U.dinero(t.sale) }) + G.leyenda(gastos.slice(0, 6))
            : '<p class="vacio-texto">Sin gastos registrados este mes.</p>')}
      </div>
    </div>`;

    /* --- Tendencia + últimos movimientos --- */
    html += `<div class="r-2-1" style="display:grid">
      <div>${Bloque.tarjeta('Últimos seis meses', 'Entradas contra salidas',
        G.barras(serie, { etiquetaA: 'Entra', etiquetaB: 'Sale' }))}</div>
      <div>${Bloque.tarjeta('Movimientos recientes', null,
        recientes.length
          ? '<div class="renglones">' + recientes.map(m => `
              <div class="renglon-item">
                <div>
                  <p class="renglon-tit">${U.esc(m.descripcion)}</p>
                  <p class="renglon-sub">${U.esc(Store.nombreCategoria(m.categoriaId))} · ${U.esc(U.fecha(m.fecha))}</p>
                </div>
                <span class="renglon-cifra ${m.tipo === 'ingreso' ? 'pos' : 'neg'}">
                  ${m.tipo === 'ingreso' ? '+' : '−'}${U.dinero(m.monto)}
                </span>
              </div>`).join('') + '</div>'
          : '<p class="vacio-texto">Nada registrado este mes todavía.</p>')}
      </div>
    </div>`;

    cont.innerHTML = html;
  }
};

/* ============================================================
   MOVIMIENTOS
   ============================================================ */
Vistas.movimientos = {
  eyebrow: 'Registro',
  titulo: 'Movimientos',
  render(cont, ctx) {
    const cats = Store.lista('categorias');
    let filtroTipo = 'todos', filtroCat = 'todas', busqueda = '';

    const filtros = U.el('div', { class: 'filtros' });
    filtros.innerHTML = `
      <select id="fTipo">
        <option value="todos">Todo</option>
        <option value="ingreso">Solo entradas</option>
        <option value="gasto">Solo salidas</option>
      </select>
      <select id="fCat">
        <option value="todas">Todas las categorías</option>
        ${cats.map(c => `<option value="${U.esc(c.id)}">${U.esc(c.nombre)}</option>`).join('')}
      </select>
      <input type="search" id="fBuscar" placeholder="Buscar concepto…">
      <span class="filtro-espacio"></span>
      <button class="btn btn-fantasma btn-chico" id="btnCsv">Descargar CSV</button>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevo">Registrar movimiento</button>`;

    const zona = U.el('div');

    function pintar() {
      let filas = Calc.movimientosDe(ctx.mes);
      if (filtroTipo !== 'todos') filas = filas.filter(m => m.tipo === filtroTipo);
      if (filtroCat !== 'todas') filas = filas.filter(m => m.categoriaId === filtroCat);
      if (busqueda) {
        const q = busqueda.toLowerCase();
        filas = filas.filter(m => String(m.descripcion || '').toLowerCase().includes(q));
      }

      const entra = filas.filter(f => f.tipo === 'ingreso').reduce((a, f) => a + U.n(f.monto), 0);
      const sale = filas.filter(f => f.tipo === 'gasto').reduce((a, f) => a + U.n(f.monto), 0);

      zona.innerHTML = `<div class="rejilla r3" style="margin-bottom:var(--e4)">
        ${Bloque.metrica('Entró', U.dinero(entra), `${filas.filter(f => f.tipo === 'ingreso').length} registros`, 'jade')}
        ${Bloque.metrica('Salió', U.dinero(sale), `${filas.filter(f => f.tipo === 'gasto').length} registros`, 'barro')}
        ${Bloque.metrica('Diferencia', U.dinero(entra - sale), U.nombreMes(ctx.mes), entra - sale >= 0 ? 'jade' : 'barro')}
      </div>`;

      if (!filas.length) {
        zona.appendChild(U.vacio(
          'Sin movimientos que mostrar',
          'Cambiá los filtros o registrá el primer movimiento del mes.',
          'Registrar movimiento', () => Acciones.movimiento(null, ctx)));
        return;
      }

      const cols = [
        { t: 'Fecha', k: 'fecha', tipo: 'fecha', ancho: '110px' },
        { t: 'Concepto', k: 'descripcion', tipo: 'html', render: f =>
            U.esc(f.descripcion) + (U.n(f.ediciones) > 0 ? ' ' + U.chip('editado', 'ocre') : '') },
        { t: 'Categoría', k: 'cat', tipo: 'html', render: f => {
            const c = Store.categoria(f.categoriaId);
            return `<span class="chip" style="background:${c ? c.color + '22' : 'var(--papel-3)'};color:${c ? c.color : 'var(--texto-2)'}">${U.esc(c ? c.nombre : 'Sin categoría')}</span>`;
          } }
      ];
      if (Store.esEmpresa()) cols.push({ t: 'Centro', k: 'centroCosto', tipo: 'html',
        render: f => U.esc(f.centroCosto || '—') });
      cols.push({ t: 'Monto', k: 'monto', tipo: 'html', alinear: 'der', render: f =>
        `<span class="cifra ${f.tipo === 'ingreso' ? 'pos' : 'neg'}">${f.tipo === 'ingreso' ? '+' : '−'}${U.dinero(f.monto)}</span>` });

      zona.appendChild(U.tabla(cols, filas, [
        { etiqueta: 'Cambios', fn: f => Acciones.verCambios(f) },
        { etiqueta: 'Editar', fn: f => Acciones.movimiento(f, ctx) },
        { etiqueta: 'Eliminar', clase: 'peligro', fn: f => Acciones.eliminarMovimiento(f, ctx) }
      ]));
    }

    cont.appendChild(filtros);
    cont.appendChild(zona);
    pintar();

    U.$('#fTipo', filtros).onchange = e => { filtroTipo = e.target.value; pintar(); };
    U.$('#fCat', filtros).onchange = e => { filtroCat = e.target.value; pintar(); };
    U.$('#fBuscar', filtros).oninput = e => { busqueda = e.target.value.trim(); pintar(); };
    U.$('#btnNuevo', filtros).onclick = () => Acciones.movimiento(null, ctx);
    U.$('#btnCsv', filtros).onclick = () => {
      const filas = Calc.movimientosDe(ctx.mes).map(m => ({
        fecha: m.fecha, tipo: m.tipo, concepto: m.descripcion,
        categoria: Store.nombreCategoria(m.categoriaId),
        centro: m.centroCosto || '', monto: U.n(m.monto).toFixed(2)
      }));
      U.csv(`movimientos-${ctx.mes}.csv`, [
        { t: 'Fecha', k: 'fecha' }, { t: 'Tipo', k: 'tipo' }, { t: 'Concepto', k: 'concepto' },
        { t: 'Categoría', k: 'categoria' }, { t: 'Centro de costo', k: 'centro' }, { t: 'Monto', k: 'monto' }
      ], filas);
    };
  }
};

/* ============================================================
   CATEGORÍAS
   ============================================================ */
Vistas.categorias = {
  eyebrow: 'Configuración',
  titulo: 'Categorías',
  render(cont, ctx) {
    const cats = Store.lista('categorias');

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar categoría' : 'Nueva categoría',
        campos: [
          { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto', req: true, ancho: 'completo' },
          { k: 'clase', etiqueta: 'Sirve para', tipo: 'select', req: true,
            opciones: [{ v: 'gasto', t: 'Salidas' }, { v: 'ingreso', t: 'Entradas' }] },
          { k: 'color', etiqueta: 'Color (hex)', tipo: 'texto', req: true, valor: '#B06C15', ph: '#B06C15' }
        ],
        valores: existente
      });
      if (!r) return;
      if (!/^#[0-9A-Fa-f]{6}$/.test(r.color)) r.color = '#7C8C86';
      if (existente) r.id = existente.id;
      await Store.guardar('categorias', r);
      U.toast('Categoría guardada.', 'ok');
      ctx.refrescar();
    }

    async function eliminar(c) {
      const enUso = Store.lista('movimientos').filter(m => m.categoriaId === c.id).length;
      const ok = await U.confirmar(enUso
        ? `"${c.nombre}" tiene ${enUso} movimientos. Se quedarán sin categoría. ¿Eliminar igual?`
        : `¿Eliminar la categoría "${c.nombre}"?`);
      if (!ok) return;
      await Store.borrar('categorias', c.id);
      U.toast('Categoría eliminada.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevaCat">Nueva categoría</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevaCat', barra).onclick = () => editar(null);

    if (!cats.length) {
      cont.appendChild(U.vacio('Sin categorías', 'Creá la primera para poder clasificar tus movimientos.',
        'Nueva categoría', () => editar(null)));
      return;
    }

    ['ingreso', 'gasto'].forEach(clase => {
      const grupo = cats.filter(c => c.clase === clase);
      if (!grupo.length) return;
      const filas = grupo.map(c => {
        const usadas = Store.lista('movimientos').filter(m => m.categoriaId === c.id);
        const total = usadas.reduce((a, m) => a + U.n(m.monto), 0);
        return Object.assign({}, c, { veces: usadas.length, total });
      }).sort((a, b) => b.total - a.total);

      const seccion = U.el('section', { class: 'tarjeta' });
      seccion.innerHTML = `<div class="tarjeta-cabeza">
          <h3>${clase === 'ingreso' ? 'Entradas' : 'Salidas'}</h3>
          <span class="tarjeta-nota">${grupo.length} categorías</span>
        </div>`;
      seccion.appendChild(U.tabla([
        { t: 'Categoría', k: 'nombre', tipo: 'html', render: f =>
          `<span style="display:inline-flex;align-items:center;gap:8px">
             <span style="width:11px;height:11px;border-radius:3px;background:${f.color}"></span>
             ${U.esc(f.nombre)}</span>` },
        { t: 'Movimientos', k: 'veces', alinear: 'der' },
        { t: 'Acumulado histórico', k: 'total', tipo: 'dinero', alinear: 'der' }
      ], filas, [
        { etiqueta: 'Editar', fn: f => editar(f) },
        { etiqueta: 'Borrar', clase: 'peligro', fn: f => eliminar(f) }
      ]));
      cont.appendChild(seccion);
    });
  }
};

/* ============================================================
   PRESUPUESTO
   ============================================================ */
Vistas.presupuesto = {
  eyebrow: 'Control',
  titulo: 'Presupuesto',
  render(cont, ctx) {
    const avance = Calc.avancePresupuestos(ctx.mes);
    const cats = Store.lista('categorias').filter(c => c.clase === 'gasto');

    async function editar(existente) {
      if (!cats.length) return U.toast('Creá primero una categoría de salidas.', 'mal');
      const r = await U.formulario({
        titulo: existente ? 'Editar tope' : 'Nuevo tope de gasto',
        subtitulo: 'Definí cuánto es lo máximo que querés gastar en esa categoría durante el mes.',
        campos: [
          { k: 'categoriaId', etiqueta: 'Categoría', tipo: 'select', req: true, ancho: 'completo',
            opciones: cats.map(c => ({ v: c.id, t: c.nombre })) },
          { k: 'monto', etiqueta: 'Tope mensual', tipo: 'numero', req: true },
          { k: 'mes', etiqueta: 'Mes', tipo: 'mes', req: true, valor: ctx.mes }
        ],
        valores: existente ? { categoriaId: existente.categoriaId, monto: existente.tope, mes: ctx.mes } : null
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('presupuestos', r);
      U.toast('Tope guardado.', 'ok');
      ctx.refrescar();
    }

    const totalTope = avance.reduce((a, p) => a + p.tope, 0);
    const totalUsado = avance.reduce((a, p) => a + p.usado, 0);

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevoTope">Nuevo tope</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevoTope', barra).onclick = () => editar(null);

    if (!avance.length) {
      cont.appendChild(U.vacio(
        'Sin presupuesto para ' + U.nombreMes(ctx.mes),
        'Poné un tope a las categorías donde más se te va el dinero. Te avisamos cuando te acerques.',
        'Poner el primer tope', () => editar(null)));
      return;
    }

    const resumen = U.el('div', { class: 'rejilla r3' });
    resumen.innerHTML = `
      ${Bloque.metrica('Presupuestado', U.dinero(totalTope), `${avance.length} categorías`, 'tinta')}
      ${Bloque.metrica('Gastado', U.dinero(totalUsado), `${U.pct(totalUsado, totalTope)}% del total`,
        totalUsado > totalTope ? 'barro' : 'ocre')}
      ${Bloque.metrica('Disponible', U.dinero(totalTope - totalUsado),
        totalTope - totalUsado >= 0 ? 'Te queda margen' : 'Ya te pasaste',
        totalTope - totalUsado >= 0 ? 'jade' : 'barro')}`;
    cont.appendChild(resumen);

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = `<div class="tarjeta-cabeza">
      <h3>Tope por categoría</h3>
      <span class="tarjeta-nota">${U.nombreMes(ctx.mes)}</span></div>`;

    const lista = U.el('div', { class: 'renglones' });
    avance.forEach(p => {
      const tono = p.estado === 'excedido' ? 'barro' : p.estado === 'cerca' ? 'aviso' : 'jade';
      const item = U.el('div', { class: 'renglon-item' });
      item.style.gridTemplateColumns = '1fr';
      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;gap:8px">
            <span style="width:11px;height:11px;border-radius:3px;background:${p.color}"></span>
            <b class="renglon-tit">${U.esc(p.nombre)}</b>
            ${p.estado === 'excedido' ? U.chip('Excedido', 'barro')
              : p.estado === 'cerca' ? U.chip('Cerca del tope', 'aviso') : ''}
          </span>
          <span class="renglon-cifra">
            <b>${U.dinero(p.usado)}</b>
            <span style="color:var(--texto-3);font-size:var(--t-sm)"> / ${U.dinero(p.tope)}</span>
          </span>
        </div>
        <div style="margin-top:8px">${U.barra(p.pct, tono)}</div>
        <p class="renglon-sub" style="margin-top:6px">
          ${p.restante >= 0
            ? `Te quedan ${U.dinero(p.restante)} · ${p.pct}% usado`
            : `Te pasaste por ${U.dinero(-p.restante)} · ${p.pct}% usado`}
        </p>`;
      const acc = U.el('div', { class: 'filtros' });
      acc.style.marginTop = '8px';
      acc.innerHTML = `<button class="btn-icono">Editar</button>
                       <button class="btn-icono peligro">Quitar</button>`;
      const [bEd, bDel] = U.$$('button', acc);
      bEd.onclick = () => editar(p);
      bDel.onclick = () => Acciones.borrar('presupuestos', p, ctx, `¿Quitar el tope de "${p.nombre}"?`);
      item.appendChild(acc);
      lista.appendChild(item);
    });

    seccion.appendChild(lista);
    cont.appendChild(seccion);
  }
};

/* ============================================================
   METAS
   ============================================================ */
Vistas.metas = {
  eyebrow: 'Ahorro',
  titulo: 'Metas',
  render(cont, ctx) {
    const metas = Calc.avanceMetas();

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar meta' : 'Nueva meta de ahorro',
        subtitulo: 'Ponele fecha y te decimos cuánto tenés que apartar cada mes.',
        campos: [
          { k: 'nombre', etiqueta: '¿Para qué es?', tipo: 'texto', req: true, ancho: 'completo',
            ph: 'Ej. Comprar vitrina nueva' },
          { k: 'objetivo', etiqueta: 'Cuánto necesitás', tipo: 'numero', req: true },
          { k: 'ahorrado', etiqueta: 'Ya llevás', tipo: 'numero', valor: 0 },
          { k: 'fechaLimite', etiqueta: 'Para cuándo', tipo: 'fecha', ancho: 'completo' }
        ],
        valores: existente
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('metas', r);
      U.toast('Meta guardada.', 'ok');
      ctx.refrescar();
    }

    async function abonar(m) {
      const r = await U.formulario({
        titulo: `Abonar a "${m.nombre}"`,
        subtitulo: `Llevás ${U.dinero(m.ahorrado)} de ${U.dinero(m.objetivo)}.`,
        campos: [{ k: 'monto', etiqueta: 'Cuánto abonás', tipo: 'numero', req: true, ancho: 'completo' }],
        textoOk: 'Abonar'
      });
      if (!r) return;
      await Store.guardar('metas', Object.assign({}, m, { ahorrado: U.n(m.ahorrado) + U.n(r.monto) }));
      U.toast('Abono registrado.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevaMeta">Nueva meta</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevaMeta', barra).onclick = () => editar(null);

    if (!metas.length) {
      cont.appendChild(U.vacio('Sin metas todavía',
        'Una meta es cualquier cosa que querés comprar o cubrir: un equipo, un viaje, un fondo de emergencia.',
        'Crear la primera meta', () => editar(null)));
      return;
    }

    const totalObjetivo = metas.reduce((a, m) => a + U.n(m.objetivo), 0);
    const totalAhorrado = metas.reduce((a, m) => a + U.n(m.ahorrado), 0);

    const resumen = U.el('div', { class: 'rejilla r3' });
    resumen.innerHTML = `
      ${Bloque.metrica('Metas activas', String(metas.filter(m => !m.lograda).length),
        `${metas.filter(m => m.lograda).length} ya logradas`, 'tinta')}
      ${Bloque.metrica('Ya ahorrado', U.dinero(totalAhorrado), `${U.pct(totalAhorrado, totalObjetivo)}% del total`, 'jade')}
      ${Bloque.metrica('Falta', U.dinero(Math.max(0, totalObjetivo - totalAhorrado)),
        `De ${U.dinero(totalObjetivo)} en total`, 'ocre')}`;
    cont.appendChild(resumen);

    const rejilla = U.el('div', { class: 'rejilla r2' });
    metas.forEach(m => {
      const tarjeta = U.el('section', { class: 'tarjeta' });
      tarjeta.innerHTML = `
        <div class="tarjeta-cabeza">
          <h3>${U.esc(m.nombre)}</h3>
          ${m.lograda ? U.chip('Lograda', 'jade')
            : m.diasRestantes !== null && m.diasRestantes < 0 ? U.chip('Fecha pasada', 'barro')
            : m.diasRestantes !== null ? U.chip(`${m.diasRestantes} días`, 'ocre') : ''}
        </div>
        <p class="metrica-val" style="font-size:var(--t-xl)">${U.dinero(m.ahorrado)}
          <span style="font-size:var(--t-md);color:var(--texto-3)"> / ${U.dinero(m.objetivo)}</span></p>
        ${U.barra(m.pct, m.lograda ? 'jade' : 'ocre')}
        <p class="renglon-sub" style="margin-top:8px">
          ${m.lograda ? '¡Llegaste! Ya podés usar este ahorro.'
            : m.porMes ? `Apartá ${U.dinero(m.porMes)} al mes para llegar a tiempo. Faltan ${U.dinero(m.falta)}.`
            : `Faltan ${U.dinero(m.falta)}. Ponele fecha para calcular cuánto apartar por mes.`}
        </p>`;
      const acc = U.el('div', { class: 'filtros' });
      acc.style.marginTop = 'var(--e3)';
      acc.innerHTML = `<button class="btn btn-fantasma btn-chico">Abonar</button>
        <button class="btn-icono">Editar</button>
        <button class="btn-icono peligro">Borrar</button>`;
      const bs = U.$$('button', acc);
      bs[0].onclick = () => abonar(m);
      bs[1].onclick = () => editar(m);
      bs[2].onclick = () => Acciones.borrar('metas', m, ctx, `¿Eliminar la meta "${m.nombre}"?`);
      tarjeta.appendChild(acc);
      rejilla.appendChild(tarjeta);
    });
    cont.appendChild(rejilla);
  }
};

/* ============================================================
   REPORTES
   ============================================================ */
Vistas.reportes = {
  eyebrow: 'Análisis',
  titulo: 'Reportes',
  render(cont, ctx) {
    const t = Calc.totales(ctx.mes);
    const gastos = Calc.porCategoria(ctx.mes, 'gasto');
    const ingresos = Calc.porCategoria(ctx.mes, 'ingreso');
    const serie = Calc.serieMensual(12);
    const empresa = Store.esEmpresa();

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-fantasma btn-chico" id="btnImprimir">Imprimir o guardar en PDF</button>`;
    cont.appendChild(barra);
    U.$('#btnImprimir', barra).onclick = () => window.print();

    let html = `<div class="rejilla r4">
      ${Bloque.metrica('Entró', U.dinero(t.entra), U.nombreMes(ctx.mes), 'jade')}
      ${Bloque.metrica('Salió', U.dinero(t.sale), U.nombreMes(ctx.mes), 'barro')}
      ${Bloque.metrica('Diferencia', U.dinero(t.saldo), t.saldo >= 0 ? 'A favor' : 'En contra', t.saldo >= 0 ? 'jade' : 'barro')}
      ${Bloque.metrica('Tasa de ahorro', (t.entra ? U.pct(t.saldo, t.entra) : 0) + '%',
        'De cada dólar que entra', 'ocre')}
    </div>`;

    html += Bloque.tarjeta('Doce meses de historia', 'Entradas contra salidas',
      G.barras(serie, { alto: 240 }));

    html += `<div class="rejilla r2">
      ${Bloque.tarjeta('Salidas por categoría', U.nombreMes(ctx.mes),
        gastos.length ? G.dona(gastos, { centroTitulo: 'Salidas', centroValor: U.dinero(t.sale) }) + G.leyenda(gastos)
                      : '<p class="vacio-texto">Sin salidas este mes.</p>')}
      ${Bloque.tarjeta('Entradas por categoría', U.nombreMes(ctx.mes),
        ingresos.length ? G.dona(ingresos, { centroTitulo: 'Entradas', centroValor: U.dinero(t.entra) }) + G.leyenda(ingresos)
                        : '<p class="vacio-texto">Sin entradas este mes.</p>')}
    </div>`;

    if (empresa) {
      const cc = Calc.porCentroCosto(ctx.mes);
      html += Bloque.tarjeta('Gasto por centro de costo',
        'Dónde se consume el dinero dentro del negocio',
        cc.length ? G.ranking(cc) : '<p class="vacio-texto">Asigná centro de costo a tus gastos para ver este reporte.</p>');
    }

    /* Comparación con el mes anterior */
    const mesAnterior = U.mesDe(U.sumarDias(ctx.mes + '-01', -1));
    const ta = Calc.totales(mesAnterior);
    const dif = t.sale - ta.sale;
    html += Bloque.tarjeta('Comparación con ' + U.nombreMes(mesAnterior), null,
      `<div class="renglones">
        <div class="renglon-item"><div><p class="renglon-tit">Entradas</p>
          <p class="renglon-sub">${U.dinero(ta.entra)} el mes pasado</p></div>
          <span class="renglon-cifra ${t.entra >= ta.entra ? 'pos' : 'neg'}">${U.dinero(t.entra - ta.entra, true)}</span></div>
        <div class="renglon-item"><div><p class="renglon-tit">Salidas</p>
          <p class="renglon-sub">${U.dinero(ta.sale)} el mes pasado</p></div>
          <span class="renglon-cifra ${dif <= 0 ? 'pos' : 'neg'}">${U.dinero(dif, true)}</span></div>
        <div class="renglon-item"><div><p class="renglon-tit">Diferencia final</p>
          <p class="renglon-sub">${U.dinero(ta.saldo)} el mes pasado</p></div>
          <span class="renglon-cifra ${t.saldo >= ta.saldo ? 'pos' : 'neg'}">${U.dinero(t.saldo - ta.saldo, true)}</span></div>
      </div>`);

    cont.insertAdjacentHTML('beforeend', html);
  }
};

/* ============================================================
   ALERTAS
   ============================================================ */
Vistas.alertas = {
  eyebrow: 'Vigilancia',
  titulo: 'Alertas',
  render(cont, ctx) {
    const alertas = Calc.alertas();

    const intro = U.el('section', { class: 'tarjeta' });
    intro.innerHTML = `<div class="tarjeta-cabeza">
        <h3>${alertas.length ? `${alertas.length} ${alertas.length === 1 ? 'aviso' : 'avisos'} abiertos` : 'Todo en orden'}</h3>
        <span class="tarjeta-nota">Se recalculan con cada movimiento que registrás</span>
      </div>
      <p class="renglon-sub" style="margin-bottom:var(--e3)">
        Estas alertas salen de tus propios números: presupuestos, cobros, pagos, stock y caja.
      </p>
      ${Bloque.listaAlertas()}`;
    cont.appendChild(intro);

    /* Qué se está vigilando */
    const reglas = [
      ['Gasto contra ingreso', 'Avisa cuando en el mes sale más dinero del que entra.'],
      ['Presupuesto por categoría', `Avisa al llegar al ${APP.umbrales.presupuestoAviso}% del tope y cuando lo pasás.`]
    ];
    if (Store.esEmpresa()) {
      reglas.push(
        ['Días de caja', `Avisa cuando quedan ${APP.umbrales.diasCajaCritico} días o menos de saldo proyectado.`],
        ['Facturas vencidas', 'Avisa por cada cobro que pasó su fecha de vencimiento.'],
        ['Pagos próximos', 'Avisa por los compromisos que vencen dentro de 7 días.'],
        ['Stock mínimo', 'Avisa cuando un producto baja al nivel mínimo que definiste.'],
        ['Punto de equilibrio', 'Avisa mientras las ventas del mes no cubran los gastos fijos.'],
        ['Margen bruto', 'Avisa si el margen cae por debajo del 15%.']
      );
    } else {
      reglas.push(['Metas con fecha', 'Avisa cuando a una meta le quedan menos de 30 días.']);
    }

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = `<div class="tarjeta-cabeza"><h3>Qué se está vigilando</h3></div>
      <div class="renglones">${reglas.map(r => `
        <div class="renglon-item">
          <div><p class="renglon-tit">${U.esc(r[0])}</p><p class="renglon-sub">${U.esc(r[1])}</p></div>
          <span class="chip chip-jade">Activa</span>
        </div>`).join('')}</div>`;
    cont.appendChild(seccion);
  }
};
