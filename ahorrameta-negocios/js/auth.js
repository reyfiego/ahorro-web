/* ============================================================
   LÓGICA DE LA PÁGINA DE ACCESO
   ============================================================ */

(function () {
  const modo = Store.init();

  let tipoElegido = 'personal';

  /* ---------- Navegación entre paneles ---------- */
  const paneles = ['panelLogin', 'panelTipo', 'panelRegistro', 'panelRecuperar'];

  function mostrar(idPanel) {
    paneles.forEach(p => { U.$('#' + p).hidden = (p !== idPanel); });
    const foco = U.$('#' + idPanel + ' input');
    if (foco) setTimeout(() => foco.focus(), 60);
  }

  U.$$('[data-ir]').forEach(b => {
    b.onclick = () => mostrar(b.dataset.ir);
  });

  /* ---------- Elegir tipo de cuenta ---------- */
  U.$$('.tipo').forEach(t => {
    t.onclick = () => {
      tipoElegido = t.dataset.tipo;
      const esEmpresa = tipoElegido === 'empresarial';
      U.$('#etiquetaTipo').textContent = esEmpresa ? 'Cuenta empresarial' : 'Cuenta personal';
      U.$('#bloqueNegocio').hidden = !esEmpresa;
      mostrar('panelRegistro');
    };
  });

  /* ---------- Medidor de fuerza de contraseña ---------- */
  const inpPass = U.$('#regPass');
  inpPass.addEventListener('input', () => {
    const v = inpPass.value;
    let puntos = 0;
    if (v.length >= 6) puntos++;
    if (v.length >= 10) puntos++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) puntos++;
    if (/\d/.test(v)) puntos++;
    if (/[^A-Za-z0-9]/.test(v)) puntos++;

    const barra = U.$('#barraFuerza');
    const texto = U.$('#textoFuerza');
    const anchos = ['0%', '22%', '45%', '65%', '85%', '100%'];
    const colores = ['var(--barro)', 'var(--barro)', 'var(--aviso)', 'var(--aviso)', 'var(--jade)', 'var(--jade)'];
    const leyendas = [
      'Usá al menos 6 caracteres.',
      'Muy corta todavía.',
      'Aceptable. Agregá un número.',
      'Buena. Agregá mayúsculas.',
      'Fuerte.',
      'Muy fuerte.'
    ];
    barra.style.width = anchos[puntos];
    barra.style.background = colores[puntos];
    texto.textContent = leyendas[puntos];
  });

  /* ---------- Helpers de error ---------- */
  function error(idCaja, mensaje) {
    const e = U.$('#' + idCaja);
    if (!mensaje) { e.hidden = true; return; }
    e.textContent = mensaje;
    e.hidden = false;
  }

  function cargando(boton, activo, textoNormal) {
    boton.disabled = activo;
    boton.textContent = activo ? 'Un momento…' : textoNormal;
  }

  const correoValido = c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

  /* ---------- Entrar ---------- */
  const btnEntrar = U.$('#btnEntrar');
  btnEntrar.onclick = async () => {
    error('errLogin', '');
    const correo = U.$('#loginCorreo').value.trim();
    const pass = U.$('#loginPass').value;

    if (!correo || !pass) return error('errLogin', 'Escribí tu correo y tu contraseña.');
    if (!correoValido(correo)) return error('errLogin', 'Ese correo no tiene un formato válido.');

    cargando(btnEntrar, true, 'Entrar');
    try {
      await Store.entrar(correo, pass);
      location.href = 'app.html';
    } catch (e) {
      error('errLogin', Store.mensajeError(e));
      cargando(btnEntrar, false, 'Entrar');
    }
  };

  /* ---------- Registrar ---------- */
  const btnRegistrar = U.$('#btnRegistrar');
  btnRegistrar.onclick = async () => {
    error('errRegistro', '');
    const nombre = U.$('#regNombre').value.trim();
    const correo = U.$('#regCorreo').value.trim();
    const pass = U.$('#regPass').value;
    const esEmpresa = tipoElegido === 'empresarial';

    if (!nombre) return error('errRegistro', 'Escribí tu nombre.');
    if (!correoValido(correo)) return error('errRegistro', 'Ese correo no tiene un formato válido.');
    if (pass.length < 6) return error('errRegistro', 'La contraseña necesita al menos 6 caracteres.');

    let negocio = null;
    if (esEmpresa) {
      const nomNeg = U.$('#regNegocio').value.trim();
      if (!nomNeg) return error('errRegistro', 'Escribí el nombre del negocio.');
      negocio = {
        nombre: nomNeg,
        giro: U.$('#regGiro').value,
        empleados: U.$('#regEmpleados').value
      };
    }

    cargando(btnRegistrar, true, 'Crear cuenta');
    try {
      await Store.registrar({ nombre, correo, password: pass, tipoCuenta: tipoElegido, negocio });
      location.href = 'app.html';
    } catch (e) {
      error('errRegistro', Store.mensajeError(e));
      cargando(btnRegistrar, false, 'Crear cuenta');
    }
  };

  /* ---------- Recuperar ---------- */
  const btnRecuperar = U.$('#btnRecuperar');
  btnRecuperar.onclick = async () => {
    error('errRecuperar', '');
    const correo = U.$('#recCorreo').value.trim();
    if (!correoValido(correo)) return error('errRecuperar', 'Escribí un correo válido.');

    cargando(btnRecuperar, true, 'Enviar enlace');
    try {
      await Store.recuperar(correo);
      U.toast('Listo. Revisá tu correo para restablecer la contraseña.', 'ok');
      mostrar('panelLogin');
    } catch (e) {
      error('errRecuperar', Store.mensajeError(e));
    }
    cargando(btnRecuperar, false, 'Enviar enlace');
  };

  /* ---------- Enter envía el panel visible ---------- */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!U.$('#panelLogin').hidden) btnEntrar.click();
    else if (!U.$('#panelRegistro').hidden) btnRegistrar.click();
    else if (!U.$('#panelRecuperar').hidden) btnRecuperar.click();
  });

  /* ---------- Aviso de modo ---------- */
  if (modo === 'local') {
    const aviso = U.$('#avisoModo');
    aviso.innerHTML = 'Modo local activo: las cuentas y los datos se guardan solo en este navegador. ' +
      'Para publicarla en internet, pegá tu configuración de Firebase en <code>js/config.js</code>.';
    aviso.hidden = false;
  }

  /* ---------- Si ya hay sesión, entrar directo ---------- */
  Store.sesion().then(u => { if (u) location.href = 'app.html'; });
})();
