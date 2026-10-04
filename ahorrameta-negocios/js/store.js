/* ============================================================
   CAPA DE DATOS
   ------------------------------------------------------------
   Una sola interfaz, dos motores:
     · 'firebase' → Firebase Auth + Firestore (producción)
     · 'local'    → localStorage del navegador (demo sin configurar)

   Las vistas nunca saben cuál está activo: siempre llaman a Store.
   ============================================================ */

const Store = {

  modo: 'local',
  usuario: null,   // { uid, correo }
  perfil: null,    // { nombre, correo, tipoCuenta, negocio }
  datos: {},       // caché en memoria: { movimientos: [...], clientes: [...], ... }

  db: null,
  auth: null,

  /* ============ Arranque ============ */

  init() {
    const cfg = FIREBASE_CONFIG;
    if (cfg && cfg.apiKey && cfg.projectId && typeof firebase !== 'undefined') {
      try {
        firebase.initializeApp(cfg);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.modo = 'firebase';
      } catch (e) {
        console.warn('Firebase no arrancó, se usa modo local:', e);
        this.modo = 'local';
      }
    } else {
      this.modo = 'local';
    }
    APP.colecciones.forEach(c => { this.datos[c] = []; });
    return this.modo;
  },

  /* ============ Cuentas ============ */

  async registrar({ nombre, correo, password, tipoCuenta, negocio }) {
    if (this.modo === 'firebase') {
      const cred = await this.auth.createUserWithEmailAndPassword(correo, password);
      const uid = cred.user.uid;
      await cred.user.updateProfile({ displayName: nombre });
      try { await cred.user.sendEmailVerification(); } catch (e) { /* no bloquea */ }

      const perfil = { nombre, correo, tipoCuenta, negocio: negocio || null, creado: U.hoy() };
      await this.db.collection('usuarios').doc(uid).set(perfil);

      this.usuario = { uid, correo };
      this.perfil = perfil;
      await this._sembrarCategorias(tipoCuenta);
      return perfil;
    }

    /* --- local --- */
    const usuarios = this._leerLocal('am_usuarios', []);
    if (usuarios.some(u => u.correo.toLowerCase() === correo.toLowerCase())) {
      throw { code: 'auth/email-already-in-use' };
    }
    const uid = U.id();
    const nuevo = {
      uid, nombre, correo, tipoCuenta,
      negocio: negocio || null,
      clave: U.hashSimple(password),
      creado: U.hoy()
    };
    usuarios.push(nuevo);
    this._guardarLocal('am_usuarios', usuarios);
    this._guardarLocal('am_sesion', uid);

    this.usuario = { uid, correo };
    this.perfil = { nombre, correo, tipoCuenta, negocio: negocio || null, creado: nuevo.creado };
    APP.colecciones.forEach(c => { this.datos[c] = []; });
    this._volcarLocal();
    await this._sembrarCategorias(tipoCuenta);
    return this.perfil;
  },

  async entrar(correo, password) {
    if (this.modo === 'firebase') {
      const cred = await this.auth.signInWithEmailAndPassword(correo, password);
      this.usuario = { uid: cred.user.uid, correo: cred.user.email };
      return this.usuario;
    }

    const usuarios = this._leerLocal('am_usuarios', []);
    const u = usuarios.find(x => x.correo.toLowerCase() === correo.toLowerCase());
    if (!u || u.clave !== U.hashSimple(password)) throw { code: 'auth/invalid-credential' };
    this._guardarLocal('am_sesion', u.uid);
    this.usuario = { uid: u.uid, correo: u.correo };
    return this.usuario;
  },

  async recuperar(correo) {
    if (this.modo === 'firebase') return this.auth.sendPasswordResetEmail(correo);
    const usuarios = this._leerLocal('am_usuarios', []);
    if (!usuarios.some(x => x.correo.toLowerCase() === correo.toLowerCase())) {
      throw { code: 'auth/user-not-found' };
    }
    throw { code: 'local/sin-correo' };
  },

  async salir() {
    if (this.modo === 'firebase') await this.auth.signOut();
    else localStorage.removeItem('am_sesion');
    this.usuario = null;
    this.perfil = null;
    APP.colecciones.forEach(c => { this.datos[c] = []; });
  },

  /* Resuelve con el uid si hay sesión, o con null. */
  sesion() {
    if (this.modo === 'firebase') {
      return new Promise(resolve => {
        const quitar = this.auth.onAuthStateChanged(u => {
          quitar();
          if (u) { this.usuario = { uid: u.uid, correo: u.email }; resolve(this.usuario); }
          else resolve(null);
        });
      });
    }
    const uid = this._leerLocal('am_sesion', null);
    if (!uid) return Promise.resolve(null);
    const u = this._leerLocal('am_usuarios', []).find(x => x.uid === uid);
    if (!u) return Promise.resolve(null);
    this.usuario = { uid: u.uid, correo: u.correo };
    return Promise.resolve(this.usuario);
  },

  /* ============ Carga completa ============ */

  async cargarTodo() {
    if (!this.usuario) throw new Error('Sin sesión');

    if (this.modo === 'firebase') {
      const raiz = this.db.collection('usuarios').doc(this.usuario.uid);
      const doc = await raiz.get();
      this.perfil = doc.exists ? doc.data() : {
        nombre: this.usuario.correo, correo: this.usuario.correo, tipoCuenta: 'personal'
      };
      await Promise.all(APP.colecciones.map(async col => {
        const snap = await raiz.collection(col).get();
        this.datos[col] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      }));
      return;
    }

    const u = this._leerLocal('am_usuarios', []).find(x => x.uid === this.usuario.uid);
    this.perfil = {
      nombre: u.nombre, correo: u.correo, tipoCuenta: u.tipoCuenta,
      negocio: u.negocio, creado: u.creado
    };
    const bolsa = this._leerLocal('am_datos_' + this.usuario.uid, {});
    APP.colecciones.forEach(c => { this.datos[c] = bolsa[c] || []; });
  },

  /* ============ Escritura ============ */

  /* Crea si no trae id; actualiza si lo trae. Devuelve el objeto guardado. */
  async guardar(coleccion, obj) {
    const lista = this.datos[coleccion];
    const registro = Object.assign({}, obj);

    if (registro.id) {
      const i = lista.findIndex(x => x.id === registro.id);
      if (i >= 0) lista[i] = registro; else lista.push(registro);
      if (this.modo === 'firebase') {
        const copia = Object.assign({}, registro); delete copia.id;
        await this._ref(coleccion).doc(registro.id).set(copia);
      } else this._volcarLocal();
      return registro;
    }

    registro.id = U.id();
    registro.creado = registro.creado || U.hoy();
    lista.push(registro);
    if (this.modo === 'firebase') {
      const copia = Object.assign({}, registro); delete copia.id;
      await this._ref(coleccion).doc(registro.id).set(copia);
    } else this._volcarLocal();
    return registro;
  },

  async borrar(coleccion, id) {
    this.datos[coleccion] = this.datos[coleccion].filter(x => x.id !== id);
    if (this.modo === 'firebase') await this._ref(coleccion).doc(id).delete();
    else this._volcarLocal();
  },

  async actualizarPerfil(parche) {
    this.perfil = Object.assign({}, this.perfil, parche);
    if (this.modo === 'firebase') {
      await this.db.collection('usuarios').doc(this.usuario.uid).set(this.perfil, { merge: true });
    } else {
      const usuarios = this._leerLocal('am_usuarios', []);
      const i = usuarios.findIndex(x => x.uid === this.usuario.uid);
      if (i >= 0) {
        usuarios[i] = Object.assign({}, usuarios[i], parche);
        this._guardarLocal('am_usuarios', usuarios);
      }
    }
  },

  /* Borra todos los datos del usuario (no la cuenta). */
  async vaciar() {
    for (const col of APP.colecciones) {
      if (this.modo === 'firebase') {
        for (const r of this.datos[col]) await this._ref(col).doc(r.id).delete();
      }
      this.datos[col] = [];
    }
    if (this.modo === 'local') this._volcarLocal();
  },

  /* ============ Consultas de conveniencia ============ */

  lista(coleccion) { return this.datos[coleccion] || []; },

  esEmpresa() { return this.perfil && this.perfil.tipoCuenta === 'empresarial'; },

  categoria(id) {
    return this.lista('categorias').find(c => c.id === id) || null;
  },

  nombreCategoria(id) {
    const c = this.categoria(id);
    return c ? c.nombre : 'Sin categoría';
  },

  /* ============ Internas ============ */

  _ref(coleccion) {
    return this.db.collection('usuarios').doc(this.usuario.uid).collection(coleccion);
  },

  async _sembrarCategorias(tipoCuenta) {
    const semilla = tipoCuenta === 'empresarial' ? APP.semillaEmpresa : APP.semillaPersonal;
    for (const c of semilla) await this.guardar('categorias', Object.assign({}, c));
  },

  _leerLocal(clave, porDefecto) {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? porDefecto : JSON.parse(v);
    } catch (e) { return porDefecto; }
  },

  _guardarLocal(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); }
    catch (e) { console.warn('No se pudo guardar en localStorage', e); }
  },

  _volcarLocal() {
    if (!this.usuario) return;
    const bolsa = {};
    APP.colecciones.forEach(c => { bolsa[c] = this.datos[c]; });
    this._guardarLocal('am_datos_' + this.usuario.uid, bolsa);
  },

  /* Traduce los códigos de error a algo que una persona entienda. */
  mensajeError(e) {
    const c = (e && e.code) || '';
    const mapa = {
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Probá entrar.',
      'auth/invalid-email': 'Ese correo no tiene un formato válido.',
      'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/user-not-found': 'No hay ninguna cuenta con ese correo.',
      'auth/too-many-requests': 'Demasiados intentos. Esperá un momento y volvé a probar.',
      'auth/network-request-failed': 'No hay conexión con el servidor. Revisá tu internet.',
      'auth/operation-not-allowed': 'Falta habilitar el acceso por correo y contraseña en Firebase.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
      'local/sin-correo': 'En modo local no se pueden enviar correos. Configurá Firebase para usar esto.'
    };
    return mapa[c] || (e && e.message) || 'Algo salió mal. Volvé a intentar.';
  }
};
