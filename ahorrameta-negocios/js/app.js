/* ============================================================
   ARRANQUE, NAVEGACIÓN Y RUTEO
   ============================================================ */

const App = {

  mes: U.mesActual(),

  /* ---------- Mapa de navegación ---------- */
  menu(esEmpresa) {
    if (!esEmpresa) {
      return [
        { grupo: 'Panel', items: [
          { r: 'resumen', t: 'Resumen' },
          { r: 'alertas', t: 'Alertas', contador: true }
        ] },
        { grupo: 'Día a día', items: [
          { r: 'movimientos', t: 'Movimientos' },
          { r: 'presupuesto', t: 'Presupuesto' },
          { r: 'metas', t: 'Metas de ahorro' }
        ] },
        { grupo: 'Historial', items: [
          { r: 'ingresos', t: 'Ingresos' },
          { r: 'gastos', t: 'Gastos' }
        ] },
        { grupo: 'Análisis', items: [
          { r: 'reportes', t: 'Reportes' }
        ] },
        { grupo: 'Ajustes', items: [
          { r: 'categorias', t: 'Categorías' },
          { r: 'negocio', t: 'Mi cuenta' }
        ] }
      ];
    }

    return [
      { grupo: 'Panel', items: [
        { r: 'resumen', t: 'Resumen' },
        { r: 'flujo', t: 'Flujo de caja' },
        { r: 'alertas', t: 'Alertas', contador: true }
      ] },
      { grupo: 'Día a día', items: [
        { r: 'movimientos', t: 'Movimientos' },
        { r: 'cobrar', t: 'Por cobrar' },
        { r: 'pagar', t: 'Por pagar' }
      ] },
      { grupo: 'Historial', items: [
        { r: 'ingresos', t: 'Ingresos' },
        { r: 'gastos', t: 'Gastos' }
      ] },
      { grupo: 'Negocio', items: [
        { r: 'clientes', t: 'Clientes' },
        { r: 'proveedores', t: 'Proveedores' },
        { r: 'inventario', t: 'Inventario' },
        { r: 'planilla', t: 'Planilla' }
      ] },
      { grupo: 'Análisis', items: [
        { r: 'rentabilidad', t: 'Rentabilidad' },
        { r: 'presupuesto', t: 'Presupuesto' },
        { r: 'reportes', t: 'Reportes' },
        { r: 'metas', t: 'Metas' }
      ] },
      { grupo: 'Ajustes', items: [
        { r: 'categorias', t: 'Categorías' },
        { r: 'negocio', t: 'Mi cuenta' }
      ] }
    ];
  },

  /* ---------- Pintar el rail ---------- */
  pintarNav() {
    const nav = U.$('#railNav');
    const rutaActual = App.ruta();
    const criticas = Calc.cuentaAlertas();

    nav.innerHTML = App.menu(Store.esEmpresa()).map(g => `
      <div class="nav-grupo">
        <p class="nav-grupo-titulo">${U.esc(g.grupo)}</p>
        ${g.items.map(i => `
          <a class="nav-item ${i.r === rutaActual ? 'activo' : ''}" href="#/${i.r}">
            <span>${U.esc(i.t)}</span>
            ${i.contador && criticas ? `<span class="nav-punto">${criticas}</span>` : ''}
          </a>`).join('')}
      </div>`).join('');
  },

  /* ---------- Cabecera ---------- */
  pintarIdentidad() {
    const p = Store.perfil;
    const empresa = Store.esEmpresa();
    U.$('#railNegocio').textContent = empresa && p.negocio ? p.negocio.nombre : (p.nombre || 'AhorraMeta');
    U.$('#railTipo').textContent = empresa ? 'Cuenta empresarial' : 'Cuenta personal';
    U.$('#nombreUsuario').textContent = p.nombre || 'Usuario';
    U.$('#correoUsuario').textContent = p.correo || '';
    U.$('#avatarUsuario').textContent = (p.nombre || 'U').trim().charAt(0).toUpperCase();
    document.title = (empresa && p.negocio ? p.negocio.nombre : 'AhorraMeta') + ' — AhorraMeta';
  },

  /* ---------- Ruteo ---------- */
  ruta() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return h || 'resumen';
  },

  render() {
    let nombre = App.ruta();
    let vista = Vistas[nombre];

    /* Módulos de negocio bloqueados para cuentas personales */
    const soloEmpresa = ['clientes', 'proveedores', 'cobrar', 'pagar', 'inventario', 'planilla', 'rentabilidad', 'flujo'];
    if (vista && soloEmpresa.includes(nombre) && !Store.esEmpresa()) {
      vista = null;
      nombre = 'bloqueado';
    }

    const cont = U.$('#vista');
    cont.innerHTML = '';
    window.scrollTo(0, 0);

    if (!vista) {
      U.$('#vistaEyebrow').textContent = 'Aviso';
      U.$('#vistaTitulo').textContent = nombre === 'bloqueado' ? 'Módulo empresarial' : 'No encontramos esa página';
      cont.appendChild(U.vacio(
        nombre === 'bloqueado' ? 'Esto es parte de la cuenta empresarial' : 'Esa página no existe',
        nombre === 'bloqueado'
          ? 'Clientes, facturación, inventario, planilla y flujo de caja se habilitan al cambiar a cuenta empresarial.'
          : 'Puede que el enlace esté mal escrito.',
        nombre === 'bloqueado' ? 'Ir a mi cuenta' : 'Volver al resumen',
        () => { location.hash = nombre === 'bloqueado' ? '#/negocio' : '#/resumen'; }));
      App.pintarNav();
      return;
    }

    U.$('#vistaEyebrow').textContent = vista.eyebrow;
    U.$('#vistaTitulo').textContent = vista.titulo;

    const ctx = { mes: App.mes, refrescar: () => App.render() };
    try {
      vista.render(cont, ctx);
    } catch (e) {
      console.error(e);
      cont.innerHTML = `<div class="aviso aviso-barro"><div>
        <p class="aviso-tit">Algo falló al mostrar esta sección</p>
        <p class="aviso-txt">${U.esc(e.message)}</p></div></div>`;
    }

    App.pintarNav();
    App.pintarMes();
    U.$('#rail').classList.remove('abierto');
    U.$('#railSombra').hidden = true;
  },

  pintarMes() {
    U.$('#mesValor').textContent = U.nombreMes(App.mes);
  },

  moverMes(delta) {
    const [a, m] = App.mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    App.mes = U.iso(d).slice(0, 7);
    App.render();
  },

  /* ---------- Inicio ---------- */
  async iniciar() {
    Store.init();

    const sesion = await Store.sesion();
    if (!sesion) { location.replace('index.html'); return; }

    try {
      await Store.cargarTodo();
    } catch (e) {
      console.error(e);
      U.toast('No se pudieron cargar tus datos: ' + Store.mensajeError(e), 'mal');
    }

    U.$('#cargandoPantalla').remove();
    U.$('#marco').hidden = false;

    App.pintarIdentidad();
    App.pintarMes();

    /* Eventos de la barra */
    U.$('#mesAtras').onclick = () => App.moverMes(-1);
    U.$('#mesAdelante').onclick = () => App.moverMes(1);
    U.$('#btnRapido').onclick = () => Acciones.movimiento(null, { mes: App.mes, refrescar: () => App.render() });

    U.$('#btnMenu').onclick = () => {
      U.$('#rail').classList.toggle('abierto');
      U.$('#railSombra').hidden = !U.$('#rail').classList.contains('abierto');
    };
    U.$('#railSombra').onclick = () => {
      U.$('#rail').classList.remove('abierto');
      U.$('#railSombra').hidden = true;
    };

    U.$('#btnMenuUsuario').onclick = () => { location.hash = '#/negocio'; };

    U.$('#btnSalir').onclick = async () => {
      const ok = await U.confirmar('¿Cerrar sesión?', 'Cerrar sesión');
      if (!ok) return;
      await Store.salir();
      location.replace('index.html');
    };

    window.addEventListener('hashchange', () => App.render());

    /* Atajos: N registra movimiento, flechas cambian de mes */
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, select, textarea') || U.$('.modal-fondo')) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        Acciones.movimiento(null, { mes: App.mes, refrescar: () => App.render() });
      }
      if (e.key === 'ArrowLeft' && e.altKey) App.moverMes(-1);
      if (e.key === 'ArrowRight' && e.altKey) App.moverMes(1);
    });

    if (!location.hash) location.hash = '#/resumen';
    App.render();

    /* Primera vez: ofrecer datos de ejemplo */
    if (!Store.lista('movimientos').length) {
      setTimeout(() => {
        U.toast('¿Querés ver la app con datos? Entrá a Mi cuenta → Cargar datos de ejemplo.', 'ok');
      }, 900);
    }
  }
};

/* ============================================================
   DATOS DE EJEMPLO
   Genera un negocio verosímil para que se vean todos los módulos.
   ============================================================ */

const Demo = {

  async cargar() {
    const empresa = Store.esEmpresa();
    const cats = Store.lista('categorias');
    const catIng = cats.filter(c => c.clase === 'ingreso');
    const catGas = cats.filter(c => c.clase === 'gasto');
    if (!catIng.length || !catGas.length) {
      U.toast('Creá al menos una categoría de entrada y una de salida.', 'mal');
      return;
    }

    const azar = (a, b) => a + Math.random() * (b - a);
    const elegir = arr => arr[Math.floor(Math.random() * arr.length)];

    /* --- Movimientos de los últimos 3 meses --- */
    const conceptosIng = empresa
      ? ['Venta del día', 'Venta al por mayor', 'Servicio a domicilio', 'Venta de fin de semana']
      : ['Sueldo quincenal', 'Trabajo extra', 'Venta de artículo usado'];
    const conceptosGas = empresa
      ? ['Compra de mercadería', 'Alquiler del local', 'Agua y luz', 'Combustible de reparto', 'Mantenimiento de equipo']
      : ['Supermercado', 'Pasaje', 'Recibo de luz', 'Farmacia', 'Almuerzo'];

    /* Un microempresa real tiene márgenes delgados: la mercadería se lleva
       la mayor parte de la venta. Los números están calibrados para eso. */
    const catMercaderia = catGas.find(c => c.nombre === 'Mercadería');
    const catPlanilla = catGas.find(c => c.nombre === 'Planilla');
    const catFijos = catGas.filter(c => c !== catMercaderia && c !== catPlanilla);

    for (let d = 90; d >= 0; d--) {
      const fecha = U.sumarDias(U.hoy(), -d);
      const finDeSemana = [0, 6].includes(new Date(fecha + 'T12:00:00').getDay());

      /* Ingresos: casi diarios en un negocio, quincenales en personal */
      if (empresa ? Math.random() < 0.9 : (fecha.endsWith('-15') || fecha.endsWith('-30'))) {
        await Store.guardar('movimientos', {
          tipo: 'ingreso',
          monto: Math.round(azar(empresa ? (finDeSemana ? 180 : 110) : 300,
                                 empresa ? (finDeSemana ? 320 : 230) : 460) * 100) / 100,
          descripcion: elegir(conceptosIng),
          categoriaId: elegir(catIng).id,
          fecha,
          centroCosto: empresa ? 'Ventas' : ''
        });
      }

      if (empresa) {
        /* Compra de mercadería cada 4 días: el costo de venta */
        if (d % 4 === 0 && catMercaderia) {
          await Store.guardar('movimientos', {
            tipo: 'gasto', monto: Math.round(azar(300, 420) * 100) / 100,
            descripcion: 'Compra de mercadería', categoriaId: catMercaderia.id,
            fecha, centroCosto: 'Operación'
          });
        }
        /* Gastos fijos menores */
        if (Math.random() < 0.35 && catFijos.length) {
          await Store.guardar('movimientos', {
            tipo: 'gasto', monto: Math.round(azar(12, 90) * 100) / 100,
            descripcion: elegir(conceptosGas), categoriaId: elegir(catFijos).id,
            fecha, centroCosto: elegir(APP.centrosCosto)
          });
        }
      } else if (Math.random() < 0.4) {
        await Store.guardar('movimientos', {
          tipo: 'gasto', monto: Math.round(azar(8, 70) * 100) / 100,
          descripcion: elegir(conceptosGas), categoriaId: elegir(catGas).id,
          fecha, centroCosto: ''
        });
      }
    }

    /* --- Presupuestos --- */
    for (const c of catGas.slice(0, 4)) {
      await Store.guardar('presupuestos', {
        categoriaId: c.id,
        monto: Math.round(azar(150, 700)),
        mes: U.mesActual()
      });
    }

    /* --- Metas --- */
    await Store.guardar('metas', {
      nombre: empresa ? 'Comprar vitrina refrigerada' : 'Fondo de emergencia',
      objetivo: empresa ? 1200 : 1500,
      ahorrado: empresa ? 430 : 620,
      fechaLimite: U.sumarDias(U.hoy(), 150)
    });
    await Store.guardar('metas', {
      nombre: empresa ? 'Rotular el local' : 'Curso de inglés',
      objetivo: 400,
      ahorrado: 385,
      fechaLimite: U.sumarDias(U.hoy(), 20)
    });

    if (!empresa) return;

    /* --- Clientes --- */
    const nombresCli = ['Comedor La Paz', 'Ferretería El Tornillo', 'Súper Mini Rosa',
                        'Panadería Santa Ana', 'Distribuidora Morán'];
    const clientes = [];
    for (const n of nombresCli) {
      clientes.push(await Store.guardar('clientes', {
        nombre: n,
        contacto: elegir(['Ana', 'Luis', 'Carmen', 'Óscar', 'Marta']),
        telefono: '7' + Math.floor(azar(1000000, 9999999)),
        correo: '', nit: '', notas: ''
      }));
    }

    /* --- Proveedores --- */
    const nombresProv = ['Distribuidora Central', 'Empaques del Norte', 'Lácteos San José'];
    const proveedores = [];
    for (const n of nombresProv) {
      proveedores.push(await Store.guardar('proveedores', {
        nombre: n,
        contacto: elegir(['Rafael', 'Sonia', 'Julio']),
        telefono: '2' + Math.floor(azar(1000000, 9999999)),
        suministra: elegir(['Mercadería general', 'Empaque y bolsas', 'Producto fresco']),
        plazo: elegir([0, 15, 30]),
        notas: ''
      }));
    }

    /* --- Facturas: algunas pagadas, algunas por vencer, algunas vencidas --- */
    const plan = [
      { dias: -45, estado: 'Pagada' }, { dias: -30, estado: 'Pagada' },
      { dias: -12, estado: 'Pendiente' }, { dias: -4, estado: 'Pendiente' },
      { dias: 6, estado: 'Pendiente' }, { dias: 18, estado: 'Pendiente' },
      { dias: 32, estado: 'Pendiente' }
    ];
    let num = 41;
    for (const f of plan) {
      await Store.guardar('facturas', {
        numero: String(num++).padStart(4, '0'),
        clienteId: elegir(clientes).id,
        concepto: elegir(['Pedido semanal', 'Pedido especial', 'Reposición de producto']),
        monto: Math.round(azar(120, 850) * 100) / 100,
        emitida: U.sumarDias(U.hoy(), f.dias - 30),
        vence: U.sumarDias(U.hoy(), f.dias),
        estado: f.estado
      });
    }

    /* --- Obligaciones --- */
    const planPago = [
      { dias: -6, concepto: 'Compra de mercadería' },
      { dias: 3, concepto: 'Alquiler del local' },
      { dias: 9, concepto: 'Recibo de energía' },
      { dias: 21, concepto: 'Reposición de empaque' }
    ];
    for (const o of planPago) {
      await Store.guardar('obligaciones', {
        concepto: o.concepto,
        proveedorId: elegir(proveedores).id,
        categoriaId: elegir(catGas).id,
        monto: Math.round(azar(90, 480) * 100) / 100,
        vence: U.sumarDias(U.hoy(), o.dias),
        estado: 'Pendiente'
      });
    }

    /* --- Inventario --- */
    const prods = [
      ['Bolsa de arroz 5 lb', 3.10, 4.25, 24, 10],
      ['Aceite 1 litro', 2.40, 3.50, 6, 8],
      ['Azúcar 5 lb', 2.75, 3.60, 18, 10],
      ['Café molido 1 lb', 4.10, 6.25, 9, 6],
      ['Detergente 1 kg', 2.05, 3.40, 3, 6],
      ['Refresco 3 litros', 1.35, 2.10, 40, 12]
    ];
    for (const p of prods) {
      await Store.guardar('productos', {
        nombre: p[0], codigo: '', unidad: 'Unidad',
        costo: p[1], precio: p[2], stock: p[3], stockMinimo: p[4]
      });
    }

    /* --- Empleados --- */
    const emps = [
      ['Encargado de mostrador', 400, 'Ventas'],
      ['Auxiliar de bodega', 365, 'Operación']
    ];
    let i = 1;
    for (const e of emps) {
      await Store.guardar('empleados', {
        nombre: 'Empleado ' + i++,
        puesto: e[0], salario: e[1], centroCosto: e[2],
        ingreso: U.sumarDias(U.hoy(), -Math.floor(azar(120, 700)))
      });
    }
  }
};

/* ---------- Arrancar ---------- */
App.iniciar();
