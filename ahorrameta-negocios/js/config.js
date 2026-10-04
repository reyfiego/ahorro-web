/* ============================================================
   CONFIGURACIÓN
   ------------------------------------------------------------
   Pegá aquí los datos de tu app WEB de Firebase.
   Consola de Firebase → tu proyecto → ⚙ Configuración del proyecto
   → "Tus apps" → agregar app Web (</>) → copiar firebaseConfig.

   OJO: el google-services.json de Android NO sirve acá. La app web
   se registra aparte y tiene su propio appId.

   Mientras estos campos estén vacíos, la app corre en MODO LOCAL
   (guarda todo en el navegador). Así podés probarla sin configurar nada.
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

/* ============ Constantes de la aplicación ============ */

const APP = {
  nombre: 'AhorraMeta',
  sufijo: 'Negocios',
  moneda: '$',

  /* Colecciones de datos por usuario */
  colecciones: [
    'movimientos', 'categorias', 'presupuestos', 'metas',
    'clientes', 'proveedores', 'facturas', 'obligaciones',
    'productos', 'empleados',
    'bitacora'   // Sprint 2: registro de cambios de ingresos y gastos
  ],

  /* Categorías iniciales según el tipo de cuenta */
  semillaPersonal: [
    { nombre: 'Sueldo',          clase: 'ingreso', color: '#2C7A5F' },
    { nombre: 'Trabajos extra',  clase: 'ingreso', color: '#4E9E7E' },
    { nombre: 'Comida',          clase: 'gasto',   color: '#B06C15' },
    { nombre: 'Transporte',      clase: 'gasto',   color: '#8A6708' },
    { nombre: 'Vivienda',        clase: 'gasto',   color: '#A63A2B' },
    { nombre: 'Salud',           clase: 'gasto',   color: '#2C6E7A' },
    { nombre: 'Educación',       clase: 'gasto',   color: '#5B4A9E' },
    { nombre: 'Entretenimiento', clase: 'gasto',   color: '#C08A3E' },
    { nombre: 'Otros',           clase: 'gasto',   color: '#7C8C86' }
  ],

  semillaEmpresa: [
    { nombre: 'Ventas',            clase: 'ingreso', color: '#2C7A5F' },
    { nombre: 'Servicios',         clase: 'ingreso', color: '#4E9E7E' },
    { nombre: 'Otros ingresos',    clase: 'ingreso', color: '#77B79B' },
    { nombre: 'Mercadería',        clase: 'gasto',   color: '#A63A2B' },
    { nombre: 'Planilla',          clase: 'gasto',   color: '#B06C15' },
    { nombre: 'Alquiler',          clase: 'gasto',   color: '#8A6708' },
    { nombre: 'Servicios básicos', clase: 'gasto',   color: '#C08A3E' },
    { nombre: 'Transporte',        clase: 'gasto',   color: '#2C6E7A' },
    { nombre: 'Impuestos',         clase: 'gasto',   color: '#5B4A9E' },
    { nombre: 'Mantenimiento',     clase: 'gasto',   color: '#7C8C86' },
    { nombre: 'Otros gastos',      clase: 'gasto',   color: '#96A399' }
  ],

  centrosCosto: ['Operación', 'Ventas', 'Administración'],

  estadosFactura: ['Pendiente', 'Pagada', 'Anulada'],

  /* Umbrales de las alertas automáticas */
  umbrales: {
    presupuestoAviso: 80,   // % de un presupuesto para avisar
    diasCajaCritico: 15,    // días de caja restantes que encienden alarma
    stockCritico: 1.0       // factor sobre el stock mínimo
  }
};
