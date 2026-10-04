/* ============================================================
   GRÁFICOS — SVG a mano, sin librerías externas
   ============================================================ */

const G = {

  /* ---------- Barras pareadas: entra vs sale por mes ---------- */
  barras(datos, opciones) {
    const o = Object.assign({ alto: 220, etiquetaA: 'Entra', etiquetaB: 'Sale' }, opciones);
    if (!datos.length) return '<p class="vacio-texto">Todavía no hay meses con datos.</p>';

    const ancho = 700, alto = o.alto;
    const mIzq = 54, mDer = 10, mArr = 14, mAba = 30;
    const w = ancho - mIzq - mDer, h = alto - mArr - mAba;

    const max = Math.max(1, ...datos.map(d => Math.max(d.a, d.b)));
    const paso = w / datos.length;
    const anchoBarra = Math.min(22, paso / 3.2);

    let s = `<svg class="grafico" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" role="img" aria-label="Comparación mensual">`;

    /* Reglas horizontales + escala */
    for (let i = 0; i <= 4; i++) {
      const y = mArr + (h / 4) * i;
      const val = max - (max / 4) * i;
      s += `<line x1="${mIzq}" y1="${y}" x2="${ancho - mDer}" y2="${y}" stroke="var(--linea)" stroke-width="1"/>`;
      s += `<text x="${mIzq - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--texto-3)" font-family="var(--cifra)">${Math.round(val)}</text>`;
    }

    datos.forEach((d, i) => {
      const cx = mIzq + paso * i + paso / 2;
      const hA = (d.a / max) * h, hB = (d.b / max) * h;
      const x1 = cx - anchoBarra - 2, x2 = cx + 2;

      s += `<rect x="${x1}" y="${mArr + h - hA}" width="${anchoBarra}" height="${hA}" fill="var(--jade)" rx="2">
              <title>${U.esc(d.etiqueta)} — ${o.etiquetaA}: ${U.dinero(d.a)}</title></rect>`;
      s += `<rect x="${x2}" y="${mArr + h - hB}" width="${anchoBarra}" height="${hB}" fill="var(--barro)" rx="2">
              <title>${U.esc(d.etiqueta)} — ${o.etiquetaB}: ${U.dinero(d.b)}</title></rect>`;
      s += `<text x="${cx}" y="${alto - 10}" text-anchor="middle" font-size="10" fill="var(--texto-3)">${U.esc(d.etiqueta)}</text>`;
    });

    s += '</svg>';
    s += `<div class="cinta-leyenda" style="color:var(--texto-3);margin-top:8px">
            <span><i style="background:var(--jade)"></i>${U.esc(o.etiquetaA)}</span>
            <span><i style="background:var(--barro)"></i>${U.esc(o.etiquetaB)}</span>
          </div>`;
    return s;
  },

  /* ---------- Dona: reparto por categoría ---------- */
  dona(datos, opciones) {
    const o = Object.assign({ tamano: 190, grosor: 26, centroTitulo: '', centroValor: '' }, opciones);
    const total = datos.reduce((a, d) => a + U.n(d.valor), 0);
    if (!total) return '<p class="vacio-texto">Sin datos para repartir todavía.</p>';

    const R = o.tamano / 2, r = R - o.grosor, cx = R, cy = R;
    let angulo = -Math.PI / 2;
    let s = `<svg class="grafico" viewBox="0 0 ${o.tamano} ${o.tamano}" style="max-width:${o.tamano}px;margin:0 auto" role="img" aria-label="Reparto por categoría">`;

    datos.forEach(d => {
      const frac = U.n(d.valor) / total;
      const fin = angulo + frac * Math.PI * 2;
      const grande = frac > 0.5 ? 1 : 0;
      const x1 = cx + R * Math.cos(angulo), y1 = cy + R * Math.sin(angulo);
      const x2 = cx + R * Math.cos(fin),    y2 = cy + R * Math.sin(fin);
      const x3 = cx + r * Math.cos(fin),    y3 = cy + r * Math.sin(fin);
      const x4 = cx + r * Math.cos(angulo), y4 = cy + r * Math.sin(angulo);

      /* Un círculo completo no se puede dibujar con un solo arco */
      if (frac > 0.999) {
        s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none"
                stroke="${d.color}" stroke-width="${o.grosor}"><title>${U.esc(d.etiqueta)} — 100%</title></circle>`;
      } else {
        s += `<path d="M${x1} ${y1} A${R} ${R} 0 ${grande} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${grande} 0 ${x4} ${y4} Z"
                fill="${d.color}"><title>${U.esc(d.etiqueta)} — ${U.dinero(d.valor)} (${U.pct(d.valor, total)}%)</title></path>`;
      }
      angulo = fin;
    });

    if (o.centroValor) {
      s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="9" fill="var(--texto-3)"
              letter-spacing="1.2" font-weight="600">${U.esc(o.centroTitulo.toUpperCase())}</text>`;
      s += `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="16" fill="var(--texto)"
              font-family="var(--cifra)">${U.esc(o.centroValor)}</text>`;
    }
    s += '</svg>';
    return s;
  },

  /* ---------- Leyenda para la dona ---------- */
  leyenda(datos) {
    const total = datos.reduce((a, d) => a + U.n(d.valor), 0) || 1;
    return '<div class="leyenda">' + datos.map(d => `
      <div class="leyenda-item">
        <span class="leyenda-color" style="background:${d.color}"></span>
        <span class="leyenda-nom">${U.esc(d.etiqueta)}</span>
        <span class="leyenda-val">${U.dinero(d.valor)} · ${U.pct(d.valor, total)}%</span>
      </div>`).join('') + '</div>';
  },

  /* ---------- LA CINTA DE CAJA (elemento firma) ----------
     Dibuja el saldo proyectado día a día como una cinta que se desenrolla.
     dias: [{ fecha, saldo, entra, sale }]  ·  quiebre: índice donde cruza cero */
  cintaCaja(dias) {
    if (!dias.length) return '';
    const ancho = 900, alto = 170;
    const mArr = 18, mAba = 26, mIzq = 8, mDer = 8;
    const w = ancho - mIzq - mDer, h = alto - mArr - mAba;

    const saldos = dias.map(d => d.saldo);
    const max = Math.max(0, ...saldos);
    const min = Math.min(0, ...saldos);
    const rango = (max - min) || 1;
    const y0 = mArr + h * (max / rango);              // línea del cero
    const px = i => mIzq + (w / Math.max(1, dias.length - 1)) * i;
    const py = v => mArr + h * ((max - v) / rango);

    let linea = '', areaPos = '', areaNeg = '';
    dias.forEach((d, i) => {
      linea += (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(d.saldo).toFixed(1) + ' ';
    });

    /* Relleno hasta el cero, recortado por encima y por debajo */
    const cierre = `L${px(dias.length - 1).toFixed(1)} ${y0.toFixed(1)} L${px(0).toFixed(1)} ${y0.toFixed(1)} Z`;
    areaPos = linea + cierre;

    let s = `<svg class="grafico" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none"
                role="img" aria-label="Saldo de caja proyectado">
      <defs>
        <clipPath id="sobreCero"><rect x="0" y="0" width="${ancho}" height="${y0}"/></clipPath>
        <clipPath id="bajoCero"><rect x="0" y="${y0}" width="${ancho}" height="${alto - y0}"/></clipPath>
        <linearGradient id="gPos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6FBF9B" stop-opacity=".55"/>
          <stop offset="100%" stop-color="#6FBF9B" stop-opacity=".04"/>
        </linearGradient>
        <linearGradient id="gNeg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#E08878" stop-opacity=".55"/>
          <stop offset="100%" stop-color="#E08878" stop-opacity=".04"/>
        </linearGradient>
      </defs>`;

    s += `<path d="${areaPos}" fill="url(#gPos)" clip-path="url(#sobreCero)"/>`;
    s += `<path d="${areaPos}" fill="url(#gNeg)" clip-path="url(#bajoCero)"/>`;
    s += `<line x1="${mIzq}" y1="${y0}" x2="${ancho - mDer}" y2="${y0}"
             stroke="rgba(224,160,58,.55)" stroke-width="1" stroke-dasharray="3 4"/>`;
    s += `<path d="${linea}" fill="none" stroke="#D6E0DA" stroke-width="2"
             stroke-linejoin="round" stroke-linecap="round"/>`;

    /* Marcas de eventos: cobros arriba, pagos abajo */
    dias.forEach((d, i) => {
      if (d.entra > 0) s += `<circle cx="${px(i).toFixed(1)}" cy="${py(d.saldo).toFixed(1)}" r="3.5"
        fill="#6FBF9B"><title>${U.fecha(d.fecha)} — cobro de ${U.dinero(d.entra)}</title></circle>`;
      if (d.sale > 0) s += `<circle cx="${px(i).toFixed(1)}" cy="${py(d.saldo).toFixed(1)}" r="3.5"
        fill="#E08878"><title>${U.fecha(d.fecha)} — pago de ${U.dinero(d.sale)}</title></circle>`;
    });

    /* Marcador del día en que la caja llega a cero */
    const quiebre = dias.findIndex(d => d.saldo < 0);
    if (quiebre > 0) {
      s += `<line x1="${px(quiebre).toFixed(1)}" y1="${mArr}" x2="${px(quiebre).toFixed(1)}" y2="${mArr + h}"
               stroke="#E08878" stroke-width="1.5"/>`;
      s += `<text x="${Math.min(px(quiebre) + 7, ancho - 120)}" y="${mArr + 12}" font-size="11"
               fill="#E08878" font-weight="600">Caja en cero</text>`;
    }

    /* Etiquetas de tiempo */
    const marcas = [0, Math.floor(dias.length / 3), Math.floor(dias.length * 2 / 3), dias.length - 1];
    marcas.forEach(i => {
      const d = dias[i]; if (!d) return;
      const anclaje = i === 0 ? 'start' : i === dias.length - 1 ? 'end' : 'middle';
      s += `<text x="${px(i).toFixed(1)}" y="${alto - 8}" text-anchor="${anclaje}" font-size="10"
               fill="#7E948C">${U.esc(U.fecha(d.fecha))}</text>`;
    });

    s += '</svg>';
    return s;
  },

  /* ---------- Barras horizontales simples (rankings) ---------- */
  ranking(datos, opciones) {
    const o = Object.assign({ color: 'var(--ocre)' }, opciones);
    if (!datos.length) return '<p class="vacio-texto">Sin datos todavía.</p>';
    const max = Math.max(...datos.map(d => Math.abs(U.n(d.valor)))) || 1;
    return '<div class="leyenda">' + datos.map(d => `
      <div>
        <div class="leyenda-item" style="grid-template-columns:1fr auto;margin-bottom:4px">
          <span class="leyenda-nom">${U.esc(d.etiqueta)}</span>
          <span class="leyenda-val">${U.dinero(d.valor)}</span>
        </div>
        <div class="progreso">
          <span class="progreso-relleno" style="width:${(Math.abs(U.n(d.valor)) / max) * 100}%;background:${d.color || o.color}"></span>
        </div>
      </div>`).join('') + '</div>';
  }
};
