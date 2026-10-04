/* ============================================================
   BITÁCORA DE MOVIMIENTOS  (Sprint 2 · trazabilidad)
   ------------------------------------------------------------
   Cada vez que un ingreso o un gasto se crea, se edita, se
   elimina o se restaura, queda una entrada en la colección
   'bitacora'. Las entradas NUNCA se editan ni se borran desde
   la interfaz: son el rastro de lo que pasó.

   Forma de una entrada:
   {
     id, accion: 'creado' | 'editado' | 'eliminado' | 'restaurado',
     movimientoId, tipo: 'ingreso' | 'gasto',
     descripcion, monto,          // cómo se veía el registro en ese momento
     cuando: 'YYYY-MM-DDTHH:MM:SS',
     cambios: [{ campo, etiqueta, de, a }],   // solo en 'editado'
     motivo,                      // opcional, lo escribe el usuario
     copia                        // registro completo (para restaurar)
   }
   ============================================================ */

const Bitacora = {

  /* Campos del movimiento que se vigilan, con su nombre para personas */
  campos: {
    tipo: 'Tipo',
    monto: 'Monto',
    descripcion: 'Concepto',
    categoriaId: 'Categoría',
    fecha: 'Fecha',
    centroCosto: 'Centro de costo'
  },

  /* Convierte un valor crudo en texto legible. La categoría se guarda
     por nombre en la entrada, así la bitácora sigue teniendo sentido
     aunque después alguien borre esa categoría. */
  legible(campo, valor) {
    if (valor === undefined || valor === null || valor === '') return '—';
    if (campo === 'monto') return U.dinero(valor);
    if (campo === 'fecha') return U.fecha(valor);
    if (campo === 'categoriaId') return Store.nombreCategoria(valor);
    if (campo === 'tipo') return valor === 'ingreso' ? 'Ingreso' : 'Gasto';
    return String(valor);
  },

  /* Compara dos versiones y devuelve solo lo que cambió. */
  diferencias(antes, despues) {
    const salida = [];
    Object.keys(Bitacora.campos).forEach(k => {
      let a = antes ? antes[k] : undefined;
      let b = despues ? despues[k] : undefined;
      if (k === 'monto') { a = U.n(a); b = U.n(b); }
      const vacioA = a === undefined || a === null || a === '';
      const vacioB = b === undefined || b === null || b === '';
      if (vacioA && vacioB) return;
      if (String(a) === String(b)) return;
      salida.push({
        campo: k,
        etiqueta: Bitacora.campos[k],
        de: Bitacora.legible(k, a),
        a: Bitacora.legible(k, b)
      });
    });
    return salida;
  },

  /* Escribe una entrada. mov es el registro (después del cambio,
     o tal como estaba si se eliminó). */
  async registrar(accion, mov, extra) {
    const e = extra || {};
    const copia = Object.assign({}, mov);
    return Store.guardar('bitacora', {
      accion,
      movimientoId: mov.id,
      tipo: mov.tipo,
      descripcion: mov.descripcion || '',
      monto: U.n(mov.monto),
      cuando: U.ahora(),
      cambios: e.cambios || [],
      motivo: e.motivo || '',
      copia
    });
  },

  /* Historial completo de un solo movimiento, del más nuevo al más viejo. */
  de(movimientoId) {
    return Store.lista('bitacora')
      .filter(b => b.movimientoId === movimientoId)
      .sort((a, b) => (a.cuando < b.cuando ? 1 : -1));
  },

  /* Todas las entradas de un tipo (ingreso o gasto). */
  porTipo(tipo) {
    return Store.lista('bitacora')
      .filter(b => b.tipo === tipo)
      .sort((a, b) => (a.cuando < b.cuando ? 1 : -1));
  },

  /* ¿El movimiento sigue existiendo? (para saber si se puede restaurar) */
  existe(movimientoId) {
    return Store.lista('movimientos').some(m => m.id === movimientoId);
  },

  /* Nombre y tono de cada acción para pintarla como chip */
  etiqueta(accion) {
    return {
      creado:     { t: 'Creado',     tono: 'jade' },
      editado:    { t: 'Editado',    tono: 'ocre' },
      eliminado:  { t: 'Eliminado',  tono: 'barro' },
      restaurado: { t: 'Restaurado', tono: 'neutro' }
    }[accion] || { t: accion, tono: 'neutro' };
  }
};
