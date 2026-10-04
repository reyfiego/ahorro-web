# AhorraMeta Negocios

Aplicación web de finanzas para personas y microempresas. HTML, CSS y JavaScript puros: sin frameworks, sin `npm install`, sin paso de compilación.

---

## Probarla ahora mismo

1. Abrí la carpeta en VS Code (**File → Open Folder**).
2. Abrí `index.html` en el navegador. Hay dos formas:
   - Doble clic al archivo (funciona, porque no se usan módulos ES).
   - O mejor: extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.
3. Creá una cuenta. Elegí **Empresarial** para ver los quince módulos.
4. Adentro, andá a **Mi cuenta → Cargar datos de ejemplo** para llenar la app con un negocio de prueba.

Sin configurar nada, la app corre en **modo local**: las cuentas y los datos se guardan en el `localStorage` del navegador. Sirve para desarrollar y para demostrar, pero cada navegador tiene su propia copia.

---

## Conectarla a Firebase

El `google-services.json` de la app Android **no sirve acá**. La app web se registra aparte.

1. Consola de Firebase → tu proyecto → ⚙ **Configuración del proyecto**.
2. En *Tus apps*, agregá una app **Web** (icono `</>`). Registrala.
3. Copiá el objeto `firebaseConfig` que te muestra.
4. Pegá esos valores en `js/config.js`, en la constante `FIREBASE_CONFIG`.
5. **Authentication → Sign-in method → Correo electrónico/contraseña → Habilitar.**
6. **Firestore Database → Crear base de datos.**
7. **Firestore → Reglas**: pegá el contenido de `firestore.rules`. Esto es obligatorio; sin reglas, cualquiera puede leer los datos de todos.

Apenas `apiKey` y `projectId` tengan valor, la app cambia sola a modo Firebase. No hay que tocar nada más.

### Publicarla

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # carpeta pública: .  (punto)
firebase deploy
```

`firebase.json` ya viene configurado. Después del despliegue, agregá el dominio que te dé Firebase en **Authentication → Settings → Dominios autorizados**.

---

## Qué trae cada tipo de cuenta

Se elige al crear la cuenta y se puede cambiar después en *Mi cuenta*.

| Módulo | Personal | Empresarial |
|---|:--:|:--:|
| Resumen | ✓ | ✓ |
| Movimientos con categorías | ✓ | ✓ |
| Presupuesto por categoría | ✓ | ✓ |
| Metas de ahorro | ✓ | ✓ |
| Reportes | ✓ | ✓ |
| Alertas automáticas | ✓ | ✓ |
| **Clientes** | | ✓ |
| **Proveedores** | | ✓ |
| **Cuentas por cobrar** (facturación y antigüedad de cartera) | | ✓ |
| **Cuentas por pagar** (compromisos y vencimientos) | | ✓ |
| **Inventario** (costo, precio, margen, stock mínimo) | | ✓ |
| **Planilla** (salario + ISSS + AFP) | | ✓ |
| **Rentabilidad** (estado de resultados, punto de equilibrio, centros de costo) | | ✓ |
| **Flujo de caja proyectado a 90 días** | | ✓ |

La cuenta empresarial además cambia el resumen: en vez de *entró / salió / te queda*, muestra ventas, utilidad neta, por cobrar y por pagar.

---

## Estructura

```
ahorrameta-negocios/
├─ index.html            Acceso: entrar, registro en 2 pasos, recuperar clave
├─ app.html              Cascarón del panel (rail + barra + contenedor de vista)
├─ css/
│  ├─ tokens.css         Paleta, tipografías, escala, reset
│  ├─ auth.css           Página de acceso + toasts
│  └─ app.css            Panel: rail, tarjetas, tablas, modales, la cinta
└─ js/
   ├─ config.js          FIREBASE_CONFIG + constantes y categorías semilla
   ├─ util.js            Formato de dinero y fechas, modales, tablas, CSV
   ├─ store.js            Capa de datos: Firebase o localStorage, misma interfaz
   ├─ bitacora.js         Sprint 2: registro de cambios (trazabilidad)
   ├─ auth.js            Lógica de index.html
   ├─ charts.js          Gráficos SVG hechos a mano (sin librerías)
   ├─ calculos.js        Toda la lógica de negocio: totales, márgenes, alertas
   ├─ views-core.js      Vistas comunes a ambos tipos de cuenta
   ├─ views-negocio.js   Vistas exclusivas de la cuenta empresarial
   ├─ views-historial.js Sprint 2: historial de ingresos y de gastos
   └─ app.js             Ruteo por hash, navegación, datos de ejemplo
```

### Cómo se conecta

`store.js` es la única pieza que sabe si hay Firebase o no. Carga todo a memoria una vez al entrar (`Store.datos`), así que las vistas pintan sin esperar. Al guardar, escribe en la caché y en el destino real.

`calculos.js` no toca el DOM ni la red: solo lee `Store` y devuelve números. Las vistas no calculan nada, solo pintan.

Cada vista es un objeto `{ eyebrow, titulo, render(contenedor, ctx) }` registrado en `Vistas`. Para agregar una pantalla nueva: registrala en `Vistas` y agregá su entrada en `App.menu()`.

---

## Sprint 2 — Editar, eliminar e historial

| HU | Qué hace | Dónde |
|---|---|---|
| HU7 / HU12 Editar ingreso / gasto | El tipo no se puede cambiar; solo muestra categorías de ese tipo; valida monto > 0, fecha no futura y concepto; pide un motivo opcional; si no cambiaste nada no guarda | `Acciones.movimiento()` en `views-core.js` |
| HU8 / HU13 Eliminar ingreso / gasto | Confirma mostrando concepto, monto y fecha; guarda una copia en la bitácora para poder restaurarlo; si venía de una factura o compromiso, ese documento vuelve a *Pendiente* | `Acciones.eliminarMovimiento()` y `Acciones.restaurar()` |
| HU9 / HU14 Ver historial | Pantallas **Historial → Ingresos / Gastos**: todo el historial (no solo el mes), filtros por período, categoría y texto, orden, paginación, totales y CSV | `views-historial.js` |
| Trazabilidad | Cada alta, edición, eliminación y restauración queda en la colección `bitacora` con fecha, hora y el antes/después de cada campo. Botón **Cambios** en cada fila y pestaña **Registro de cambios** | `bitacora.js` |

---

## Detalles que vale la pena saber

**Las alertas se calculan, no se simulan.** Salen de los datos reales: presupuestos excedidos, facturas vencidas, pagos de esta semana, stock bajo, punto de equilibrio, margen delgado y días de caja restantes.

**Cobrar y pagar registran movimientos.** Marcar una factura como pagada crea automáticamente el ingreso; marcar un compromiso como pagado crea el gasto. No hay que anotarlo dos veces.

**La proyección de caja no adivina.** Suma el saldo acumulado real, coloca cada cobro y cada pago pendiente en su fecha de vencimiento, y descuenta el gasto diario promedio de los últimos 60 días. La planilla se programa aparte solo si no la estás registrando ya como movimiento, para no contarla doble.

**Porcentajes de ley.** El cálculo de planilla usa ISSS 7.5% (con tope de $1,000) y AFP 8.75% patronal. Son aproximados y están en `Calc.costoEmpleado()` por si hay que ajustarlos.

**Atajos de teclado.** `N` abre el registro rápido de movimiento. `Alt + ←` y `Alt + →` cambian de mes.

---

## Diferencias con la versión Android

| | Android (AhorraMeta) | Web (esta) |
|---|---|---|
| Navegación | 9 pantallas en cadena | Panel con rail lateral y ruteo por hash |
| Alertas | Botón que alterna dos textos fijos | Ocho reglas sobre datos reales |
| Presupuesto | Valida y muestra un Toast, no guarda | Topes por categoría con avance y aviso |
| Metas | `ArrayList` en memoria, se pierde al salir | Persisten, con abonos y cuota mensual sugerida |
| Persistencia | SharedPreferences con texto ya formateado | Registros estructurados en Firestore o localStorage |
| Cierre de sesión | No llamaba a `signOut()` | Cierra sesión de verdad |
| Datos por usuario | Compartidos en el dispositivo | Aislados por `uid` |
