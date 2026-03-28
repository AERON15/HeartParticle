(function () {
  const canvas = document.getElementById('heart');
  const ctx = canvas.getContext('2d', { alpha: true }); 

  const bloomA = document.createElement('canvas');
  const bCtxA = bloomA.getContext('2d');
  const bloomB = document.createElement('canvas');
  const bCtxB = bloomB.getContext('2d');

  const sparkleImg = document.createElement('canvas');
  sparkleImg.width = 64;
  sparkleImg.height = 64;
  const sCtx = sparkleImg.getContext('2d');

  // Blurred sparkle for depth-of-field (far particles)
  const sparkleImgBlurred = document.createElement('canvas');
  sparkleImgBlurred.width = 64;
  sparkleImgBlurred.height = 64;
  const sCtxBlur = sparkleImgBlurred.getContext('2d');

  let W, H, dpr, scale, cx, cy, maxDist;
  const BLOOM_SCALE = 0.15;
  let time = 0;

  // Nebula color palette for cycling
  const NEBULA_COLORS = [
    { name: 'orange',  core: '#FFE8D0', inner: '#FFB060', mid: '#FF8C42', outer: '#E06030', edge: '#B04020' },
    { name: 'magenta', core: '#FFE0F0', inner: '#FFB0D0', mid: '#D2386C', outer: '#A02050', edge: '#701840' },
    { name: 'purple',  core: '#F0E0FF', inner: '#C8A0E0', mid: '#8B3A5E', outer: '#6B2A4E', edge: '#4B1A3E' },
    { name: 'blue',    core: '#E0F0FF', inner: '#A0C8FF', mid: '#3A86FF', outer: '#2060C0', edge: '#1E5FBF' },
    { name: 'cyan',    core: '#E0FFFF', inner: '#80E8F0', mid: '#00CCDD', outer: '#0090A0', edge: '#006070' },
  ];

  let currentColorIndex = 0;
  let nextColorIndex = 1;
  let colorTransition = 0;

  const HEART_PALETTE = {
    core:       '#FFF8E0',
    innerGlow:  '#FFE080',
    midEnergy:  '#FFA040',
    outerLines: '#FF6B40',
    edgeFade:   '#D84A70',
    accent:     '#00FFEE',
    purple:     '#B888FF',
    magenta:    '#FF60C0',
  };

  // Depth-of-field configuration (0.0 = far, 1.0 = close)
  const DEPTH = {
    backgroundOrbs:   0.10,
    mandalaStreams:    0.30,
    spiralStreams:     0.35,
    roseCurves:       0.40,
    lissajousPatterns:0.45,
    epicycloidStreams: 0.50,
    radialStreams:     0.55,
    heartOutline:     0.60,
    breathingWaves:   0.70,
    fibonacciSpirals: 0.80,
    sparkles:         0.85,
    orbitalSparkles:  0.90,
    coreGlow:         1.00,
  };

  function depthMult(depth) {
    return {
      size:  0.65 + 0.35 * depth,
      alpha: 0.50 + 0.50 * depth,
      blurred: depth < 0.4,
    };
  }

  const bgCanvas = document.createElement('canvas');
  const bgCtx = bgCanvas.getContext('2d');

  function hexToRgba(hex, alpha) {
    if(!hex) return `rgba(0,0,0,${alpha})`;
    const c = parseInt(hex.slice(1), 16);
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    if (dpr > 2) dpr = 2; 

    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(W, H) * 0.025;
    cx = W / 2;
    cy = H / 2;
    maxDist = Math.min(W, H) * 0.5; 

    bloomA.width = Math.floor(W * BLOOM_SCALE);
    bloomA.height = Math.floor(H * BLOOM_SCALE);
    bloomB.width = bloomA.width;
    bloomB.height = bloomA.height;

    bgCanvas.width = W;
    bgCanvas.height = H;
  }
  window.addEventListener('resize', resize);
  resize();

  function updateGlobalGradient() {
    globalColorGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist);
    globalColorGrad.addColorStop(0, HEART_PALETTE.core);
    globalColorGrad.addColorStop(0.12, HEART_PALETTE.innerGlow);
    globalColorGrad.addColorStop(0.35, HEART_PALETTE.midEnergy);
    globalColorGrad.addColorStop(0.65, HEART_PALETTE.outerLines);
    globalColorGrad.addColorStop(1, HEART_PALETTE.edgeFade);

    sCtx.clearRect(0, 0, 64, 64);
    const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sGrad.addColorStop(0, HEART_PALETTE.core);
    sGrad.addColorStop(0.15, HEART_PALETTE.innerGlow);
    sGrad.addColorStop(0.4, HEART_PALETTE.midEnergy);
    sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 64, 64);

    // Blurred sparkle for far depth-of-field particles
    sCtxBlur.clearRect(0, 0, 64, 64);
    const sGradBlur = sCtxBlur.createRadialGradient(32, 32, 0, 32, 32, 32);
    sGradBlur.addColorStop(0, hexToRgba(HEART_PALETTE.core, 0.6));
    sGradBlur.addColorStop(0.08, hexToRgba(HEART_PALETTE.innerGlow, 0.5));
    sGradBlur.addColorStop(0.25, hexToRgba(HEART_PALETTE.midEnergy, 0.3));
    sGradBlur.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtxBlur.fillStyle = sGradBlur;
    sCtxBlur.fillRect(0, 0, 64, 64);
  }

  function heartX(t) {
    return 16 * Math.pow(Math.sin(t), 3);
  }
  
  function heartY(t) {
    return -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  }

  function heartPoint(t, s) {
    return [heartX(t) * s, heartY(t) * s];
  }

  // Interpolate between two hex colors
  function lerpColor(color1, color2, t) {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);

    const r1 = (c1 >> 16) & 255;
    const g1 = (c1 >> 8) & 255;
    const b1 = c1 & 255;

    const r2 = (c2 >> 16) & 255;
    const g2 = (c2 >> 8) & 255;
    const b2 = c2 & 255;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Update heart colors based on nebula palette cycling
  function updateHeartColors(t) {
    // Slow color transition cycle
    const cycleSpeed = 0.08;
    colorTransition += cycleSpeed * 0.016; // Approximate 60fps

    if (colorTransition >= 1) {
      colorTransition = 0;
      currentColorIndex = nextColorIndex;
      nextColorIndex = (nextColorIndex + 1) % NEBULA_COLORS.length;
    }

    // Smooth interpolation between current and next color
    const easeT = colorTransition * colorTransition * (3 - 2 * colorTransition); // Smoothstep
    const current = NEBULA_COLORS[currentColorIndex];
    const next = NEBULA_COLORS[nextColorIndex];

    HEART_PALETTE.core = lerpColor(current.core, next.core, easeT);
    HEART_PALETTE.innerGlow = lerpColor(current.inner, next.inner, easeT);
    HEART_PALETTE.midEnergy = lerpColor(current.mid, next.mid, easeT);
    HEART_PALETTE.outerLines = lerpColor(current.outer, next.outer, easeT);
    HEART_PALETTE.edgeFade = lerpColor(current.edge, next.edge, easeT);

    // Keep accent colors vibrant
    HEART_PALETTE.accent = '#00FFEE';
    HEART_PALETTE.purple = '#B888FF';
    HEART_PALETTE.magenta = '#FF60C0';
  }

  // Golden ratio for Fibonacci spirals
  const PHI = (1 + Math.sqrt(5)) / 2;

  // Epicycloid: circle rolling around another circle
  function epicycloid(t, R, r, phase) {
    const ratio = (R + r) / r;
    const x = (R + r) * Math.cos(t + phase) - r * Math.cos(ratio * t + phase);
    const y = (R + r) * Math.sin(t + phase) - r * Math.sin(ratio * t + phase);
    return [x, y];
  }

  // Fourier harmonics modulation
  function fourierWave(t, harmonics) {
    let sum = 0;
    for (let i = 0; i < harmonics.length; i++) {
      const {freq, amp, phase} = harmonics[i];
      sum += amp * Math.sin(freq * t + phase);
    }
    return sum;
  }

  // Fibonacci golden spiral
  function fibonacciSpiral(angle, scale) {
    const r = scale * Math.pow(PHI, angle / (Math.PI / 2));
    return [r * Math.cos(angle), r * Math.sin(angle)];
  }

  function drawStream(points, alpha, lineWidth) {
    if (points.length < 2) return;
    
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    if (points.length === 2) {
      ctx.lineTo(points[1][0], points[1][1]);
    } else {
      // Smooth Catmull-Rom spline through all points
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
      }
    }
    ctx.stroke();
  }

  // Comet trail: smooth tapered stroke from tail to glowing head
  function drawCometTrail(trailPoints, headSize, baseAlpha, color) {
    const len = trailPoints.length;
    if (len < 2) return;

    // Draw tapered trail as segments with decreasing width & alpha
    ctx.lineCap = 'round';
    for (let i = len - 2; i >= 0; i--) {
      const frac = 1 - (i / (len - 1));          // 1.0 at head, 0.0 at tail
      const width = headSize * (0.1 + 0.9 * frac);
      const alpha = baseAlpha * frac * frac;
      if (alpha < 0.005) continue;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color || globalColorGrad;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(trailPoints[i + 1].x, trailPoints[i + 1].y);
      ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
      ctx.stroke();
    }

    // Bright glowing head
    const head = trailPoints[0];
    ctx.globalAlpha = baseAlpha;
    ctx.drawImage(sparkleImg,
      head.x - headSize * 4,
      head.y - headSize * 4,
      headSize * 8, headSize * 8
    );
  }

  function drawBackground(t) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';

    const dm = depthMult(DEPTH.backgroundOrbs);
    // Dynamic, color-syncing fog using slightly darker edge hues to make heart pop
    const orbs = [
        { px: cx + Math.sin(t*0.2) * W*0.2, py: cy + Math.cos(t*0.26) * H*0.2, size: Math.max(W, H)*0.5 * dm.size, hex: HEART_PALETTE.edgeFade, a: 0.10 * dm.alpha },
        { px: cx + Math.cos(t*0.24) * W*0.25, py: cy + Math.sin(t*0.2) * H*0.3, size: Math.max(W, H)*0.4 * dm.size, hex: HEART_PALETTE.innerGlow, a: 0.08 * dm.alpha },
        { px: cx - Math.sin(t*0.16) * W*0.3, py: cy - Math.cos(t*0.3) * H*0.2, size: Math.max(W, H)*0.45 * dm.size, hex: HEART_PALETTE.outerLines, a: 0.10 * dm.alpha },
        { px: cx, py: cy, size: Math.max(W, H)*0.35 * dm.size, hex: HEART_PALETTE.midEnergy, a: 0.05 * dm.alpha },
    ];

    for (const orb of orbs) {
        const grad = ctx.createRadialGradient(orb.px, orb.py, 0, orb.px, orb.py, orb.size);
        grad.addColorStop(0, hexToRgba(orb.hex, orb.a));
        // Use a 50% opacity fade in the middle before dropping to 0
        grad.addColorStop(0.5, hexToRgba(orb.hex, orb.a * 0.4));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }
  }

  function drawHeartOutlineStreams(t) {
    const numStreams = 10;
    const steps = 70;
    const dm = depthMult(DEPTH.heartOutline);

    for (let s = 0; s < numStreams; s++) {
      const scaleFactor = 0.7 + (s / numStreams) * 0.35;
      const phase = s * 0.05 + t * 0.15;
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const param = (i / steps) * Math.PI * 2;
        let [hx, hy] = heartPoint(param, scaleFactor);

        // Fourier harmonics for complex wobble
        const harmonics = [
          {freq: 3, amp: 0.3, phase: phase},
          {freq: 5, amp: 0.15, phase: phase + s * 0.1},
          {freq: 7, amp: 0.08, phase: phase + s * 0.2},
          {freq: 2, amp: 0.2, phase: t * 0.3 + s}
        ];
        const wobble = fourierWave(param, harmonics);

        hx += Math.cos(param) * wobble;
        hy += Math.sin(param) * wobble;

        points.push([cx + hx * scale, cy + hy * scale]);
      }

      const alpha = (0.25 + 0.10 * Math.sin(s * 0.3 + t * 0.2)) * dm.alpha;
      const lw = (1.8 + Math.sin(s * 0.8 + t * 0.2) * 0.8) * dm.size;
      drawStream(points, alpha, lw);
    }
  }

  function drawMandalaStreams(t) {
    const numPetals = 10;
    const numLayers = 2;
    const steps = 60;
    const dm = depthMult(DEPTH.mandalaStreams);

    for (let layer = 0; layer < numLayers; layer++) {
      const layerScale = 0.2 + (layer / numLayers) * 0.75;

      for (let petal = 0; petal < numPetals; petal++) {
        const angleOffset = (petal / numPetals) * Math.PI * 2;
        const points = [];

        for (let i = 0; i <= steps; i++) {
          const param = (i / steps) * Math.PI * 2;
          const roseR = Math.cos(param * 3 + angleOffset + t * 0.2);
          const lissX = Math.sin(param * 2 + angleOffset + t * 0.15);
          const lissY = Math.cos(param * 3 + angleOffset * 0.5 + t * 0.1);

          const [hx, hy] = heartPoint(param, layerScale);
          const blendFactor = 0.5 + 0.5 * Math.sin(layer * 0.8 + t * 0.3);

          const fx = hx * blendFactor + roseR * lissX * 10 * (1 - blendFactor) * layerScale;
          const fy = hy * blendFactor + roseR * lissY * 10 * (1 - blendFactor) * layerScale;

          points.push([cx + fx * scale, cy + fy * scale]);
        }

        const alpha = (0.20 + 0.08 * Math.sin(layer * 0.5 + petal * 0.3 + t * 0.2)) * dm.alpha;
        const lw = (1.5 + 0.6 * Math.sin(layer + t * 0.1)) * dm.size;
        drawStream(points, alpha, lw);
      }
    }
  }

  function drawSpiralStreams(t) {
    const numSpirals = 6;
    const steps = 100;
    const dm = depthMult(DEPTH.spiralStreams);

    for (let s = 0; s < numSpirals; s++) {
      const phaseOff = (s / numSpirals) * Math.PI * 2;
      const spiralScale = 0.3 + (s / numSpirals) * 0.65;
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const param = (i / steps) * Math.PI * 4; 
        const [hx, hy] = heartPoint(param * 0.5, spiralScale);

        const modX = Math.sin(param * 5 + phaseOff + t * 0.25) * 2 * spiralScale;
        const modY = Math.cos(param * 4 + phaseOff + t * 0.2) * 2 * spiralScale;

        points.push([cx + (hx + modX) * scale, cy + (hy + modY) * scale]);
      }

      const alpha = (0.25 + 0.10 * Math.sin(s * 0.5 + t * 0.2)) * dm.alpha;
      const lw = (1.6 + 0.8 * Math.sin(s * 0.6 + t * 0.1)) * dm.size;
      drawStream(points, alpha, lw);
    }
  }

  function drawRadialStreams(t) {
    const numRays = 10;
    const steps = 50;
    const dm = depthMult(DEPTH.radialStreams);

    for (let r = 0; r < numRays; r++) {
      const angle = (r / numRays) * Math.PI * 2 + t * 0.08;
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const param = angle + Math.sin(frac * Math.PI * 3 + t * 0.5 + r) * 0.3;
        const [hx, hy] = heartPoint(param, frac * 0.95);

        const radX = Math.cos(angle) * frac * 14;
        const radY = Math.sin(angle) * frac * 14;
        const blend = frac * frac; 

        const fx = radX * (1 - blend) + hx * blend;
        const fy = radY * (1 - blend) + hy * blend;

        points.push([cx + fx * scale, cy + fy * scale]);
      }

      const alpha = (0.35 + 0.15 * Math.sin(r * 0.9 + t * 0.3)) * dm.alpha;
      drawStream(points, alpha, 2.0 * dm.size);
    }
  }

  function drawCore(t) {
    const dm = depthMult(DEPTH.coreGlow);
    ctx.globalAlpha = 0.3 * dm.alpha;
    const pulse = 1 + Math.sin(t * 1.5) * 0.2;
    const coreSize = Math.min(W, H) * 0.015 * pulse * dm.size;

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 3);
    coreGrad.addColorStop(0, 'rgba(255, 240, 220, 0.4)');
    coreGrad.addColorStop(0.5, 'rgba(255, 200, 100, 0.2)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enhanced epicycloid patterns - multiple beautiful orbits
  function drawEpicycloidStreams(t) {
    const numOrbits = 3;
    const steps = 90;
    const dm = depthMult(DEPTH.epicycloidStreams);

    for (let o = 0; o < numOrbits; o++) {
      const R = 7 + o * 1.8;
      const r = 2 + o * 0.5;
      const phase = (o / numOrbits) * Math.PI * 2 + t * (0.05 + o * 0.02);
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const param = (i / steps) * Math.PI * 2 * 3;
        let [ex, ey] = epicycloid(param, R, r, phase);

        // Blend with heart for organic flow
        const [hx, hy] = heartPoint(param * 0.4, 0.8);
        const blend = 0.5 + 0.1 * Math.sin(t * 0.3 + o);

        const fx = (ex * (1 - blend) + hx * blend) * scale;
        const fy = (ey * (1 - blend) + hy * blend) * scale;

        points.push([cx + fx, cy + fy]);
      }

      const alpha = (0.20 + 0.10 * Math.sin(o * 0.7 + t * 0.3)) * dm.alpha;
      const lw = (1.6 + o * 0.3) * dm.size;
      drawStream(points, alpha, lw);
    }
  }

  // Pure position function for Fibonacci particles (enables comet trails)
  function getFibonacciPos(arm, i, numArms, particlesPerArm, t) {
    const armAngle = (arm / numArms) * Math.PI * 2;
    const armPhase = t * 0.08 + arm * 0.5;
    const progress = i / particlesPerArm;
    const angle = armAngle + progress * Math.PI * 4 + armPhase;
    const spiralScl = 0.3 + progress * 0.6;
    let [sx, sy] = fibonacciSpiral(angle, spiralScl * 12);
    const flow = fourierWave(angle, [
      {freq: 2, amp: 0.8, phase: t * 0.3 + arm},
      {freq: 3, amp: 0.4, phase: t * 0.2}
    ]);
    sx += flow * 1.5;
    sy += flow * 1.5;
    return { x: cx + sx * scale, y: cy + sy * scale, progress };
  }

  // Beautiful Fibonacci spirals with flowing comet particles
  function drawFibonacciSpirals(t) {
    const numArms = 4;
    const particlesPerArm = 16;
    const TRAIL_COUNT = 12;
    const TRAIL_DT = 0.05;
    const dm = depthMult(DEPTH.fibonacciSpirals);

    for (let arm = 0; arm < numArms; arm++) {
      for (let i = 0; i < particlesPerArm; i++) {
        const trail = [];
        for (let ti = 0; ti < TRAIL_COUNT; ti++) {
          trail.push(getFibonacciPos(arm, i, numArms, particlesPerArm, t - ti * TRAIL_DT));
        }

        const head = trail[0];
        const progress = head.progress;
        const pulse = 0.6 + 0.4 * Math.sin(progress * Math.PI * 3 + t * 0.5 + arm);
        const size = (2 + progress * 1.5) * pulse * dm.size;
        const alpha = (0.50 + 0.25 * Math.sin(i * 0.8 + t * 0.4)) * pulse * dm.alpha;

        drawCometTrail(trail, size, alpha, null);
      }
    }
  }

  // Beautiful Lissajous patterns with dynamic color variety
  function drawLissajousPatterns(t) {
    const numPatterns = 3;
    const steps = 100;
    const dm = depthMult(DEPTH.lissajousPatterns);
    // Mix dynamic palette colors with accent colors
    const colors = [
      HEART_PALETTE.midEnergy,  // Current palette mid-tone
      HEART_PALETTE.accent,     // Cyan accent
      HEART_PALETTE.outerLines, // Current palette outer
      HEART_PALETTE.purple      // Purple accent
    ];

    for (let p = 0; p < numPatterns; p++) {
      const a = 3 + p;
      const b = 2 + p * 0.5;
      const delta = (p / numPatterns) * Math.PI + t * 0.1;
      const scale_factor = 0.6 + (p / numPatterns) * 0.3;
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;

        // Lissajous curve equations
        const lx = Math.sin(a * theta + delta) * 12 * scale_factor;
        const ly = Math.sin(b * theta) * 12 * scale_factor;

        // Blend with heart shape
        const [hx, hy] = heartPoint(theta, scale_factor);
        const blend = 0.4 + 0.2 * Math.sin(t * 0.2 + p);

        const fx = (lx * (1 - blend) + hx * blend) * scale;
        const fy = (ly * (1 - blend) + hy * blend) * scale;

        points.push([cx + fx, cy + fy]);
      }

      const alpha = (0.25 + 0.12 * Math.sin(p * 0.6 + t * 0.25)) * dm.alpha;
      const lw = (1.8 + 0.6 * Math.sin(t * 0.3 + p)) * dm.size;

      // Use specific color for each pattern
      ctx.strokeStyle = colors[p];
      drawStream(points, alpha, lw);
      ctx.strokeStyle = globalColorGrad;  // Reset
    }
  }

  // Rose curve patterns with color and breathing effect
  function drawRoseCurves(t) {
    const numRoses = 2;
    const steps = 120;
    const dm = depthMult(DEPTH.roseCurves);

    for (let r = 0; r < numRoses; r++) {
      const n = 5 + r * 2;  // Number of petals
      const d = 1;
      const phase = t * 0.06 + (r / numRoses) * Math.PI * 2;
      const breathe = 0.85 + 0.15 * Math.sin(t * 0.4 + r);
      const scale_factor = (0.5 + (r / numRoses) * 0.4) * breathe;
      const points = [];

      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;

        // Rose curve: r = cos(n/d * θ)
        const rose_r = Math.cos((n / d) * theta + phase) * 10 * scale_factor;
        const rx = rose_r * Math.cos(theta);
        const ry = rose_r * Math.sin(theta);

        // Blend with heart
        const [hx, hy] = heartPoint(theta, scale_factor * 1.2);
        const blend = 0.5;

        const fx = (rx * (1 - blend) + hx * blend) * scale;
        const fy = (ry * (1 - blend) + hy * blend) * scale;

        points.push([cx + fx, cy + fy]);
      }

      const alpha = (0.30 + 0.15 * Math.sin(r * 0.8 + t * 0.3)) * dm.alpha;
      const lw = (1.6 + 0.5 * Math.sin(t * 0.2)) * dm.size;
      drawStream(points, alpha, lw);
    }
  }

  // Breathing wave particles flowing around the heart
  function drawBreathingWaves(t) {
    const numWaves = 35;
    const numLayers = 2;
    const dm = depthMult(DEPTH.breathingWaves);

    for (let layer = 0; layer < numLayers; layer++) {
      const layerPhase = (layer / numLayers) * Math.PI * 2;
      const layerScale = 0.7 + layer * 0.15;

      for (let w = 0; w < numWaves; w++) {
        const angle = (w / numWaves) * Math.PI * 2;
        const wavePhase = t * 0.3 + layerPhase;

        // Calculate position on heart outline
        const [hx, hy] = heartPoint(angle, layerScale);

        // Add breathing wave offset
        const waveOffset = 2 + 1.5 * Math.sin(angle * 5 + wavePhase);
        const normalX = Math.cos(angle);
        const normalY = Math.sin(angle);

        const px = cx + (hx + normalX * waveOffset) * scale;
        const py = cy + (hy + normalY * waveOffset) * scale;

        // Pulsing particle
        const pulse = 0.5 + 0.5 * Math.sin(w * 0.8 + t * 0.5 + layer);
        const size = (1.5 + layer * 0.5) * pulse * dm.size;
        const alpha = ((0.4 + 0.2 * pulse) / (layer + 1)) * dm.alpha;

        // Color variation using current palette
        const colorMix = (w / numWaves + t * 0.05) % 1;
        let color;
        if (colorMix < 0.25) {
          color = HEART_PALETTE.midEnergy;
        } else if (colorMix < 0.5) {
          color = HEART_PALETTE.outerLines;
        } else if (colorMix < 0.75) {
          color = HEART_PALETTE.accent;
        } else {
          color = HEART_PALETTE.purple;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Pure position function for orbital sparkles (enables comet trails)
  function getOrbitalPos(orbit, p, numOrbits, particlesPerOrbit, t) {
    const a = 8 + orbit * 1.5;
    const e = 0.2;
    const omega = (orbit / numOrbits) * Math.PI * 2;
    const meanAnomaly = (p / particlesPerOrbit) * Math.PI * 2 + t * (0.15 + orbit * 0.03);
    const E = meanAnomaly + e * Math.sin(meanAnomaly);
    const trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );
    const r = a * (1 - e * Math.cos(E));
    const orbX = r * Math.cos(trueAnomaly);
    const orbY = r * Math.sin(trueAnomaly);
    return {
      x: cx + (orbX * Math.cos(omega) - orbY * Math.sin(omega)) * scale,
      y: cy + (orbX * Math.sin(omega) + orbY * Math.cos(omega)) * scale,
      r, a
    };
  }

  // Orbital sparkles with comet trails
  function drawOrbitalSparkles(t) {
    const numOrbits = 3;
    const particlesPerOrbit = 4;
    const TRAIL_COUNT = 14;
    const TRAIL_DT = 0.06;
    const dm = depthMult(DEPTH.orbitalSparkles);

    for (let orbit = 0; orbit < numOrbits; orbit++) {
      for (let p = 0; p < particlesPerOrbit; p++) {
        const trail = [];
        for (let ti = 0; ti < TRAIL_COUNT; ti++) {
          trail.push(getOrbitalPos(orbit, p, numOrbits, particlesPerOrbit, t - ti * TRAIL_DT));
        }

        const head = trail[0];
        const velocity = Math.sqrt(2 / head.r - 1 / head.a);
        const brightness = 0.3 + velocity * 0.3;
        const size = (1.5 + brightness) * dm.size;

        drawCometTrail(trail, size, brightness * 0.6 * dm.alpha, null);
      }
    }
  }

  function drawSparkles(t) {
    const numSparkles = 60;
    const dm = depthMult(DEPTH.sparkles);
    const tex = dm.blurred ? sparkleImgBlurred : sparkleImg;
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < numSparkles; i++) {
      const param = (i / numSparkles) * Math.PI * 2;
      const sFactor = 0.85 + Math.sin(i * 2.3 + t * 0.5) * 0.15; 
      const [hx, hy] = heartPoint(param, sFactor);

      const jx = Math.sin(i * 7.7 + t * 0.6) * 1.5;
      const jy = Math.cos(i * 5.3 + t * 0.4) * 1.5;

      const sx = cx + (hx + jx) * scale;
      const sy = cy + (hy + jy) * scale;

      const twinkle = 0.5 + 0.5 * Math.sin(i * 3.1 + t * 0.5);
      ctx.globalAlpha = twinkle * 0.9 * dm.alpha;

      const r = (0.6 + twinkle * 1.5) * dm.size;
      const size = r * 12;

      ctx.drawImage(tex, sx - size / 2, sy - size / 2, size, size);
    }
  }

  function drawWithBloom(t) {
    updateHeartColors(t);  // Cycle through nebula colors
    updateGlobalGradient();
    drawBackground(t);

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = globalColorGrad;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Mathematical foundation - the stars of the show
    drawRoseCurves(t);               // Beautiful rose curve patterns
    drawLissajousPatterns(t);        // Flowing Lissajous curves
    drawEpicycloidStreams(t);        // Enhanced epicycloid orbits
    drawFibonacciSpirals(t);         // Golden ratio particle spirals

    // Base geometric layers
    drawRadialStreams(t);
    drawMandalaStreams(t);
    drawSpiralStreams(t);

    // Top layers - heart definition and animation
    drawHeartOutlineStreams(t);
    drawBreathingWaves(t);           // Breathing wave particles
    drawSparkles(t);
    drawOrbitalSparkles(t);          // Orbital mechanics sparkles
    drawCore(t);                     // Subtle center point

    const bw = bloomA.width;
    const bh = bloomA.height;
    bCtxA.clearRect(0, 0, bw, bh);
    bCtxA.drawImage(canvas, 0, 0, bw, bh);

    bCtxB.clearRect(0, 0, bw, bh);
    bCtxB.filter = 'blur(4px)'; 
    bCtxB.drawImage(bloomA, 0, 0);
    bCtxB.filter = 'none';

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8; 
    ctx.drawImage(bloomB, 0, 0, bw, bh, 0, 0, W, H);
  }

  let lastTime = 0;

  function drawHeartVignette() {
    const radius = Math.min(W, H) * 0.48;
    ctx.globalCompositeOperation = 'source-over';
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.38, cx, cy, radius);
    vignette.addColorStop(0,   'rgba(5, 8, 20, 0.00)');   
    vignette.addColorStop(0.7, 'rgba(5, 8, 20, 0.35)');   
    vignette.addColorStop(1,   'rgba(5, 8, 20, 0.72)');   
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    time += dt;

    drawWithBloom(time);
    drawHeartVignette();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
