/* ============================================================
   VISTAS EXCLUSIVAS DE LA CUENTA EMPRESARIAL
   ============================================================ */

/* ============================================================
   CLIENTES
   ============================================================ */
Vistas.clientes = {
  eyebrow: 'Directorio',
  titulo: 'Clientes',
  render(cont, ctx) {
    const clientes = Store.lista('clientes');

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar cliente' : 'Nuevo cliente',
        campos: [
          { k: 'nombre', etiqueta: 'Nombre o razón social', tipo: 'texto', req: true, ancho: 'completo' },
          { k: 'contacto', etiqueta: 'Persona de contacto', tipo: 'texto' },
          { k: 'telefono', etiqueta: 'Teléfono', tipo: 'texto', ph: '7000-0000' },
          { k: 'correo', etiqueta: 'Correo', tipo: 'texto' },
          { k: 'nit', etiqueta: 'NIT o documento', tipo: 'texto' },
          { k: 'notas', etiqueta: 'Notas', tipo: 'area', ancho: 'completo' }
        ],
        valores: existente
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('clientes', r);
      U.toast('Cliente guardado.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevoCliente">Nuevo cliente</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevoCliente', barra).onclick = () => editar(null);

    if (!clientes.length) {
      cont.appendChild(U.vacio('Sin clientes registrados',
        'Guardá a quién le vendés para poder emitir facturas y llevar el control de lo que te deben.',
        'Agregar el primer cliente', () => editar(null)));
      return;
    }

    const filas = clientes.map(c => Object.assign({}, c, {
      deuda: Calc.saldoCliente(c.id),
      historico: Calc.ventasCliente(c.id)
    })).sort((a, b) => b.deuda - a.deuda);

    const totalDeuda = filas.reduce((a, f) => a + f.deuda, 0);
    const conDeuda = filas.filter(f => f.deuda > 0).length;

    const resumen = U.el('div', { class: 'rejilla r3' });
    resumen.innerHTML = `
      ${Bloque.metrica('Clientes', String(clientes.length), 'En el directorio', 'tinta')}
      ${Bloque.metrica('Te deben', U.dinero(totalDeuda), `${conDeuda} con saldo abierto`, 'ocre')}
      ${Bloque.metrica('Vendido histórico', U.dinero(filas.reduce((a, f) => a + f.historico, 0)),
        'Suma de todas las facturas', 'jade')}`;
    cont.appendChild(resumen);

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = '<div class="tarjeta-cabeza"><h3>Directorio</h3></div>';
    seccion.appendChild(U.tabla([
      { t: 'Cliente', k: 'nombre' },
      { t: 'Contacto', k: 'contacto', tipo: 'html', render: f =>
        U.esc(f.contacto || '—') + (f.telefono ? `<br><span style="color:var(--texto-3);font-size:var(--t-xs)">${U.esc(f.telefono)}</span>` : '') },
      { t: 'Vendido', k: 'historico', tipo: 'dinero', alinear: 'der' },
      { t: 'Debe', k: 'deuda', tipo: 'html', alinear: 'der', render: f =>
        f.deuda > 0 ? `<span class="cifra neg">${U.dinero(f.deuda)}</span>` : '<span class="chip chip-jade">Al día</span>' }
    ], filas, [
      { etiqueta: 'Editar', fn: f => editar(f) },
      { etiqueta: 'Borrar', clase: 'peligro', fn: f => Acciones.borrar('clientes', f, ctx, `¿Eliminar a "${f.nombre}"?`) }
    ]));
    cont.appendChild(seccion);
  }
};

/* ============================================================
   PROVEEDORES
   ============================================================ */
Vistas.proveedores = {
  eyebrow: 'Directorio',
  titulo: 'Proveedores',
  render(cont, ctx) {
    const provs = Store.lista('proveedores');

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar proveedor' : 'Nuevo proveedor',
        campos: [
          { k: 'nombre', etiqueta: 'Nombre del proveedor', tipo: 'texto', req: true, ancho: 'completo' },
          { k: 'contacto', etiqueta: 'Persona de contacto', tipo: 'texto' },
          { k: 'telefono', etiqueta: 'Teléfono', tipo: 'texto' },
          { k: 'suministra', etiqueta: 'Qué suministra', tipo: 'texto', ancho: 'completo' },
          { k: 'plazo', etiqueta: 'Plazo de crédito (días)', tipo: 'numero', valor: 0 },
          { k: 'notas', etiqueta: 'Notas', tipo: 'area', ancho: 'completo' }
        ],
        valores: existente
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('proveedores', r);
      U.toast('Proveedor guardado.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevoProv">Nuevo proveedor</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevoProv', barra).onclick = () => editar(null);

    if (!provs.length) {
      cont.appendChild(U.vacio('Sin proveedores registrados',
        'Guardá a quién le comprás para poder registrar tus cuentas por pagar.',
        'Agregar el primer proveedor', () => editar(null)));
      return;
    }

    const filas = provs.map(p => Object.assign({}, p, {
      deuda: Store.lista('obligaciones')
        .filter(o => o.proveedorId === p.id && o.estado === 'Pendiente')
        .reduce((a, o) => a + U.n(o.monto), 0)
    })).sort((a, b) => b.deuda - a.deuda);

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = `<div class="tarjeta-cabeza"><h3>Directorio</h3>
      <span class="tarjeta-nota">Les debés ${U.dinero(filas.reduce((a, f) => a + f.deuda, 0))}</span></div>`;
    seccion.appendChild(U.tabla([
      { t: 'Proveedor', k: 'nombre' },
      { t: 'Suministra', k: 'suministra', tipo: 'html', render: f => U.esc(f.suministra || '—') },
      { t: 'Contacto', k: 'telefono', tipo: 'html', render: f => U.esc(f.telefono || '—') },
      { t: 'Plazo', k: 'plazo', tipo: 'html', alinear: 'der', render: f =>
        U.n(f.plazo) ? `${U.n(f.plazo)} días` : 'Contado' },
      { t: 'Le debés', k: 'deuda', tipo: 'html', alinear: 'der', render: f =>
        f.deuda > 0 ? `<span class="cifra neg">${U.dinero(f.deuda)}</span>` : '<span class="chip chip-jade">Al día</span>' }
    ], filas, [
      { etiqueta: 'Editar', fn: f => editar(f) },
      { etiqueta: 'Borrar', clase: 'peligro', fn: f => Acciones.borrar('proveedores', f, ctx, `¿Eliminar a "${f.nombre}"?`) }
    ]));
    cont.appendChild(seccion);
  }
};

/* ============================================================
   CUENTAS POR COBRAR
   ============================================================ */
Vistas.cobrar = {
  eyebrow: 'Cartera',
  titulo: 'Por cobrar',
  render(cont, ctx) {
    const clientes = Store.lista('clientes');
    const facturas = Store.lista('facturas');

    async function editar(existente) {
      if (!clientes.length) {
        U.toast('Registrá primero un cliente.', 'mal');
        location.hash = '#/clientes';
        return;
      }
      const r = await U.formulario({
        titulo: existente ? 'Editar factura' : 'Nueva factura',
        subtitulo: 'Lo que ya vendiste pero todavía no te pagan.',
        campos: [
          { k: 'numero', etiqueta: 'Número', tipo: 'texto', req: true, ph: '0001' },
          { k: 'clienteId', etiqueta: 'Cliente', tipo: 'select', req: true,
            opciones: clientes.map(c => ({ v: c.id, t: c.nombre })) },
          { k: 'concepto', etiqueta: 'Concepto', tipo: 'texto', ancho: 'completo' },
          { k: 'monto', etiqueta: 'Monto', tipo: 'numero', req: true },
          { k: 'emitida', etiqueta: 'Fecha de emisión', tipo: 'fecha', req: true, valor: U.hoy() },
          { k: 'vence', etiqueta: 'Vence el', tipo: 'fecha', req: true, valor: U.sumarDias(U.hoy(), 30) },
          { k: 'estado', etiqueta: 'Estado', tipo: 'select', req: true, opciones: APP.estadosFactura }
        ],
        valores: existente || { estado: 'Pendiente' }
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('facturas', r);
      U.toast('Factura guardada.', 'ok');
      ctx.refrescar();
    }

    /* Marcar como cobrada registra además el ingreso en movimientos */
    async function cobrar(f) {
      const catVentas = Store.lista('categorias').find(c => c.clase === 'ingreso');
      const ok = await U.confirmar(
        `¿Marcar la factura ${f.numero} como pagada? Se registra un ingreso de ${U.dinero(f.monto)}.`, 'Marcar pagada');
      if (!ok) return;
      await Store.guardar('facturas', Object.assign({}, f, { estado: 'Pagada', pagada: U.hoy() }));
      if (catVentas) {
        const mov = await Store.guardar('movimientos', {
          tipo: 'ingreso', monto: U.n(f.monto), fecha: U.hoy(),
          descripcion: `Cobro factura ${f.numero}`,
          categoriaId: catVentas.id, centroCosto: 'Ventas',
          creadoEn: U.ahora(), ediciones: 0,
          /* Sprint 2: enlace al documento, para mantener la consistencia
             si después se elimina o restaura este ingreso */
          origen: { coleccion: 'facturas', id: f.id, texto: `la factura ${f.numero}` }
        });
        await Bitacora.registrar('creado', mov);
      }
      U.toast('Cobro registrado.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevaFac">Nueva factura</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevaFac', barra).onclick = () => editar(null);

    if (!facturas.length) {
      cont.appendChild(U.vacio('Sin facturas registradas',
        'Registrá lo que vendiste a crédito. La app calcula la antigüedad de la cartera y avisa cuando algo se vence.',
        'Registrar la primera factura', () => editar(null)));
      return;
    }

    const abiertas = Calc.facturasAbiertas();
    const vencidas = abiertas.filter(Calc.vencida);
    const tramos = Calc.antiguedad(abiertas);

    const resumen = U.el('div', { class: 'rejilla r4' });
    resumen.innerHTML = `
      ${Bloque.metrica('Total por cobrar', U.dinero(Calc.porCobrar()), `${abiertas.length} facturas abiertas`, 'ocre')}
      ${Bloque.metrica('Vencido', U.dinero(vencidas.reduce((a, f) => a + U.n(f.monto), 0)),
        `${vencidas.length} facturas pasadas de fecha`, 'barro')}
      ${Bloque.metrica('Cobrado', U.dinero(facturas.filter(f => f.estado === 'Pagada').reduce((a, f) => a + U.n(f.monto), 0)),
        'Histórico', 'jade')}
      ${Bloque.metrica('Factura promedio', U.dinero(facturas.reduce((a, f) => a + U.n(f.monto), 0) / facturas.length),
        `${facturas.length} en total`, 'tinta')}`;
    cont.appendChild(resumen);

    if (tramos.length) {
      cont.insertAdjacentHTML('beforeend', Bloque.tarjeta(
        'Antigüedad de la cartera',
        'Cuánto te deben y desde hace cuánto',
        G.ranking(tramos)));
    }

    const filas = facturas.map(f => Object.assign({}, f, {
      cliente: (clientes.find(c => c.id === f.clienteId) || {}).nombre || 'Cliente eliminado',
      dias: Calc.diasVencida(f)
    })).sort((a, b) => (a.vence < b.vence ? -1 : 1));

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = '<div class="tarjeta-cabeza"><h3>Facturas</h3></div>';
    seccion.appendChild(U.tabla([
      { t: 'N.º', k: 'numero', ancho: '80px' },
      { t: 'Cliente', k: 'cliente' },
      { t: 'Vence', k: 'vence', tipo: 'html', render: f => {
          if (f.estado !== 'Pendiente') return U.fecha(f.vence);
          if (f.dias > 0) return `${U.fecha(f.vence)}<br>${U.chip(`${f.dias} días vencida`, 'barro')}`;
          return `${U.fecha(f.vence)}<br><span style="color:var(--texto-3);font-size:var(--t-xs)">en ${-f.dias} días</span>`;
        } },
      { t: 'Estado', k: 'estado', tipo: 'html', render: f =>
        U.chip(f.estado, f.estado === 'Pagada' ? 'jade' : f.estado === 'Anulada' ? 'neutro' : Calc.vencida(f) ? 'barro' : 'ocre') },
      { t: 'Monto', k: 'monto', tipo: 'dinero', alinear: 'der' }
    ], filas, [
      { etiqueta: 'Cobrar', fn: f => f.estado === 'Pendiente' ? cobrar(f) : U.toast('Esa factura ya no está pendiente.') },
      { etiqueta: 'Editar', fn: f => editar(f) },
      { etiqueta: 'Borrar', clase: 'peligro', fn: f => Acciones.borrar('facturas', f, ctx, `¿Eliminar la factura ${f.numero}?`) }
    ]));
    cont.appendChild(seccion);
  }
};

/* ============================================================
   CUENTAS POR PAGAR
   ============================================================ */
Vistas.pagar = {
  eyebrow: 'Compromisos',
  titulo: 'Por pagar',
  render(cont, ctx) {
    const provs = Store.lista('proveedores');
    const obligaciones = Store.lista('obligaciones');
    const catsGasto = Store.lista('categorias').filter(c => c.clase === 'gasto');

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar compromiso' : 'Nuevo compromiso de pago',
        subtitulo: 'Todo lo que tenés que pagar y en qué fecha.',
        campos: [
          { k: 'concepto', etiqueta: 'Concepto', tipo: 'texto', req: true, ancho: 'completo',
            ph: 'Ej. Compra de mercadería, alquiler de agosto' },
          { k: 'proveedorId', etiqueta: 'Proveedor', tipo: 'select',
            opciones: [{ v: '', t: 'Sin proveedor' }].concat(provs.map(p => ({ v: p.id, t: p.nombre }))) },
          { k: 'categoriaId', etiqueta: 'Categoría de gasto', tipo: 'select',
            opciones: [{ v: '', t: 'Sin categoría' }].concat(catsGasto.map(c => ({ v: c.id, t: c.nombre }))) },
          { k: 'monto', etiqueta: 'Monto', tipo: 'numero', req: true },
          { k: 'vence', etiqueta: 'Vence el', tipo: 'fecha', req: true, valor: U.hoy() },
          { k: 'estado', etiqueta: 'Estado', tipo: 'select', req: true,
            opciones: [{ v: 'Pendiente', t: 'Pendiente' }, { v: 'Pagada', t: 'Pagada' }] }
        ],
        valores: existente || { estado: 'Pendiente' }
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('obligaciones', r);
      U.toast('Compromiso guardado.', 'ok');
      ctx.refrescar();
    }

    /* Pagar registra el gasto en movimientos */
    async function pagar(o) {
      const ok = await U.confirmar(
        `¿Marcar "${o.concepto}" como pagado? Se registra un gasto de ${U.dinero(o.monto)}.`, 'Marcar pagado');
      if (!ok) return;
      await Store.guardar('obligaciones', Object.assign({}, o, { estado: 'Pagada', pagada: U.hoy() }));
      const cat = o.categoriaId || (catsGasto[0] && catsGasto[0].id);
      if (cat) {
        const mov = await Store.guardar('movimientos', {
          tipo: 'gasto', monto: U.n(o.monto), fecha: U.hoy(),
          descripcion: o.concepto, categoriaId: cat, centroCosto: 'Operación',
          creadoEn: U.ahora(), ediciones: 0,
          origen: { coleccion: 'obligaciones', id: o.id, texto: `el compromiso "${o.concepto}"` }
        });
        await Bitacora.registrar('creado', mov);
      }
      U.toast('Pago registrado.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevaObl">Nuevo compromiso</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevaObl', barra).onclick = () => editar(null);

    if (!obligaciones.length) {
      cont.appendChild(U.vacio('Sin compromisos registrados',
        'Anotá lo que tenés que pagar y cuándo. Se descuenta automáticamente de tu proyección de caja.',
        'Registrar el primer compromiso', () => editar(null)));
      return;
    }

    const abiertas = Calc.obligacionesAbiertas();
    const vencidas = abiertas.filter(Calc.vencida);
    const semana = abiertas.filter(o => { const d = U.diasEntre(U.hoy(), o.vence); return d >= 0 && d <= 7; });

    const resumen = U.el('div', { class: 'rejilla r3' });
    resumen.innerHTML = `
      ${Bloque.metrica('Total por pagar', U.dinero(Calc.porPagar()), `${abiertas.length} compromisos abiertos`, 'barro')}
      ${Bloque.metrica('Vence esta semana', U.dinero(semana.reduce((a, o) => a + U.n(o.monto), 0)),
        `${semana.length} pagos en 7 días`, 'ocre')}
      ${Bloque.metrica('Ya vencido', U.dinero(vencidas.reduce((a, o) => a + U.n(o.monto), 0)),
        `${vencidas.length} pasados de fecha`, vencidas.length ? 'barro' : 'jade')}`;
    cont.appendChild(resumen);

    const filas = obligaciones.map(o => Object.assign({}, o, {
      proveedor: (provs.find(p => p.id === o.proveedorId) || {}).nombre || '—',
      dias: Calc.diasVencida(o)
    })).sort((a, b) => (a.vence < b.vence ? -1 : 1));

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = '<div class="tarjeta-cabeza"><h3>Compromisos</h3></div>';
    seccion.appendChild(U.tabla([
      { t: 'Concepto', k: 'concepto' },
      { t: 'Proveedor', k: 'proveedor' },
      { t: 'Vence', k: 'vence', tipo: 'html', render: o => {
          if (o.estado !== 'Pendiente') return U.fecha(o.vence);
          if (o.dias > 0) return `${U.fecha(o.vence)}<br>${U.chip(`${o.dias} días tarde`, 'barro')}`;
          if (o.dias >= -7) return `${U.fecha(o.vence)}<br>${U.chip(`en ${-o.dias} días`, 'aviso')}`;
          return U.fecha(o.vence);
        } },
      { t: 'Estado', k: 'estado', tipo: 'html', render: o =>
        U.chip(o.estado, o.estado === 'Pagada' ? 'jade' : Calc.vencida(o) ? 'barro' : 'ocre') },
      { t: 'Monto', k: 'monto', tipo: 'dinero', alinear: 'der' }
    ], filas, [
      { etiqueta: 'Pagar', fn: o => o.estado === 'Pendiente' ? pagar(o) : U.toast('Ese compromiso ya está pagado.') },
      { etiqueta: 'Editar', fn: o => editar(o) },
      { etiqueta: 'Borrar', clase: 'peligro', fn: o => Acciones.borrar('obligaciones', o, ctx, '¿Eliminar este compromiso?') }
    ]));
    cont.appendChild(seccion);
  }
};

/* ============================================================
   INVENTARIO
   ============================================================ */
Vistas.inventario = {
  eyebrow: 'Existencias',
  titulo: 'Inventario',
  render(cont, ctx) {
    const productos = Store.lista('productos');

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar producto' : 'Nuevo producto',
        campos: [
          { k: 'nombre', etiqueta: 'Producto', tipo: 'texto', req: true, ancho: 'completo' },
          { k: 'codigo', etiqueta: 'Código', tipo: 'texto' },
          { k: 'unidad', etiqueta: 'Unidad', tipo: 'select',
            opciones: ['Unidad', 'Caja', 'Libra', 'Kilo', 'Litro', 'Docena', 'Servicio'] },
          { k: 'costo', etiqueta: 'Costo unitario', tipo: 'numero', req: true },
          { k: 'precio', etiqueta: 'Precio de venta', tipo: 'numero', req: true },
          { k: 'stock', etiqueta: 'Existencia actual', tipo: 'numero', valor: 0 },
          { k: 'stockMinimo', etiqueta: 'Stock mínimo', tipo: 'numero', valor: 0,
            ayuda: 'Te avisamos cuando bajés a este nivel.' }
        ],
        valores: existente
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('productos', r);
      U.toast('Producto guardado.', 'ok');
      ctx.refrescar();
    }

    async function ajustar(p) {
      const r = await U.formulario({
        titulo: `Ajustar existencia de "${p.nombre}"`,
        subtitulo: `Ahora hay ${U.n(p.stock)}. Poné un número positivo para entradas y negativo para salidas.`,
        campos: [{ k: 'cambio', etiqueta: 'Cambio', tipo: 'numero', req: true, ancho: 'completo' }],
        textoOk: 'Ajustar'
      });
      if (!r) return;
      await Store.guardar('productos', Object.assign({}, p, { stock: U.n(p.stock) + U.n(r.cambio) }));
      U.toast('Existencia actualizada.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevoProd">Nuevo producto</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevoProd', barra).onclick = () => editar(null);

    if (!productos.length) {
      cont.appendChild(U.vacio('Sin productos en el inventario',
        'Cargá lo que vendés con su costo y su precio. Te calculamos el margen y te avisamos cuando se acabe.',
        'Agregar el primer producto', () => editar(null)));
      return;
    }

    const bajos = Calc.productosBajos();
    const valorCosto = Calc.valorInventario();
    const valorVenta = productos.reduce((a, p) => a + U.n(p.precio) * U.n(p.stock), 0);

    const resumen = U.el('div', { class: 'rejilla r4' });
    resumen.innerHTML = `
      ${Bloque.metrica('Productos', String(productos.length), 'En catálogo', 'tinta')}
      ${Bloque.metrica('Valor a costo', U.dinero(valorCosto), 'Lo que te costó lo que tenés', 'ocre')}
      ${Bloque.metrica('Valor a venta', U.dinero(valorVenta), `Utilidad potencial ${U.dinero(valorVenta - valorCosto)}`, 'jade')}
      ${Bloque.metrica('En stock mínimo', String(bajos.length),
        bajos.length ? 'Necesitan reposición' : 'Todo abastecido', bajos.length ? 'barro' : 'jade')}`;
    cont.appendChild(resumen);

    if (bajos.length) {
      cont.insertAdjacentHTML('beforeend', `<div class="aviso aviso-barro">
        <div><p class="aviso-tit">Hay que reponer ${bajos.length} ${bajos.length === 1 ? 'producto' : 'productos'}</p>
        <p class="aviso-txt">${U.esc(bajos.map(p => `${p.nombre} (quedan ${U.n(p.stock)}, mínimo ${U.n(p.stockMinimo)})`).join(' · '))}</p></div>
      </div>`);
    }

    const filas = productos.map(p => {
      const m = Calc.margenProducto(p);
      return Object.assign({}, p, {
        margen: m.margen, utilidad: m.utilidad,
        valorStock: U.n(p.costo) * U.n(p.stock),
        bajo: U.n(p.stock) <= U.n(p.stockMinimo)
      });
    }).sort((a, b) => (a.bajo === b.bajo ? b.margen - a.margen : a.bajo ? -1 : 1));

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = '<div class="tarjeta-cabeza"><h3>Catálogo</h3><span class="tarjeta-nota">Ordenado por urgencia de reposición</span></div>';
    seccion.appendChild(U.tabla([
      { t: 'Producto', k: 'nombre', tipo: 'html', render: p =>
        U.esc(p.nombre) + (p.codigo ? `<br><span style="color:var(--texto-3);font-size:var(--t-xs)">${U.esc(p.codigo)}</span>` : '') },
      { t: 'Costo', k: 'costo', tipo: 'dinero', alinear: 'der' },
      { t: 'Precio', k: 'precio', tipo: 'dinero', alinear: 'der' },
      { t: 'Margen', k: 'margen', tipo: 'html', alinear: 'der', render: p =>
        `<span class="cifra ${p.margen >= 30 ? 'pos' : p.margen >= 15 ? '' : 'neg'}">${p.margen.toFixed(1)}%</span>` },
      { t: 'Existencia', k: 'stock', tipo: 'html', alinear: 'der', render: p =>
        p.bajo ? `<span class="chip chip-barro">${U.n(p.stock)} de ${U.n(p.stockMinimo)} mín.</span>`
               : `<span class="cifra">${U.n(p.stock)}</span>` },
      { t: 'Valor', k: 'valorStock', tipo: 'dinero', alinear: 'der' }
    ], filas, [
      { etiqueta: 'Ajustar', fn: p => ajustar(p) },
      { etiqueta: 'Editar', fn: p => editar(p) },
      { etiqueta: 'Borrar', clase: 'peligro', fn: p => Acciones.borrar('productos', p, ctx, `¿Eliminar "${p.nombre}"?`) }
    ]));
    cont.appendChild(seccion);
  }
};

/* ============================================================
   PLANILLA
   ============================================================ */
Vistas.planilla = {
  eyebrow: 'Personal',
  titulo: 'Planilla',
  render(cont, ctx) {
    const empleados = Store.lista('empleados');

    async function editar(existente) {
      const r = await U.formulario({
        titulo: existente ? 'Editar empleado' : 'Nuevo empleado',
        subtitulo: 'El costo real incluye la carga patronal, no solo el salario.',
        campos: [
          { k: 'nombre', etiqueta: 'Nombre', tipo: 'texto', req: true, ancho: 'completo' },
          { k: 'puesto', etiqueta: 'Puesto', tipo: 'texto' },
          { k: 'salario', etiqueta: 'Salario mensual', tipo: 'numero', req: true },
          { k: 'centroCosto', etiqueta: 'Centro de costo', tipo: 'select',
            opciones: APP.centrosCosto },
          { k: 'ingreso', etiqueta: 'Fecha de ingreso', tipo: 'fecha', valor: U.hoy() }
        ],
        valores: existente
      });
      if (!r) return;
      if (existente) r.id = existente.id;
      await Store.guardar('empleados', r);
      U.toast('Empleado guardado.', 'ok');
      ctx.refrescar();
    }

    const barra = U.el('div', { class: 'filtros' });
    barra.innerHTML = `<span class="filtro-espacio"></span>
      <button class="btn btn-principal btn-auto btn-chico" id="btnNuevoEmp">Nuevo empleado</button>`;
    cont.appendChild(barra);
    U.$('#btnNuevoEmp', barra).onclick = () => editar(null);

    if (!empleados.length) {
      cont.appendChild(U.vacio('Sin empleados registrados',
        'Cargá tu personal para conocer el costo real de la planilla, incluyendo ISSS y AFP.',
        'Agregar el primer empleado', () => editar(null)));
      return;
    }

    const filas = empleados.map(e => {
      const c = Calc.costoEmpleado(e);
      return Object.assign({}, e, c);
    }).sort((a, b) => b.total - a.total);

    const totalSalarios = filas.reduce((a, f) => a + f.salario, 0);
    const totalCarga = filas.reduce((a, f) => a + f.carga, 0);
    const totalPlanilla = totalSalarios + totalCarga;
    const ventas = Calc.resultados(ctx.mes).ventas;

    const resumen = U.el('div', { class: 'rejilla r4' });
    resumen.innerHTML = `
      ${Bloque.metrica('Empleados', String(empleados.length), 'En planilla', 'tinta')}
      ${Bloque.metrica('Salarios', U.dinero(totalSalarios), 'Lo que reciben en mano', 'ocre')}
      ${Bloque.metrica('Carga patronal', U.dinero(totalCarga), 'ISSS 7.5% + AFP 8.75%', 'barro')}
      ${Bloque.metrica('Costo total', U.dinero(totalPlanilla),
        ventas ? `${U.pct(totalPlanilla, ventas)}% de las ventas del mes` : 'Por mes', 'tinta')}`;
    cont.appendChild(resumen);

    if (ventas > 0 && totalPlanilla / ventas > 0.35) {
      cont.insertAdjacentHTML('beforeend', `<div class="aviso aviso-aviso">
        <div><p class="aviso-tit">La planilla se está comiendo ${U.pct(totalPlanilla, ventas)}% de las ventas</p>
        <p class="aviso-txt">En un negocio pequeño, arriba del 35% suele apretar la caja. Revisá si las ventas dan para sostenerla.</p></div>
      </div>`);
    }

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = `<div class="tarjeta-cabeza"><h3>Personal</h3>
      <span class="tarjeta-nota">Los porcentajes de ley son aproximados; confirmá con tu contador</span></div>`;
    seccion.appendChild(U.tabla([
      { t: 'Nombre', k: 'nombre', tipo: 'html', render: e =>
        U.esc(e.nombre) + (e.puesto ? `<br><span style="color:var(--texto-3);font-size:var(--t-xs)">${U.esc(e.puesto)}</span>` : '') },
      { t: 'Centro', k: 'centroCosto', tipo: 'html', render: e => U.esc(e.centroCosto || '—') },
      { t: 'Salario', k: 'salario', tipo: 'dinero', alinear: 'der' },
      { t: 'ISSS', k: 'isss', tipo: 'dinero', alinear: 'der' },
      { t: 'AFP', k: 'afp', tipo: 'dinero', alinear: 'der' },
      { t: 'Costo real', k: 'total', tipo: 'html', alinear: 'der', render: e =>
        `<b class="cifra">${U.dinero(e.total)}</b>` }
    ], filas, [
      { etiqueta: 'Editar', fn: e => editar(e) },
      { etiqueta: 'Borrar', clase: 'peligro', fn: e => Acciones.borrar('empleados', e, ctx, `¿Eliminar a "${e.nombre}"?`) }
    ]));
    cont.appendChild(seccion);
  }
};

/* ============================================================
   RENTABILIDAD
   ============================================================ */
Vistas.rentabilidad = {
  eyebrow: 'Resultados',
  titulo: 'Rentabilidad',
  render(cont, ctx) {
    const r = Calc.resultados(ctx.mes);
    const productos = Store.lista('productos');

    const resumen = U.el('div', { class: 'rejilla r4' });
    resumen.innerHTML = `
      ${Bloque.metrica('Ventas', U.dinero(r.ventas), U.nombreMes(ctx.mes), 'jade')}
      ${Bloque.metrica('Utilidad bruta', U.dinero(r.utilidadBruta),
        `Margen ${r.margenBruto.toFixed(1)}%`, r.utilidadBruta >= 0 ? 'jade' : 'barro')}
      ${Bloque.metrica('Gastos de operación', U.dinero(r.gastosOperacion), 'Todo menos mercadería', 'ocre')}
      ${Bloque.metrica('Utilidad neta', U.dinero(r.utilidadNeta),
        `Margen ${r.margenNeto.toFixed(1)}%`, r.utilidadNeta >= 0 ? 'jade' : 'barro')}`;
    cont.appendChild(resumen);

    /* Estado de resultados en cascada */
    const lineas = [
      ['Ventas del mes', r.ventas, 'pos', false],
      ['Costo de la mercadería vendida', -r.costoVentas, 'neg', false],
      ['Utilidad bruta', r.utilidadBruta, r.utilidadBruta >= 0 ? 'pos' : 'neg', true],
      ['Gastos de operación', -r.gastosOperacion, 'neg', false],
      ['Utilidad neta', r.utilidadNeta, r.utilidadNeta >= 0 ? 'pos' : 'neg', true]
    ];

    cont.insertAdjacentHTML('beforeend', Bloque.tarjeta(
      'Estado de resultados', U.nombreMes(ctx.mes),
      `<div class="renglones">${lineas.map(l => `
        <div class="renglon-item" style="${l[3] ? 'background:var(--papel-3);padding-left:10px;padding-right:10px;border-radius:4px' : ''}">
          <p class="renglon-tit" style="${l[3] ? 'font-weight:600' : 'font-weight:400'}">${U.esc(l[0])}</p>
          <span class="renglon-cifra ${l[1] < 0 ? 'neg' : l[2]}" style="${l[3] ? 'font-weight:600' : ''}">
            ${U.dinero(l[1], true)}</span>
        </div>`).join('')}</div>
      <p class="renglon-sub" style="margin-top:var(--e3)">
        Las salidas de la categoría "Mercadería" se toman como costo de venta; el resto son gastos de operación.
      </p>`));

    /* Punto de equilibrio */
    if (r.puntoEquilibrio) {
      const falta = r.puntoEquilibrio - r.ventas;
      cont.insertAdjacentHTML('beforeend', Bloque.tarjeta(
        'Punto de equilibrio', 'Cuánto necesitás vender para no perder',
        `<p class="metrica-val" style="font-size:var(--t-2xl)">${U.dinero(r.puntoEquilibrio)}</p>
         ${U.barra(r.avanceEquilibrio, r.avanceEquilibrio >= 100 ? 'jade' : 'ocre')}
         <p class="renglon-sub" style="margin-top:10px">
           ${falta <= 0
             ? `Ya lo superaste. Todo lo que vendas de aquí en adelante deja ${r.margenBruto.toFixed(0)} centavos de utilidad por cada dólar.`
             : `Te faltan ${U.dinero(falta)} de venta este mes. Con tu margen bruto de ${r.margenBruto.toFixed(1)}%, cada dólar vendido aporta ${U.dinero(r.margenBruto / 100)} a cubrir los gastos fijos.`}
         </p>`));
    } else {
      cont.insertAdjacentHTML('beforeend', `<div class="aviso aviso-aviso">
        <div><p class="aviso-tit">Todavía no se puede calcular el punto de equilibrio</p>
        <p class="aviso-txt">Necesitás registrar ventas y al menos una compra en la categoría "Mercadería" durante ${U.nombreMes(ctx.mes)}.</p></div></div>`);
    }

    /* Margen por producto */
    if (productos.length) {
      const filas = productos.map(p => {
        const m = Calc.margenProducto(p);
        return { etiqueta: p.nombre, valor: m.utilidad, color: m.margen >= 30 ? '#2C7A5F' : m.margen >= 15 ? '#B06C15' : '#A63A2B' };
      }).sort((a, b) => b.valor - a.valor).slice(0, 10);

      cont.insertAdjacentHTML('beforeend', Bloque.tarjeta(
        'Utilidad por unidad vendida', 'Verde: margen sano · Ocre: ajustado · Rojo: muy delgado',
        G.ranking(filas)));
    }

    /* Centros de costo */
    const cc = Calc.porCentroCosto(ctx.mes);
    if (cc.length) {
      cont.insertAdjacentHTML('beforeend', `<div class="rejilla r2">
        ${Bloque.tarjeta('Gasto por centro de costo', U.nombreMes(ctx.mes),
          G.dona(cc, { centroTitulo: 'Gastos', centroValor: U.dinero(cc.reduce((a, c) => a + c.valor, 0)) }) + G.leyenda(cc))}
        ${Bloque.tarjeta('Salidas más grandes del mes', null,
          G.ranking(Calc.porCategoria(ctx.mes, 'gasto').slice(0, 8)))}
      </div>`);
    }
  }
};

/* ============================================================
   FLUJO DE CAJA
   ============================================================ */
Vistas.flujo = {
  eyebrow: 'Proyección',
  titulo: 'Flujo de caja',
  render(cont, ctx) {
    const p = Calc.proyeccionCaja(90);

    cont.insertAdjacentHTML('beforeend', Bloque.cintaCaja(false));

    const resumen = U.el('div', { class: 'rejilla r4' });
    resumen.innerHTML = `
      ${Bloque.metrica('Caja hoy', U.dinero(p.saldoHoy), 'Acumulado de tus movimientos', p.saldoHoy >= 0 ? 'jade' : 'barro')}
      ${Bloque.metrica('Entra pendiente', U.dinero(Calc.porCobrar()), 'Facturas por cobrar', 'jade')}
      ${Bloque.metrica('Sale pendiente', U.dinero(Calc.porPagar() + Calc.costoPlanilla()),
        'Compromisos + una planilla', 'barro')}
      ${Bloque.metrica('Días de caja', p.diasDeCaja === null ? '90+' : String(p.diasDeCaja),
        p.diasDeCaja === null ? 'Aguanta el trimestre' : `Cero el ${U.fecha(p.fechaQuiebre)}`,
        p.diasDeCaja === null ? 'jade' : p.diasDeCaja <= APP.umbrales.diasCajaCritico ? 'barro' : 'ocre')}`;
    cont.appendChild(resumen);

    /* Cómo se compone el cálculo: transparencia sobre la proyección */
    cont.insertAdjacentHTML('beforeend', Bloque.tarjeta(
      'De dónde sale este número', 'La proyección no adivina: suma lo que ya registraste',
      `<div class="renglones">
        <div class="renglon-item"><div><p class="renglon-tit">Saldo acumulado</p>
          <p class="renglon-sub">Todo lo que entró menos todo lo que salió hasta hoy</p></div>
          <span class="renglon-cifra ${p.saldoHoy >= 0 ? 'pos' : 'neg'}">${U.dinero(p.saldoHoy, true)}</span></div>
        <div class="renglon-item"><div><p class="renglon-tit">Cobros programados</p>
          <p class="renglon-sub">Cada factura pendiente cae en su fecha de vencimiento</p></div>
          <span class="renglon-cifra pos">${U.dinero(Calc.porCobrar(), true)}</span></div>
        <div class="renglon-item"><div><p class="renglon-tit">Pagos programados</p>
          <p class="renglon-sub">Cada compromiso pendiente cae en su fecha</p></div>
          <span class="renglon-cifra neg">${U.dinero(-Calc.porPagar(), true)}</span></div>
        <div class="renglon-item"><div><p class="renglon-tit">Planilla</p>
          <p class="renglon-sub">${Calc.gastoEnCategoria('Planilla', 60) > 0
            ? 'Ya la registrás como movimiento, así que va incluida en el gasto diario'
            : 'Se programa como pago mensual porque no aparece en tus movimientos'}</p></div>
          <span class="renglon-cifra neg">${U.dinero(-Calc.costoPlanilla(), true)}</span></div>
        <div class="renglon-item"><div><p class="renglon-tit">Gasto diario de operación</p>
          <p class="renglon-sub">Promedio real de tus últimos 60 días</p></div>
          <span class="renglon-cifra neg">${U.dinero(-p.operacionDiaria, true)} / día</span></div>
      </div>`));

    /* Calendario de eventos próximos */
    const eventos = [];
    Calc.facturasAbiertas().forEach(f => eventos.push({
      fecha: f.vence, tipo: 'Cobro', concepto: `Factura ${f.numero}`, monto: U.n(f.monto)
    }));
    Calc.obligacionesAbiertas().forEach(o => eventos.push({
      fecha: o.vence, tipo: 'Pago', concepto: o.concepto, monto: -U.n(o.monto)
    }));
    eventos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

    const seccion = U.el('section', { class: 'tarjeta' });
    seccion.innerHTML = '<div class="tarjeta-cabeza"><h3>Agenda de caja</h3><span class="tarjeta-nota">Próximos movimientos comprometidos</span></div>';
    if (!eventos.length) {
      seccion.insertAdjacentHTML('beforeend',
        '<p class="vacio-texto">No hay cobros ni pagos programados. Registrá facturas y compromisos para proyectar mejor.</p>');
    } else {
      seccion.appendChild(U.tabla([
        { t: 'Fecha', k: 'fecha', tipo: 'fecha', ancho: '120px' },
        { t: 'Tipo', k: 'tipo', tipo: 'html', render: e => U.chip(e.tipo, e.monto > 0 ? 'jade' : 'barro') },
        { t: 'Concepto', k: 'concepto' },
        { t: 'Monto', k: 'monto', tipo: 'html', alinear: 'der', render: e =>
          `<span class="cifra ${e.monto > 0 ? 'pos' : 'neg'}">${U.dinero(e.monto, true)}</span>` }
      ], eventos, []));
    }
    cont.appendChild(seccion);
  }
};

/* ============================================================
   MI NEGOCIO (perfil y ajustes)
   ============================================================ */
Vistas.negocio = {
  eyebrow: 'Ajustes',
  titulo: 'Mi cuenta',
  render(cont, ctx) {
    const p = Store.perfil;
    const empresa = Store.esEmpresa();

    async function editarPerfil() {
      const campos = [
        { k: 'nombre', etiqueta: 'Tu nombre', tipo: 'texto', req: true, ancho: 'completo' }
      ];
      if (empresa) campos.push(
        { k: 'negocioNombre', etiqueta: 'Nombre del negocio', tipo: 'texto', req: true, ancho: 'completo' },
        { k: 'negocioGiro', etiqueta: 'Giro', tipo: 'texto' }
      );
      const r = await U.formulario({
        titulo: 'Editar cuenta',
        campos,
        valores: {
          nombre: p.nombre,
          negocioNombre: p.negocio ? p.negocio.nombre : '',
          negocioGiro: p.negocio ? p.negocio.giro : ''
        }
      });
      if (!r) return;
      const parche = { nombre: r.nombre };
      if (empresa) parche.negocio = Object.assign({}, p.negocio, { nombre: r.negocioNombre, giro: r.negocioGiro });
      await Store.actualizarPerfil(parche);
      U.toast('Cuenta actualizada.', 'ok');
      ctx.refrescar();
    }

    async function cambiarTipo() {
      const nuevo = empresa ? 'personal' : 'empresarial';
      const ok = await U.confirmar(
        empresa
          ? '¿Pasar a cuenta personal? Se ocultan los módulos de negocio, pero los datos se conservan.'
          : '¿Pasar a cuenta empresarial? Se habilitan clientes, facturación, inventario, planilla y flujo de caja.',
        'Cambiar');
      if (!ok) return;
      if (nuevo === 'empresarial' && !Store.perfil.negocio) {
        const r = await U.formulario({
          titulo: 'Datos del negocio',
          campos: [
            { k: 'nombre', etiqueta: 'Nombre del negocio', tipo: 'texto', req: true, ancho: 'completo' },
            { k: 'giro', etiqueta: 'Giro', tipo: 'texto', ancho: 'completo' }
          ]
        });
        if (!r) return;
        await Store.actualizarPerfil({ negocio: r });
      }
      await Store.actualizarPerfil({ tipoCuenta: nuevo });
      U.toast('Tipo de cuenta cambiado.', 'ok');
      location.hash = '#/resumen';
      ctx.refrescar();
    }

    async function cargarDemo() {
      const ok = await U.confirmar('Se agregan datos de ejemplo para ver la app funcionando. ¿Continuar?', 'Cargar ejemplo');
      if (!ok) return;
      await Demo.cargar();
      U.toast('Datos de ejemplo cargados.', 'ok');
      ctx.refrescar();
    }

    async function vaciar() {
      const ok = await U.confirmar('Se borran TODOS tus movimientos, clientes, facturas y demás. Esto no se puede deshacer.', 'Borrar todo');
      if (!ok) return;
      await Store.vaciar();
      U.toast('Datos borrados.', 'ok');
      ctx.refrescar();
    }

    const conteos = APP.colecciones.map(c => ({ c, n: Store.lista(c).length })).filter(x => x.n > 0);

    cont.insertAdjacentHTML('beforeend', `<div class="rejilla r3">
      ${Bloque.metrica('Tipo de cuenta', empresa ? 'Empresarial' : 'Personal',
        empresa ? '15 módulos habilitados' : '8 módulos habilitados', 'ocre')}
      ${Bloque.metrica('Registros guardados', String(conteos.reduce((a, x) => a + x.n, 0)),
        conteos.map(x => `${x.n} ${x.c}`).join(' · ') || 'Todavía nada', 'tinta')}
      ${Bloque.metrica('Almacenamiento', Store.modo === 'firebase' ? 'Firebase' : 'Este navegador',
        Store.modo === 'firebase' ? 'Sincronizado en la nube' : 'Configurá Firebase para sincronizar', 
        Store.modo === 'firebase' ? 'jade' : 'aviso')}
    </div>`);

    const datos = U.el('section', { class: 'tarjeta' });
    datos.innerHTML = `<div class="tarjeta-cabeza"><h3>Tus datos</h3></div>
      <div class="renglones">
        <div class="renglon-item"><div><p class="renglon-tit">Nombre</p>
          <p class="renglon-sub">${U.esc(p.nombre || '—')}</p></div></div>
        <div class="renglon-item"><div><p class="renglon-tit">Correo</p>
          <p class="renglon-sub">${U.esc(p.correo || '—')}</p></div></div>
        ${empresa && p.negocio ? `
        <div class="renglon-item"><div><p class="renglon-tit">Negocio</p>
          <p class="renglon-sub">${U.esc(p.negocio.nombre)} · ${U.esc(p.negocio.giro || 'Sin giro')}</p></div></div>` : ''}
      </div>`;
    const acc = U.el('div', { class: 'filtros' });
    acc.style.marginTop = 'var(--e4)';
    acc.innerHTML = `<button class="btn btn-principal btn-auto btn-chico">Editar datos</button>
      <button class="btn btn-fantasma btn-chico">${empresa ? 'Pasar a cuenta personal' : 'Pasar a cuenta empresarial'}</button>`;
    const bs = U.$$('button', acc);
    bs[0].onclick = editarPerfil;
    bs[1].onclick = cambiarTipo;
    datos.appendChild(acc);
    cont.appendChild(datos);

    const zona = U.el('section', { class: 'tarjeta' });
    zona.innerHTML = `<div class="tarjeta-cabeza"><h3>Herramientas</h3></div>
      <p class="renglon-sub">Cargá datos de ejemplo para ver todos los módulos con información, o empezá de cero.</p>`;
    const acc2 = U.el('div', { class: 'filtros' });
    acc2.style.marginTop = 'var(--e3)';
    acc2.innerHTML = `<button class="btn btn-fantasma btn-chico">Cargar datos de ejemplo</button>
      <button class="btn btn-peligro btn-auto btn-chico">Borrar todos mis datos</button>`;
    const bs2 = U.$$('button', acc2);
    bs2[0].onclick = cargarDemo;
    bs2[1].onclick = vaciar;
    zona.appendChild(acc2);
    cont.appendChild(zona);
  }
};
