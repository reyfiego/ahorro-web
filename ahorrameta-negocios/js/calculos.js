/* ============================================================
   CÁLCULOS
   Todo lo que la app deduce a partir de lo que el usuario registra.
   Las vistas solo pintan; acá se piensa.
   ============================================================ */

const Calc = {

  /* ---------- Movimientos ---------- */

  movimientosDe(mes) {
    return Store.lista('movimientos')
      .filter(m => U.mesDe(m.fecha) === mes)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  },

  totales(mes) {
    let entra = 0, sale = 0;
    Calc.movimientosDe(mes).forEach(m => {
      if (m.tipo === 'ingreso') entra += U.n(m.monto); else sale += U.n(m.monto);
    });
    return { entra, sale, saldo: entra - sale };
  },

  /* Saldo acumulado desde el primer registro hasta el final del mes dado. */
  saldoAcumulado(hastaMes) {
    let s = 0;
    Store.lista('movimientos').forEach(m => {
      if (U.mesDe(m.fecha) <= hastaMes) s += (m.tipo === 'ingreso' ? 1 : -1) * U.n(m.monto);
    });
    return s;
  },

  serieMensual(cantidadMeses) {
    return U.mesesAtras(cantidadMeses).map(mes => {
      const t = Calc.totales(mes);
      return { etiqueta: U.nombreMes(mes).slice(0, 3), mes, a: t.entra, b: t.sale };
    });
  },

  /* Reparto de gasto (o ingreso) por categoría en un mes. */
  porCategoria(mes, tipo) {
    const acum = {};
    Calc.movimientosDe(mes).forEach(m => {
      if (m.tipo !== tipo) return;
      acum[m.categoriaId] = (acum[m.categoriaId] || 0) + U.n(m.monto);
    });
    return Object.keys(acum).map(id => {
      const c = Store.categoria(id);
      return {
        id,
        etiqueta: c ? c.nombre : 'Sin categoría',
        color: c ? c.color : '#7C8C86',
        valor: acum[id]
      };
    }).sort((a, b) => b.valor - a.valor);
  },

  /* Gasto promedio diario de los últimos N días con registros. */
  gastoDiarioPromedio(dias) {
    const desde = U.sumarDias(U.hoy(), -(dias || 60));
    let total = 0;
    Store.lista('movimientos').forEach(m => {
      if (m.tipo === 'gasto' && m.fecha >= desde && m.fecha <= U.hoy()) total += U.n(m.monto);
    });
    return total / (dias || 60);
  },

  /* Cuánto se gastó en una categoría (por nombre) en los últimos N días. */
  gastoEnCategoria(nombreCategoria, dias) {
    const cat = Store.lista('categorias').find(c => c.nombre === nombreCategoria);
    if (!cat) return 0;
    const desde = U.sumarDias(U.hoy(), -(dias || 60));
    return Store.lista('movimientos')
      .filter(m => m.tipo === 'gasto' && m.categoriaId === cat.id && m.fecha >= desde)
      .reduce((a, m) => a + U.n(m.monto), 0);
  },

  /* ---------- Presupuestos ---------- */

  /* Devuelve el avance de cada presupuesto del mes indicado. */
  avancePresupuestos(mes) {
    const gastado = {};
    Calc.movimientosDe(mes).forEach(m => {
      if (m.tipo === 'gasto') gastado[m.categoriaId] = (gastado[m.categoriaId] || 0) + U.n(m.monto);
    });

    return Store.lista('presupuestos')
      .filter(p => !p.mes || p.mes === mes)
      .map(p => {
        const c = Store.categoria(p.categoriaId);
        const usado = gastado[p.categoriaId] || 0;
        const tope = U.n(p.monto);
        const pct = U.pct(usado, tope);
        return {
          id: p.id,
          categoriaId: p.categoriaId,
          nombre: c ? c.nombre : 'Sin categoría',
          color: c ? c.color : '#7C8C86',
          tope, usado,
          restante: tope - usado,
          pct,
          estado: pct >= 100 ? 'excedido' : pct >= APP.umbrales.presupuestoAviso ? 'cerca' : 'bien'
        };
      })
      .sort((a, b) => b.pct - a.pct);
  },

  /* ---------- Metas ---------- */

  avanceMetas() {
    return Store.lista('metas').map(m => {
      const objetivo = U.n(m.objetivo);
      const ahorrado = U.n(m.ahorrado);
      const pct = Math.min(100, U.pct(ahorrado, objetivo));
      const falta = Math.max(0, objetivo - ahorrado);
      let diasRestantes = null, porMes = null;
      if (m.fechaLimite) {
        diasRestantes = U.diasEntre(U.hoy(), m.fechaLimite);
        const meses = Math.max(1, diasRestantes / 30);
        porMes = falta / meses;
      }
      return Object.assign({}, m, { pct, falta, diasRestantes, porMes, lograda: ahorrado >= objetivo });
    }).sort((a, b) => b.pct - a.pct);
  },

  /* ---------- Cuentas por cobrar / por pagar ---------- */

  facturasAbiertas() {
    return Store.lista('facturas').filter(f => f.estado === 'Pendiente');
  },

  obligacionesAbiertas() {
    return Store.lista('obligaciones').filter(o => o.estado === 'Pendiente');
  },

  porCobrar() {
    return Calc.facturasAbiertas().reduce((a, f) => a + U.n(f.monto), 0);
  },

  porPagar() {
    return Calc.obligacionesAbiertas().reduce((a, o) => a + U.n(o.monto), 0);
  },

  vencida(doc) {
    return doc.estado === 'Pendiente' && doc.vence && doc.vence < U.hoy();
  },

  diasVencida(doc) {
    return doc.vence ? U.diasEntre(doc.vence, U.hoy()) : 0;
  },

  /* Antigüedad de la cartera: cuánto se debe y desde hace cuánto. */
  antiguedad(docs) {
    const tramos = [
      { etiqueta: 'Por vencer',  min: -99999, max: -1,   valor: 0, color: '#2C7A5F' },
      { etiqueta: '1 a 30 días', min: 0,      max: 30,   valor: 0, color: '#B06C15' },
      { etiqueta: '31 a 60 días',min: 31,     max: 60,   valor: 0, color: '#C08A3E' },
      { etiqueta: 'Más de 60',   min: 61,     max: 99999,valor: 0, color: '#A63A2B' }
    ];
    docs.forEach(d => {
      const dias = Calc.diasVencida(d);
      const t = tramos.find(x => dias >= x.min && dias <= x.max);
      if (t) t.valor += U.n(d.monto);
    });
    return tramos.filter(t => t.valor > 0);
  },

  /* ---------- LA CINTA: flujo de caja proyectado ---------- */

  /* Proyecta el saldo día a día combinando:
     · el saldo actual real
     · los cobros pendientes (en su fecha de vencimiento)
     · los pagos pendientes (en su fecha de vencimiento)
     · la planilla (el día de pago de cada mes, solo si no se registra ya como movimiento)
     · el gasto promedio diario de operación */
  proyeccionCaja(diasAdelante) {
    const N = diasAdelante || 90;
    const saldoHoy = Calc.saldoAcumulado(U.mesActual());
    const promedioDiario = Calc.gastoDiarioPromedio(60);

    /* Los cobros y pagos con fecha se agrupan por día */
    const eventos = {};
    const anota = (fecha, campo, monto) => {
      if (!fecha) return;
      if (!eventos[fecha]) eventos[fecha] = { entra: 0, sale: 0 };
      eventos[fecha][campo] += U.n(monto);
    };

    Calc.facturasAbiertas().forEach(f => anota(f.vence || U.hoy(), 'entra', f.monto));
    Calc.obligacionesAbiertas().forEach(o => anota(o.vence || U.hoy(), 'sale', o.monto));

    /* Planilla: se programa como pago mensual, pero SOLO si el usuario todavía
       no la registra como movimiento. Si ya la anota mes a mes, el gasto
       histórico promedio la incluye y programarla otra vez la contaría doble. */
    const planilla = Calc.costoPlanilla();
    const yaRegistraPlanilla = Calc.gastoEnCategoria('Planilla', 60) > 0;
    if (planilla > 0 && !yaRegistraPlanilla) {
      for (let m = 0; m <= Math.ceil(N / 30); m++) {
        const d = new Date();
        d.setMonth(d.getMonth() + m);
        d.setDate(28);
        const fecha = U.iso(d);
        if (fecha > U.hoy()) anota(fecha, 'sale', planilla);
      }
    }

    const operacionDiaria = promedioDiario;

    let saldo = saldoHoy;
    const dias = [];
    for (let i = 0; i <= N; i++) {
      const fecha = U.sumarDias(U.hoy(), i);
      const ev = eventos[fecha] || { entra: 0, sale: 0 };
      if (i > 0) saldo += ev.entra - ev.sale - operacionDiaria;
      dias.push({ fecha, saldo, entra: ev.entra, sale: ev.sale });
    }

    const quiebre = dias.findIndex(d => d.saldo < 0);
    return {
      dias,
      saldoHoy,
      operacionDiaria,
      diasDeCaja: quiebre < 0 ? null : quiebre,
      fechaQuiebre: quiebre < 0 ? null : dias[quiebre].fecha,
      saldoFinal: dias[dias.length - 1].saldo
    };
  },

  /* ---------- Inventario ---------- */

  valorInventario() {
    return Store.lista('productos').reduce((a, p) => a + U.n(p.costo) * U.n(p.stock), 0);
  },

  productosBajos() {
    return Store.lista('productos').filter(p => U.n(p.stock) <= U.n(p.stockMinimo) * APP.umbrales.stockCritico);
  },

  margenProducto(p) {
    const precio = U.n(p.precio), costo = U.n(p.costo);
    const utilidad = precio - costo;
    return {
      utilidad,
      margen: precio ? (utilidad / precio) * 100 : 0,
      marcaje: costo ? (utilidad / costo) * 100 : 0
    };
  },

  /* ---------- Planilla ---------- */

  costoPlanilla() {
    return Store.lista('empleados').reduce((a, e) => a + Calc.costoEmpleado(e).total, 0);
  },

  /* Costo real de un empleado: salario + carga patronal aproximada.
     Porcentajes de El Salvador: ISSS 7.5% (tope $1,000), AFP 8.75%. */
  costoEmpleado(e) {
    const salario = U.n(e.salario);
    const baseIsss = Math.min(salario, 1000);
    const isss = baseIsss * 0.075;
    const afp = salario * 0.0875;
    return {
      salario,
      isss,
      afp,
      carga: isss + afp,
      total: salario + isss + afp
    };
  },

  /* ---------- Rentabilidad ---------- */

  /* Estado de resultados simplificado del mes. */
  resultados(mes) {
    const movs = Calc.movimientosDe(mes);
    let ventas = 0, costoVentas = 0, gastosOperacion = 0;

    movs.forEach(m => {
      const c = Store.categoria(m.categoriaId);
      const nombre = c ? c.nombre : '';
      if (m.tipo === 'ingreso') { ventas += U.n(m.monto); return; }
      if (nombre === 'Mercadería') costoVentas += U.n(m.monto);
      else gastosOperacion += U.n(m.monto);
    });

    const utilidadBruta = ventas - costoVentas;
    const utilidadNeta = utilidadBruta - gastosOperacion;
    const margenBruto = ventas ? (utilidadBruta / ventas) * 100 : 0;
    const margenNeto = ventas ? (utilidadNeta / ventas) * 100 : 0;

    /* Punto de equilibrio: cuánto hay que vender para no perder. */
    const razonContribucion = ventas ? utilidadBruta / ventas : 0;
    const puntoEquilibrio = razonContribucion > 0 ? gastosOperacion / razonContribucion : null;

    return {
      ventas, costoVentas, utilidadBruta, gastosOperacion, utilidadNeta,
      margenBruto, margenNeto, puntoEquilibrio,
      avanceEquilibrio: puntoEquilibrio ? U.pct(ventas, puntoEquilibrio) : 0
    };
  },

  /* Gasto agrupado por centro de costo. */
  porCentroCosto(mes) {
    const acum = {};
    APP.centrosCosto.forEach(c => { acum[c] = 0; });
    acum['Sin asignar'] = 0;
    Calc.movimientosDe(mes).forEach(m => {
      if (m.tipo !== 'gasto') return;
      const cc = m.centroCosto && acum[m.centroCosto] !== undefined ? m.centroCosto : 'Sin asignar';
      acum[cc] += U.n(m.monto);
    });
    const colores = { 'Operación': '#B06C15', 'Ventas': '#2C7A5F', 'Administración': '#5B4A9E', 'Sin asignar': '#7C8C86' };
    return Object.keys(acum)
      .filter(k => acum[k] > 0)
      .map(k => ({ etiqueta: k, valor: acum[k], color: colores[k] }))
      .sort((a, b) => b.valor - a.valor);
  },

  /* ---------- Clientes ---------- */

  saldoCliente(clienteId) {
    return Store.lista('facturas')
      .filter(f => f.clienteId === clienteId && f.estado === 'Pendiente')
      .reduce((a, f) => a + U.n(f.monto), 0);
  },

  ventasCliente(clienteId) {
    return Store.lista('facturas')
      .filter(f => f.clienteId === clienteId && f.estado !== 'Anulada')
      .reduce((a, f) => a + U.n(f.monto), 0);
  },

  /* ---------- ALERTAS: se calculan, no se simulan ---------- */

  alertas() {
    const lista = [];
    const mes = U.mesActual();
    const t = Calc.totales(mes);

    /* 1. Gastás más de lo que entra */
    if (t.sale > t.entra && t.entra > 0) {
      lista.push({
        tono: 'barro',
        titulo: 'Este mes estás gastando más de lo que entra',
        texto: `Van ${U.dinero(t.sale)} de salida contra ${U.dinero(t.entra)} de entrada. La diferencia es ${U.dinero(t.sale - t.entra)}.`,
        ir: '#/movimientos'
      });
    }

    /* 2. Presupuestos excedidos o al límite */
    Calc.avancePresupuestos(mes).forEach(p => {
      if (p.estado === 'excedido') {
        lista.push({
          tono: 'barro',
          titulo: `Te pasaste del presupuesto de ${p.nombre}`,
          texto: `Llevás ${U.dinero(p.usado)} de un tope de ${U.dinero(p.tope)}. Son ${U.dinero(-p.restante)} de más.`,
          ir: '#/presupuesto'
        });
      } else if (p.estado === 'cerca') {
        lista.push({
          tono: 'aviso',
          titulo: `${p.nombre} va en ${p.pct}% del presupuesto`,
          texto: `Te quedan ${U.dinero(p.restante)} para el resto del mes.`,
          ir: '#/presupuesto'
        });
      }
    });

    if (!Store.esEmpresa()) {
      /* 3. Metas con fecha encima */
      Calc.avanceMetas().forEach(m => {
        if (!m.lograda && m.diasRestantes !== null && m.diasRestantes < 30 && m.diasRestantes >= 0) {
          lista.push({
            tono: 'aviso',
            titulo: `A la meta "${m.nombre}" le quedan ${m.diasRestantes} días`,
            texto: `Falta ahorrar ${U.dinero(m.falta)} para llegar al objetivo.`,
            ir: '#/metas'
          });
        }
      });
      return Calc.ordenarAlertas(lista);
    }

    /* ===== Solo cuentas empresariales ===== */

    /* 4. Días de caja */
    const p = Calc.proyeccionCaja(90);
    if (p.diasDeCaja !== null && p.diasDeCaja <= APP.umbrales.diasCajaCritico) {
      lista.push({
        tono: 'barro',
        titulo: `A la caja le quedan ${p.diasDeCaja} días`,
        texto: `Al ritmo actual el saldo llega a cero el ${U.fecha(p.fechaQuiebre)}. Acelerá los cobros o postergá pagos.`,
        ir: '#/flujo'
      });
    }

    /* 5. Facturas vencidas */
    const vencidas = Calc.facturasAbiertas().filter(Calc.vencida);
    if (vencidas.length) {
      const monto = vencidas.reduce((a, f) => a + U.n(f.monto), 0);
      lista.push({
        tono: 'barro',
        titulo: `${vencidas.length} ${vencidas.length === 1 ? 'factura vencida' : 'facturas vencidas'} sin cobrar`,
        texto: `Son ${U.dinero(monto)} que ya pasaron su fecha de pago.`,
        ir: '#/cobrar'
      });
    }

    /* 6. Obligaciones que vencen esta semana */
    const proximas = Calc.obligacionesAbiertas().filter(o => {
      const d = U.diasEntre(U.hoy(), o.vence || U.hoy());
      return d >= 0 && d <= 7;
    });
    if (proximas.length) {
      const monto = proximas.reduce((a, o) => a + U.n(o.monto), 0);
      lista.push({
        tono: 'aviso',
        titulo: `${proximas.length} ${proximas.length === 1 ? 'pago vence' : 'pagos vencen'} esta semana`,
        texto: `Necesitás ${U.dinero(monto)} disponibles en los próximos 7 días.`,
        ir: '#/pagar'
      });
    }

    /* 7. Stock bajo */
    const bajos = Calc.productosBajos();
    if (bajos.length) {
      lista.push({
        tono: 'aviso',
        titulo: `${bajos.length} ${bajos.length === 1 ? 'producto está' : 'productos están'} en stock mínimo`,
        texto: bajos.slice(0, 3).map(p2 => `${p2.nombre} (${U.n(p2.stock)})`).join(', ') +
               (bajos.length > 3 ? ` y ${bajos.length - 3} más.` : '.'),
        ir: '#/inventario'
      });
    }

    /* 8. Punto de equilibrio no alcanzado */
    const r = Calc.resultados(mes);
    if (r.puntoEquilibrio && r.ventas > 0 && r.ventas < r.puntoEquilibrio) {
      lista.push({
        tono: 'aviso',
        titulo: 'Todavía no llegás al punto de equilibrio',
        texto: `Necesitás vender ${U.dinero(r.puntoEquilibrio - r.ventas)} más este mes para cubrir los gastos fijos.`,
        ir: '#/rentabilidad'
      });
    }

    /* 9. Margen bruto muy delgado */
    if (r.ventas > 0 && r.margenBruto < 15) {
      lista.push({
        tono: 'aviso',
        titulo: `Tu margen bruto está en ${r.margenBruto.toFixed(1)}%`,
        texto: 'De cada dólar vendido queda muy poco después del costo de la mercadería. Revisá precios o proveedores.',
        ir: '#/rentabilidad'
      });
    }

    return Calc.ordenarAlertas(lista);
  },

  ordenarAlertas(lista) {
    const peso = { barro: 0, aviso: 1, jade: 2 };
    return lista.sort((a, b) => peso[a.tono] - peso[b.tono]);
  },

  cuentaAlertas() {
    return Calc.alertas().filter(a => a.tono === 'barro').length;
  }
};
