// nebula.js — Standalone nebula background engine
// Exports: initNebula(canvasId)
// Dependencies: none

(function() {
  const CLOUD_ANCHORS = [
    { id: 'core_pink', cx: 0.50, cy: 0.45, color: '#FF007F', r: 0.35, n: 3500 },
    { id: 'core_purp', cx: 0.50, cy: 0.55, color: '#6A0DAD', r: 0.40, n: 3000 },
    { id: 'arm_pink1', cx: 0.30, cy: 0.35, color: '#FF1493', r: 0.25, n: 1500 },
    { id: 'arm_pink2', cx: 0.70, cy: 0.65, color: '#FF69B4', r: 0.25, n: 1500 },
    { id: 'bg_dark',   cx: 0.50, cy: 0.50, color: '#2B00FF', r: 0.60, n: 2000 }, 
    { id: 'cyan_glow', cx: 0.45, cy: 0.75, color: '#00FA9A', r: 0.20, n: 1000 }, 
    { id: 'bright_ctr',cx: 0.50, cy: 0.50, color: '#E0B0FF', r: 0.15, n: 1200 }, 
  ];

  const STAR_TYPES = {
    dim:    { count: 1200, sizeRange: [0.5, 1.2], colors: ['#FFFFFF','#D0E8FF','#E0B0FF'], opacityRange: [0.3, 0.8] },
    mid:    { count: 400, sizeRange: [1.2, 2.2], colors: ['#FFFFFF','#A8D8FF','#FFB6C1'],   opacityRange: [0.6, 1.0] },
    bright: { count:  80, sizeRange: [2.5, 3.5], colors: ['#FFFFFF','#00FFFF','#FF69B4'],   opacityRange: [0.9, 1.0] },
  };

  const MILKY_WAY_LANES = [
    {
      angle: -25,          // degrees
      centerX: 0.5,
      centerY: 0.5,
      width: 0.7,          // fraction of canvas diagonal
      thickness: 0.25,     // perpendicular thickness
      color: '#6B8EC8',    // dusty blue
      particleCount: 2500,
      opacity: 0.35
    },
    {
      angle: -20,
      centerX: 0.45,
      centerY: 0.55,
      width: 0.8,
      thickness: 0.3,
      color: '#8B7BA8',    // purple-grey
      particleCount: 2000,
      opacity: 0.25
    },
    {
      angle: -30,
      centerX: 0.55,
      centerY: 0.48,
      width: 0.6,
      thickness: 0.18,
      color: '#B8947D',    // dusty brown-orange
      particleCount: 1500,
      opacity: 0.2
    }
  ];

  const NEBULA_ROTATION_SPEED = 0.000018; 
  const NEBULA_DRIFT_X = 0.004;

  const PERF = { tier: 3, lastCheck: 0, frameCount: 0, fps: 60 };
  const QUALITY_TIERS = {
    3: { dustMult: 1.0, starMult: 1.0, flareCount: 15, milkyWayMult: 1.0 },
    2: { dustMult: 0.6, starMult: 0.8, flareCount: 8,  milkyWayMult: 0.7 },
    1: { dustMult: 0.3, starMult: 0.5, flareCount: 4,  milkyWayMult: 0.4 },
  };

  let mainCanvas, mainCtx;
  let nebulaOffscreen, nebulaOffCtx;
  let starFieldOffscreen, starOffCtx;
  let brightStars = [];
  let twinkleGroups = [];
  let W, H;
  let time = 0;

  function hexToRgba(hex, alpha) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    throw new Error('Bad Hex');
  }

  function gaussianRandom(mean, std) {
    let u = 1 - Math.random();
    let v = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function bakeSingleFlare(color, size) {
    const fc = document.createElement('canvas');
    fc.width = fc.height = size * 10;
    const fx = fc.getContext('2d');
    const cx = fc.width / 2;

    const g = fx.createRadialGradient(cx, cx, 0, cx, cx, size * 2);
    g.addColorStop(0,   color);
    g.addColorStop(0.2, hexToRgba(color, 0.6));
    g.addColorStop(1,   hexToRgba(color, 0));
    fx.fillStyle = g;
    fx.fillRect(0, 0, fc.width, fc.height);

    fx.globalCompositeOperation = 'lighter';
    fx.strokeStyle = hexToRgba(color, 0.25);
    fx.lineWidth = 0.5;
    for (const angle of [0, Math.PI / 2]) {
      fx.save(); 
      fx.translate(cx, cx); 
      fx.rotate(angle); 
      fx.translate(-cx, -cx);
      
      fx.beginPath();
      fx.moveTo(cx - size * 4.5, cx);
      fx.lineTo(cx + size * 4.5, cx);
      fx.stroke();
      
      fx.restore();
    }

    return fc;
  }

  function bakeNebula(offCtx, W, H, tierSettings) {
    offCtx.clearRect(0, 0, W, H);
    offCtx.globalCompositeOperation = 'lighter';

    for (const anchor of CLOUD_ANCHORS) {
      const ax = anchor.cx * W;
      const ay = anchor.cy * H;
      const radius = anchor.r * Math.min(W, H);
      const count = Math.floor(anchor.n * tierSettings.dustMult);

      for (let i = 0; i < count; i++) {
        const px = gaussianRandom(ax, radius * 0.38);
        const py = gaussianRandom(ay, radius * 0.32);
        
        // Add structure by distinguishing between dense core lumps and diffuse wide clouds
        const isCore = Math.random() < 0.25; 
        const size = isCore ? 4 + Math.random() * 20 : 15 + Math.random() * 50;
        const alpha = isCore ? 0.015 + Math.random() * 0.025 : 0.003 + Math.random() * 0.012;

        const grad = offCtx.createRadialGradient(px, py, 0, px, py, size);
        grad.addColorStop(0,   hexToRgba(anchor.color, alpha * 3));
        grad.addColorStop(0.4, hexToRgba(anchor.color, alpha));
        grad.addColorStop(1,   hexToRgba(anchor.color, 0));

        offCtx.fillStyle = grad;
        offCtx.beginPath();
        offCtx.arc(px, py, size, 0, Math.PI * 2);
        offCtx.fill();
      }
    }

    // Milky Way dust lanes added back to fill empty space
    bakeMilkyWay(offCtx, W, H, tierSettings);

    bakeHeartLight(offCtx, W, H);
  }

  function bakeHeartLight(offCtx, W, H) {
    const cx = W * 0.5;
    const cy = H * 0.5;
    const radius = Math.min(W, H) * 0.42;

    offCtx.globalCompositeOperation = 'lighter';

    const warmBloom = offCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    warmBloom.addColorStop(0,    'rgba(255, 200, 80,  0.03)');
    warmBloom.addColorStop(0.25, 'rgba(255, 140, 40,  0.01)');
    warmBloom.addColorStop(0.6,  'rgba(180,  60, 20,  0.005)');
    warmBloom.addColorStop(1,    'rgba(0,     0,  0,  0.00)');

    offCtx.fillStyle = warmBloom;
    offCtx.fillRect(0, 0, W, H);

    const cyanBloom = offCtx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.55);
    cyanBloom.addColorStop(0,   'rgba(0, 240, 220, 0.01)');
    cyanBloom.addColorStop(0.5, 'rgba(0, 180, 200, 0.005)');
    cyanBloom.addColorStop(1,   'rgba(0,   0,   0, 0.00)');

    offCtx.fillStyle = cyanBloom;
    offCtx.fillRect(0, 0, W, H);
  }

  function bakeMilkyWay(offCtx, W, H, tierSettings) {
    offCtx.globalCompositeOperation = 'lighter';

    const diagonal = Math.sqrt(W * W + H * H);

    for (const lane of MILKY_WAY_LANES) {
      const angleRad = (lane.angle * Math.PI) / 180;
      const laneWidth = diagonal * lane.width;
      const laneThickness = diagonal * lane.thickness;
      // Drastically reduce count for large clouds instead of tiny particles
      const cloudCount = Math.floor((lane.particleCount / 15) * tierSettings.milkyWayMult);

      // Calculate lane center point
      const centerX = W * lane.centerX;
      const centerY = H * lane.centerY;

      // Rotation matrix components
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      for (let i = 0; i < cloudCount; i++) {
        // Generate cloud position along the lane using gaussian distribution
        const alongLane = gaussianRandom(0, laneWidth * 0.4);
        const perpLane = gaussianRandom(0, laneThickness * 0.35);

        // Rotate and translate to world coordinates
        const px = centerX + (alongLane * cosA - perpLane * sinA);
        const py = centerY + (alongLane * sinA + perpLane * cosA);

        // Skip clouds outside canvas bounds
        if (px < 0 || px > W || py < 0 || py > H) continue;

        // Calculate distance from lane center for opacity falloff
        const distFromCenter = Math.abs(perpLane) / laneThickness;
        const falloff = Math.max(0, 1 - distFromCenter * 1.5);

        // Large, soft cloud sizes instead of sharp particles
        const size = 30 + Math.random() * 90;
        const cloudAlpha = lane.opacity * falloff * 0.04 * (0.5 + Math.random() * 0.5);

        // Draw cloud with very soft gradient
        const grad = offCtx.createRadialGradient(px, py, 0, px, py, size);
        grad.addColorStop(0, hexToRgba(lane.color, cloudAlpha * 1.5));
        grad.addColorStop(0.4, hexToRgba(lane.color, cloudAlpha));
        grad.addColorStop(1, hexToRgba(lane.color, 0));

        offCtx.fillStyle = grad;
        offCtx.beginPath();
        offCtx.arc(px, py, size, 0, Math.PI * 2);
        offCtx.fill();
      }
    }
  }

  function bakeStarField(W, H, tierSettings) {
    starOffCtx.clearRect(0, 0, W, H);
    starOffCtx.globalCompositeOperation = 'lighter';
    
    twinkleGroups.forEach(g => {
        g.ctx.clearRect(0, 0, W, H);
        g.ctx.globalCompositeOperation = 'lighter';
    });

    brightStars = [];
    const mult = tierSettings.starMult;

    ['dim', 'mid', 'bright'].forEach(type => {
      let conf = STAR_TYPES[type];
      let count = Math.floor(conf.count * mult);
      
      for(let i=0; i<count; i++) {
        let x = Math.random() * W;
        let y = Math.random() * H;
        let size = conf.sizeRange[0] + Math.random()*(conf.sizeRange[1] - conf.sizeRange[0]);
        let color = conf.colors[Math.floor(Math.random()*conf.colors.length)];
        let opacity = conf.opacityRange[0] + Math.random()*(conf.opacityRange[1] - conf.opacityRange[0]);

        if (type === 'bright') {
            brightStars.push({
                x, y, size, color, opacity,
                twinkleSpeed: 0.0005 + Math.random() * 0.001,
                phase: Math.random() * Math.PI * 2,
                hasFlare: false
            });
        } else {
            let group = twinkleGroups[Math.floor(Math.random() * twinkleGroups.length)];
            group.ctx.fillStyle = hexToRgba(color, opacity);
            group.ctx.beginPath();
            group.ctx.arc(x, y, size, 0, Math.PI * 2);
            group.ctx.fill();
            
            starOffCtx.fillStyle = hexToRgba(color, opacity * 0.3);
            starOffCtx.beginPath();
            starOffCtx.arc(x, y, size, 0, Math.PI * 2);
            starOffCtx.fill();
        }
      }
    });

    const flareCount = tierSettings.flareCount;
    for (let i = 0; i < brightStars.length; i++) {
        if (i < flareCount) {
            brightStars[i].flareSprite = bakeSingleFlare(brightStars[i].color, brightStars[i].size);
            brightStars[i].hasFlare = true;
        } else {
            starOffCtx.fillStyle = hexToRgba(brightStars[i].color, brightStars[i].opacity);
            starOffCtx.beginPath();
            starOffCtx.arc(brightStars[i].x, brightStars[i].y, brightStars[i].size, 0, Math.PI * 2);
            starOffCtx.fill();
        }
    }
  }

  function resizeAllCanvases() {
    W = window.innerWidth;
    H = window.innerHeight;
    mainCanvas.width = W;
    mainCanvas.height = H;
    
    // Make nebula target size the diagonal so it doesn't clip when rendered natively centered
    const maxSize = Math.sqrt(W*W + H*H); 
    nebulaOffscreen.width = maxSize;
    nebulaOffscreen.height = maxSize;
    
    starFieldOffscreen.width = W; 
    starFieldOffscreen.height = H;

    twinkleGroups.forEach(g => {
        g.canvas.width = W;
        g.canvas.height = H;
    });
  }

  function rebakeWithTier(tierSettings) {
      resizeAllCanvases();
      // Bake nebula at maxSize, not screen rect, since we translate/rotate it later directly from its center
      bakeNebula(nebulaOffCtx, nebulaOffscreen.width, nebulaOffscreen.height, tierSettings);
      bakeStarField(W, H, tierSettings);
  }

  function checkPerformance(timestamp) {
    PERF.frameCount++;
    if (timestamp - PERF.lastCheck >= 2000) { 
      PERF.fps = (PERF.frameCount / 2);
      PERF.frameCount = 0;
      PERF.lastCheck = timestamp;
  
      if (PERF.fps < 50 && PERF.tier > 1) {
        PERF.tier--;
        console.warn(`[Nebula] FPS ${PERF.fps.toFixed(1)} — stepping down to tier ${PERF.tier} (will apply on next resize)`);
      }
    }
  }

  function animate(timestamp) {
    time = timestamp;
    
    mainCtx.clearRect(0, 0, W, H);
    mainCtx.globalCompositeOperation = 'source-over'; // Default

    // Draw Nebula (additive) over transparent bg
    const angle = time * NEBULA_ROTATION_SPEED;
    const driftX = Math.sin(time * 0.00003) * 18;

    mainCtx.save();
    mainCtx.translate(W / 2 + driftX, H / 2);
    mainCtx.rotate(angle);
    mainCtx.globalCompositeOperation = 'lighter';
    // Offset by half its large square dimension to center it
    mainCtx.drawImage(nebulaOffscreen, -nebulaOffscreen.width / 2, -nebulaOffscreen.height / 2); 
    mainCtx.restore();
  
    // Base static star field
    mainCtx.globalCompositeOperation = 'lighter';
    mainCtx.drawImage(starFieldOffscreen, 0, 0);
  
    // Bright flares
    for (const star of brightStars) {
      if (!star.hasFlare) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(time * star.twinkleSpeed + star.phase);
      mainCtx.globalAlpha = twinkle;
      mainCtx.drawImage(star.flareSprite, star.x - star.flareSprite.width / 2, star.y - star.flareSprite.height / 2);
    }
    
    // Twinkle group bucket rendering
    for (const group of twinkleGroups) {
      const groupAlpha = 0.5 + 0.5 * Math.sin(time * group.speed + group.phase);
      if (Math.abs(groupAlpha - group.lastAlpha) > 0.02) { 
        group.lastAlpha = groupAlpha;
      }
      mainCtx.globalAlpha = group.lastAlpha;
      mainCtx.drawImage(group.canvas, 0, 0); 
    }
    
    mainCtx.globalAlpha = 1.0;
  
    checkPerformance(timestamp);
    requestAnimationFrame(animate);
  }

  window.initNebula = function(canvasId) {
    mainCanvas = document.getElementById(canvasId);
    mainCtx = mainCanvas.getContext('2d'); // default alpha behavior
    
    nebulaOffscreen = document.createElement('canvas');
    nebulaOffCtx = nebulaOffscreen.getContext('2d');
    
    starFieldOffscreen = document.createElement('canvas');
    starOffCtx = starFieldOffscreen.getContext('2d');

    twinkleGroups = [
      { speed: 0.0003, phase: 0, canvas: document.createElement('canvas'), ctx: null, lastAlpha: 0 },
      { speed: 0.0004, phase: 2, canvas: document.createElement('canvas'), ctx: null, lastAlpha: 0 },
      { speed: 0.0005, phase: 4, canvas: document.createElement('canvas'), ctx: null, lastAlpha: 0 },
      { speed: 0.0002, phase: 1, canvas: document.createElement('canvas'), ctx: null, lastAlpha: 0 },
      { speed: 0.0006, phase: 3, canvas: document.createElement('canvas'), ctx: null, lastAlpha: 0 },
    ];
    twinkleGroups.forEach(g => { g.ctx = g.canvas.getContext('2d'); });

    rebakeWithTier(QUALITY_TIERS[PERF.tier]);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        rebakeWithTier(QUALITY_TIERS[PERF.tier]);
      }, 250);
    });

    requestAnimationFrame(animate);
  };
})();
