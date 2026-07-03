/* =====================================================================
   Daylight Hours Explorer  --  Accessible HTML5 port
   ---------------------------------------------------------------------
   Behavior ported verbatim from the decompiled ActionScript (AS1):
     scripts/Daylight Hours Explorer.as   (main controller)
     scripts/Daylight Hours Plot.as       (getSunDeclination / getDaylightHours / curve)
     scripts/DoyCursor.as, Doy Cursor Dot.as
     scripts/CelestialSphere.as + "2..9 CS *.as"  (3-D sphere engine)
     scripts/Globe Component v2.as        (globe: continents, axis, shading)
   All physics constants, tables and formulas are copied unchanged.
   Presentation follows the KL-UNL foundation + WCAG 2.1 AA.
   ===================================================================== */

'use strict';

/* -------- constants copied verbatim from Daylight Hours Plot.as -------- */
const DEG = Math.PI / 180;
const PLOT_W = 500;                 // p.plotWidth
const PLOT_H = 300;                 // p.plotHeight
const DOY_OFFSET = -0.3;            // p.doyOffset
const VERNAL_EQUINOX_DOY   = 78.2440148725013  + DOY_OFFSET;
const SUMMER_SOLSTICE_DOY  = 170.941194534302  + DOY_OFFSET;
const AUTUMNAL_EQUINOX_DOY = 264.516526602426  + DOY_OFFSET;
const WINTER_SOLSTICE_DOY  = 354.318929672241  + DOY_OFFSET;

const MONTHS = [
  {shortName:"Jan",longName:"January",  doy:0},
  {shortName:"Feb",longName:"February", doy:31},
  {shortName:"Mar",longName:"March",    doy:59},
  {shortName:"Apr",longName:"April",    doy:90},
  {shortName:"May",longName:"May",      doy:120},
  {shortName:"Jun",longName:"June",     doy:151},
  {shortName:"Jul",longName:"July",     doy:181},
  {shortName:"Aug",longName:"August",   doy:212},
  {shortName:"Sep",longName:"September",doy:243},
  {shortName:"Oct",longName:"October",  doy:273},
  {shortName:"Nov",longName:"November", doy:304},
  {shortName:"Dec",longName:"December", doy:334}
];

const HOUR_TICK_LABELS = [0, 6, 12, 18, 24];   // p.hourTickmarkLabelsList

const EVENT_LABELS = [
  {name:"vernal equinox",   doy:VERNAL_EQUINOX_DOY},
  {name:"summer solstice",  doy:SUMMER_SOLSTICE_DOY},
  {name:"autumnal equinox", doy:AUTUMNAL_EQUINOX_DOY},
  {name:"winter solstice",  doy:WINTER_SOLSTICE_DOY}
];

/* plot colours (AS decimal RGB -> css) */
const COL_PLOT_BG   = "#b0b0b0";   // 11579568 background
const COL_FILL      = "#f0f0c0";   // 15790272 curveFillColor (daylight region)
const COL_CURVE     = "#404040";   // 4210752  curveColor
const COL_BORDER    = "#000000";   // 0
const COL_AVG       = "#6060ff";   // 6316287  averageLineColor
const COL_CURSOR    = "#ff5050";   // 16732240 cursor red

/* ---------------------------------------------------------------------
   PHYSICS  --  copied verbatim from Daylight Hours Plot.as
   --------------------------------------------------------------------- */

// p.getSunDeclination(doy) : returns the Sun's declination (radians)
function getSunDeclination(doy) {
  doy -= DOY_OFFSET;
  const sin = Math.sin, cos = Math.cos;
  const l5 = -0.0000043796019
    + 0.001830724  * cos(0.017214206 * doy) - 0.032070267  * sin(0.017214206 * doy)
    - 0.015952904  * cos(0.034428413 * doy) - 0.04026479   * sin(0.034428413 * doy)
    - 0.00044373354* cos(0.051642619 * doy) - 0.0013114725 * sin(0.051642619 * doy)
    - 0.00064591583* cos(0.068856825 * doy) - 0.00070547099* sin(0.068856825 * doy);
  const l6 = 0.01721421 * doy - 1.3793799796 - l5;
  return Math.atan2(sin(l6), 2.30644456403329);
}

// p.getDaylightHours(latitude, sunDeclination) : latitude & dec in radians -> hours
function getDaylightHours(latitude, sunDeclination) {
  const l4 = (-Math.tan(latitude)) * Math.tan(sunDeclination);
  const l2 = Math.asin(l4);
  let l5;
  if (isNaN(l2)) {
    if (Math.abs(sunDeclination) < 0.000001) {
      l5 = 12;
    } else {
      l5 = !((sunDeclination > 0 && latitude > 0) || (sunDeclination < 0 && latitude < 0)) ? 0 : 24;
    }
  } else {
    l5 = 24 * (-2 * l2 + Math.PI) / (2 * Math.PI);
  }
  return l5;
}

/* =====================================================================
   CELESTIAL SPHERE ENGINE  (ported from "2..4,9 CS *.as" + CelestialSphere.as)
   Only the pieces the Daylight Hours globe actually uses are kept, but the
   maths (matrices, projection, circle drawing) are identical to the source.
   ===================================================================== */
class CelestialSphere {
  constructor(size) {
    this.c = {};
    this.c.r = size / 2;              // setSize: _c.r = size/2  (size 170 -> r 85)
    this.c.r2 = this.c.r * this.c.r;
    this._theta = 0; this._phi = 0; this._lat = 0; this._sTime = 0;
    this.setLatitude(90);            // this.sphereMC.latitude = 90
    this.setSiderealTime(0);
    this.setThetaAndPhi(90, 30);
    this.maxPhi = 89.9; this.minPhi = -89.9;
  }
  // p.doA : viewer (theta,phi) rotation, scaled by r
  doA() {
    const c = this.c, r = c.r;
    const ct = Math.cos(this._theta), st = Math.sin(this._theta);
    const cp = Math.cos(this._phi),   sp = Math.sin(this._phi);
    c.a0 = -r*st;      c.a1 = r*ct;       /* a2 = 0 */
    c.a3 = r*ct*sp;    c.a4 = r*st*sp;    c.a5 = -r*cp;
    c.a6 = r*ct*cp;    c.a7 = r*st*cp;    c.a8 = r*sp;
  }
  // p.doM : celestial -> horizon (latitude, sidereal time)
  doM() {
    const c = this.c;
    c.m2 = Math.cos(this._lat);
    c.m3 = Math.sin(this._sTime);
    c.m4 = -Math.cos(this._sTime);
    c.m8 = Math.sin(this._lat);
    c.m0 = c.m4 * c.m8;
    c.m1 = -c.m3 * c.m8;
    c.m6 = -c.m2 * c.m4;
    c.m7 =  c.m2 * c.m3;
  }
  // p.doB : combined celestial -> screen  (b = a . m)
  doB() {
    const c = this.c;
    c.b0 = c.a0*c.m0 + c.a1*c.m3;
    c.b1 = c.a0*c.m1 + c.a1*c.m4;
    c.b2 = c.a0*c.m2;
    c.b3 = c.a3*c.m0 + c.a4*c.m3 + c.a5*c.m6;
    c.b4 = c.a3*c.m1 + c.a4*c.m4 + c.a5*c.m7;
    c.b5 = c.a3*c.m2 + c.a5*c.m8;
    c.b6 = c.a6*c.m0 + c.a7*c.m3 + c.a8*c.m6;
    c.b7 = c.a6*c.m1 + c.a7*c.m4 + c.a8*c.m7;
    c.b8 = c.a6*c.m2 + c.a8*c.m8;
  }
  setLatitude(deg) {
    if (deg > 90) deg = 90; else if (deg < -90) deg = -90;
    this._lat = deg * DEG; this.doM(); this.doB();
  }
  setSiderealTime(hours) {
    this._sTime = ((hours % 24) + 24) % 24 * 0.2617993877991494;
    this.doM(); this.doB();
  }
  setThetaAndPhi(theta, phi) {
    this._theta = DEG * (((theta % 360) + 360) % 360);
    if (phi > this.maxPhi) phi = this.maxPhi; else if (phi < this.minPhi) phi = this.minPhi;
    this._phi = phi * DEG;
    this.doA(); this.doB();
  }
  // celestial point (x,y,z) -> screen (x,y,z)  (p.CtoSz)
  CtoSz(p, sp) {
    const c = this.c;
    sp.x = p.x*c.b0 + p.y*c.b1 + p.z*c.b2;
    sp.y = p.x*c.b3 + p.y*c.b4 + p.z*c.b5;
    sp.z = p.x*c.b6 + p.y*c.b7 + p.z*c.b8;
  }
  // celestial -> world/horizon (p.CtoW)
  CtoW(p, wp) {
    const c = this.c;
    wp.x = p.x*c.m0 + p.y*c.m3 + p.z*c.m6;
    wp.y = p.x*c.m1 + p.y*c.m4;
    wp.z = p.x*c.m2 + p.z*c.m8;
  }
}

/* ---------------------------------------------------------------------
   Celestial circle (equator / day arc / night arc)  --  from "8 CS Circles.as"
   Renders only the FRONT-facing arc(s) (the near hemisphere over the globe),
   which is what is visible on the opaque globe.
   --------------------------------------------------------------------- */
const MIN_STEP = 0.7853981633974483;   // p._minStep

class CSCircle {
  constructor(sphere, style) {
    this.sphere = sphere;
    this._tilt = 0; this._beta = 0; this._lambda = 0;
    this._gS = 0; this._gE = 0; this._sys = 1;  // celestial
    this.c = {};
    this.thick = style.thickness; this.color = style.color; this.alpha = style.alpha;
    this.visible = true;
  }
  mod(n, m) { return ((n % m) + m) % m; }
  // p.setParameters with {ra,dec,tilt,gammaStart,gammaEnd}
  setParameters(a) {
    this._sys = 1;
    if (isFinite(a.tilt))  this._tilt = a.tilt < 0 ? 0 : (a.tilt > 180 ? Math.PI : a.tilt * DEG);
    if (isFinite(a.dec))   this._lambda = a.dec < -90 ? -Math.PI : (a.dec > 90 ? Math.PI : a.dec * DEG);
    if (isFinite(a.ra))    this._beta = 0.2617993877991494 * this.mod(a.ra, 24);
    if (isFinite(a.gammaStart)) this._gS = DEG * this.mod(a.gammaStart, 360);
    if (isFinite(a.gammaEnd))   this._gE = DEG * this.mod(a.gammaEnd, 360);
    this.doW();
  }
  // p.doW : builds the circle's own rotation matrix w
  doW() {
    const st = Math.sin(this._tilt), ct = Math.cos(this._tilt);
    const sb = Math.sin(this._beta), cb = Math.cos(this._beta);
    const cl = Math.cos(this._lambda), sl = Math.sin(this._lambda);
    const c = this.c;
    c.w0 = cl*cb;      c.w1 = -cl*sb*ct;   c.w2 = sl*sb*st;
    c.w3 = cl*sb;      c.w4 = cl*cb*ct;    c.w5 = -sl*cb*st;
    c.w7 = cl*st;      c.w8 = sl*ct;
  }
  // Build screen-space coefficients v0..v8 (celestial branch of p.update)
  buildV() {
    const w = this.c, s = this.sphere.c, v = this.c;
    v.v0 = s.b0*w.w0 + s.b1*w.w3;
    v.v1 = s.b0*w.w1 + s.b1*w.w4 + s.b2*w.w7;
    v.v2 = s.b0*w.w2 + s.b1*w.w5 + s.b2*w.w8;
    v.v3 = s.b3*w.w0 + s.b4*w.w3;
    v.v4 = s.b3*w.w1 + s.b4*w.w4 + s.b5*w.w7;
    v.v5 = s.b3*w.w2 + s.b4*w.w5 + s.b5*w.w8;
    v.v6 = s.b6*w.w0 + s.b7*w.w3;
    v.v7 = s.b6*w.w1 + s.b7*w.w4 + s.b8*w.w7;
    v.v8 = s.b6*w.w2 + s.b7*w.w5 + s.b8*w.w8;
  }
  // Returns array of front-facing {g1,g2} arc ranges (radians) to stroke.
  frontArcs() {
    this.buildV();
    const v = this.c;
    const v6 = v.v6, v7 = v.v7, v8 = v.v8;
    const mag = Math.sqrt(v6*v6 + v7*v7);
    const out = [];
    const pushFront = (g1, g2) => out.push([g1, g2]);
    if (mag === 0) {
      if (v8 >= 0) pushFront(this._gS, this._gE);          // whole visible
      return out;
    }
    const k = -v8 / mag;
    if (k <= -1) { pushFront(this._gS, this._gE); return out; }
    if (k >= 1)  { return out; }                            // fully behind
    const asin = Math.asin(k);
    const at = Math.atan2(v6, v7);
    let f0, f1;   // the two angles bounding the FRONT arc
    if (Math.cos(asin) < 0) {
      f1 = this.mod(asin - at, 2*Math.PI);
      f0 = this.mod(Math.PI - asin - at, 2*Math.PI);
    } else {
      f1 = this.mod(Math.PI - asin - at, 2*Math.PI);
      f0 = this.mod(asin - at, 2*Math.PI);
    }
    // f0 -> f1 is the front-facing half of the full circle (drawArc(f0,f1,front))
    if (this._gS === this._gE) { pushFront(f0, f1); return out; }
    // Otherwise intersect the requested [gS,gE] arc with the front [f0,f1] window.
    const marks = [[f0,0],[f1,1],[this._gS,2],[this._gE,3]];
    marks.sort((a,b)=>a[0]-b[0]);
    let front=false, on=true;
    for (let i=0;i<4;i++){ const t=marks[i][1]; if(t===0)on=true; else if(t===1)on=false; else if(t===2)front=true; else front=false; }
    let prev = marks[3];
    for (let i=0;i<4;i++){
      const g1 = prev; const cur = marks[i];
      if (front && g1[0] !== cur[0] && on) pushFront(g1[0], cur[0]);
      const t = cur[1];
      if(t===0)on=true; else if(t===1)on=false; else if(t===2)front=true; else front=false;
      prev = cur;
    }
    return out;
  }
  // Stroke the given front arc ranges onto ctx (already translated to sphere centre).
  draw(ctx) {
    if (!this.visible) return;
    const arcs = this.frontArcs();
    const v = this.c;
    ctx.save();
    ctx.lineWidth = this.thick;
    ctx.strokeStyle = rgbaFromDec(this.color, this.alpha/100);
    ctx.lineCap = "round";
    for (const [g1r, g2r] of arcs) {
      let g1 = g1r, g2 = g2r;
      if (g2 < g1) g2 += 2*Math.PI;
      let span = g2 - g1; if (span === 0) span = 2*Math.PI;
      const n = Math.ceil(span / MIN_STEP);
      const step = span / n;
      ctx.beginPath();
      for (let i=0;i<=n;i++){
        const g = g1 + step*i;
        const cg = Math.cos(g), sg = Math.sin(g);
        const x = v.v0*cg + v.v1*sg + v.v2;
        const y = v.v3*cg + v.v4*sg + v.v5;
        if (i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------------------------------------------------------------------
   Globe (continents + rotation axis + night shading)
   ported from "Globe Component v2.as" (non-standalone branch)
   --------------------------------------------------------------------- */
class Globe {
  constructor(sphere) {
    this.sphere = sphere;
    this.rotationDeg = 40;         // instance.rotation = 40
    this.precessionDeg = 0;        // default
    this.axisLength = 1.15;        // instance.axisLength = 1.15
    this.showShading = true;
    this.sunPos = {x:1, y:0, z:0};
    this.c = {};                   // p (precession), r (rotation), q (combined)
    this.setPrecession(this.precessionDeg);
    this.setRotation(this.rotationDeg);
  }
  // p.setPrecession
  setPrecession(deg) {
    this._precession = (((deg % 360) + 360) % 360) * DEG;
    const cp = Math.cos(this._precession), sp = Math.sin(this._precession);
    const c = this.c;
    c.p0 = cp;          c.p1 = -sp;
    c.p3 = sp*0.91706;  c.p4 = cp*0.91706;  c.p5 = -0.39875;
    c.p6 = sp*0.39875;  c.p7 = cp*0.39875;  c.p8 = 0.91706;
    this.calcQ();
  }
  // p.setRotation  (non-standalone: angle = sphere.sTime + rotation)
  setRotation(deg) {
    this._rotationAngle = (((deg % 360) + 360) % 360) * DEG;
    this.calcR(); this.calcQ();
  }
  calcR() {
    const ang = this.sphere._sTime + this._rotationAngle;
    const cr = Math.cos(ang), sr = Math.sin(ang);
    const c = this.c;
    c.r0 = cr;           c.r1 = -sr;
    c.r3 = sr*0.91706;   c.r4 = cr*0.91706;  c.r5 = 0.39875;
    c.r6 = -sr*0.39875;  c.r7 = -cr*0.39875; c.r8 = 0.91706;
  }
  calcQ() {
    const c = this.c;
    if (c.r0 === undefined) this.calcR();
    c.q0 = c.p0*c.r0 + c.p1*c.r3;
    c.q1 = c.p0*c.r1 + c.p1*c.r4;
    c.q2 = c.p1*c.r5;
    c.q3 = c.p3*c.r0 + c.p4*c.r3 + c.p5*c.r6;
    c.q4 = c.p3*c.r1 + c.p4*c.r4 + c.p5*c.r7;
    c.q5 = c.p4*c.r5 + c.p5*c.r8;
    c.q6 = c.p6*c.r0 + c.p7*c.r3 + c.p8*c.r6;
    c.q7 = c.p6*c.r1 + c.p7*c.r4 + c.p8*c.r7;
    c.q8 = c.p7*c.r5 + c.p8*c.r8;
  }
  // p.setSunPosition({ra:0, dec:deg}) -> unit celestial vector
  setSunPosition(dec_deg) {
    const dec = dec_deg * DEG;
    this.sunPos = { x: Math.cos(dec), y: 0, z: Math.sin(dec) };
  }

  /* Screen coefficients folding the globeMC 170% scale (size=1) into the
     (50/r) factor => net factor 1.0.  See CONVERSION_NOTES for derivation. */
  screenCoeffs() {
    const s = this.sphere.c, q = this.c;
    return {
      // X row  (b0,b1,b2) . q columns
      xX: s.b0*q.q0 + s.b1*q.q3 + s.b2*q.q6,
      xY: s.b0*q.q1 + s.b1*q.q4 + s.b2*q.q7,
      xZ: s.b0*q.q2 + s.b1*q.q5 + s.b2*q.q8,
      // Y row (b3,b4,b5)
      yX: s.b3*q.q0 + s.b4*q.q3 + s.b5*q.q6,
      yY: s.b3*q.q1 + s.b4*q.q4 + s.b5*q.q7,
      yZ: s.b3*q.q2 + s.b4*q.q5 + s.b5*q.q8,
      // depth row (b6,b7,b8)
      zX: s.b6*q.q0 + s.b7*q.q3 + s.b8*q.q6,
      zY: s.b6*q.q1 + s.b7*q.q4 + s.b8*q.q7,
      zZ: s.b6*q.q2 + s.b7*q.q5 + s.b8*q.q8
    };
  }

  // North pole direction (globe local +z) projected to screen (p.updateAxis)
  poleScreen() {
    const s = this.sphere.c, q = this.c;
    // local +z = (q2,q5,q8) in celestial coords
    return {
      x: s.b0*q.q2 + s.b1*q.q5 + s.b2*q.q8,
      y: s.b3*q.q2 + s.b4*q.q5 + s.b5*q.q8,
      z: s.b6*q.q2 + s.b7*q.q5 + s.b8*q.q8
    };
  }

  drawAxis(ctx) {
    const r = this.sphere.c.r;              // 85
    const p = this.poleScreen();            // magnitude ~ r at surface
    // surface point (r=1) .. outward (r=axisLength/size = 1.15)
    const inner = 1, outer = this.axisLength; // size = 1
    const draw = (sign, color) => {
      const x0 = sign * p.x * inner, y0 = sign * p.y * inner;
      const x1 = sign * p.x * outer, y1 = sign * p.y * outer;
      const zMid = sign * p.z;              // outer point depth sign
      ctx.save();
      ctx.lineWidth = 2;                     // setAxisStyle(2)
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
      return zMid;
    };
    // north pole axis: red (16711680); south pole axis: blue (255)
    return { north: () => draw(1, "#ff0000"), south: () => draw(-1, "#0000ff"), pz: p.z };
  }

  // p.updateGlobe : project the continent outlines and fill them.
  drawLand(ctx, landStyle) {
    const co = this.screenCoeffs();
    const limbR = this.sphere.c.r;          // 85
    const wrapR = 1.5 * limbR;              // globe-local 75 * 1.7 = 127.5
    const maxStep = 2 * Math.acos(limbR * 1.1 / wrapR);
    ctx.save();
    // clip to sphere disk so nothing spills past the limb
    ctx.beginPath(); ctx.arc(0, 0, limbR, 0, 2*Math.PI); ctx.clip();
    ctx.fillStyle = landStyle;
    const data = SHORE_DATA;
    for (let s = 0; s < data.length; s++) {
      const poly = data[s], len = poly.length;
      // find first index where a front-facing point follows a back-facing one
      let started = false, start = 0;
      for (start = 0; start < len; start++) {
        const pt = poly[start];
        const front = (pt.x*co.zX + pt.y*co.zY + pt.z*co.zZ) > 0;
        if (front) { if (started) break; started = true; } else started = false;
      }
      if (start === len) continue;          // whole polygon on far side (or fully front) -> skip like AS
      ctx.beginPath();
      let firstPt = poly[start % len];
      ctx.moveTo(firstPt.x*co.xX + firstPt.y*co.xY + firstPt.z*co.xZ,
                 firstPt.x*co.yX + firstPt.y*co.yY + firstPt.z*co.yZ);
      let wasBehind = false, angleLast = 0;
      for (let j = 1; j < len; j++) {
        const pt = poly[(start + j) % len];
        const behind = (pt.x*co.zX + pt.y*co.zY + pt.z*co.zZ) < 0;
        if (!behind) {
          const px = pt.x*co.xX + pt.y*co.xY + pt.z*co.xZ;
          const py = pt.x*co.yX + pt.y*co.yY + pt.z*co.yZ;
          if (wasBehind) {
            const ang = Math.atan2(py, px);
            let d = (((ang - angleLast) % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);
            let n, dStep;
            if (d > Math.PI) { d = 2*Math.PI - d; n = Math.ceil(d/maxStep); dStep = -d/n; }
            else             { n = Math.ceil(d/maxStep); dStep = d/n; }
            for (let k = 1; k <= n; k++) {
              const a = angleLast + dStep*k;
              ctx.lineTo(wrapR*Math.cos(a), wrapR*Math.sin(a));
            }
            ctx.lineTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        } else if (!wasBehind) {
          const px = pt.x*co.xX + pt.y*co.xY + pt.z*co.xZ;
          const py = pt.x*co.yX + pt.y*co.yY + pt.z*co.yZ;
          angleLast = Math.atan2(py, px);
          ctx.lineTo(wrapR*Math.cos(angleLast), wrapR*Math.sin(angleLast));
        }
        wasBehind = behind;
      }
      ctx.closePath();
      ctx.fill("evenodd");
    }
    ctx.restore();
  }

  // p.updateShading : night-side shadow (rotated, squashed half disk)
  drawShading(ctx) {
    if (!this.showShading) return;
    const sp = {};
    this.sphere.CtoSz(this.sunPos, sp);
    const rot = Math.atan2(sp.x, -sp.y);
    const mag = Math.sqrt(sp.x*sp.x + sp.y*sp.y + sp.z*sp.z);
    const squash = -sp.z / mag;               // _loc18_
    const nSeg = 4, seg = Math.PI/nSeg, half = seg/2;
    const R = 50, cRad = R/Math.cos(half);
    const scale = 1.7;                        // globeMC 170%
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(R, 0);
    let a = seg, b = seg - half;
    for (let i=0;i<nSeg;i++){
      quad(ctx, cRad*Math.cos(b), cRad*Math.sin(b), R*Math.cos(a), R*Math.sin(a));
      a += seg; b += seg;
    }
    for (let i=0;i<nSeg;i++){
      quad(ctx, cRad*Math.cos(b), squash*cRad*Math.sin(b), R*Math.cos(a), squash*R*Math.sin(a));
      a += seg; b += seg;
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.40)";       // shadingColor 0, alpha 40
    ctx.fill();
    ctx.restore();
  }
}

/* quadratic helper mirroring Flash curveTo */
function quad(ctx, cx, cy, x, y) { ctx.quadraticCurveTo(cx, cy, x, y); }

/* AS decimal RGB int + alpha(0..1) -> css rgba */
function rgbaFromDec(dec, alpha) {
  const r = (dec >> 16) & 255, g = (dec >> 8) & 255, b = dec & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* =====================================================================
   APPLICATION STATE (single source of truth) + render()
   ===================================================================== */
const state = {
  latitude: 41,           // degrees, latitudeSlider.value
  doy: 121,               // day-of-year (float), setDoy(121)
  showAverage: false,
  showCursor: true,
  sunDec: 0,              // radians
  hours: 0,
  hoursString: "0",
  latString: "",
  longDoyString: "",
  shortDoyString: "",
  // globe/sphere viewer orientation (setThetaAndPhi(140,0))
  theta: 140,
  phi: 0
};

let sphere, globe, equator, dayArc, nightArc;
let plotCanvas, plotCtx, globeCanvas, globeCtx;
let els = {};

/* ---- number formatting identical to AS toFixed / latString logic ---- */
function computeLatString(lat) {
  if (lat > 0) return lat.toFixed(1) + "° N";
  if (lat < 0) return (-lat).toFixed(1) + "° S";
  return "0.0°";
}
// spoken latitude with units (screen-reader)
function spokenLat(lat) {
  const v = Math.abs(lat).toFixed(1);
  if (lat > 0) return v + " degrees north";
  if (lat < 0) return v + " degrees south";
  return "0.0 degrees";
}

// p.onDoyChanged : build the date strings from doy
function computeDoyStrings(doy) {
  const d = Math.round(doy) % 365;
  let m = 1;
  while (m < 12) { if (d < MONTHS[m].doy) break; m++; }
  m -= 1;
  const day = 1 + d - MONTHS[m].doy;
  return { long: MONTHS[m].longName + " " + day, short: MONTHS[m].shortName + " " + day };
}

// p.update (recompute physics from state)
function recompute() {
  state.sunDec = getSunDeclination(state.doy);
  state.hours = getDaylightHours(state.latitude * DEG, state.sunDec);
  state.hoursString = state.hours.toFixed(1);
  state.latString = computeLatString(state.latitude);
  const ds = computeDoyStrings(state.doy);
  state.longDoyString = ds.long;
  state.shortDoyString = ds.short;
}

/* -------------------------- PLOT LAYOUT -------------------------- */
const PLOT = { ml:60, mt:55, mr:15, mb:55 };  // canvas margins around 500x300 area
const CANVAS_W = PLOT.ml + PLOT_W + PLOT.mr;   // 575
const CANVAS_H = PLOT.mt + PLOT_H + PLOT.mb;   // 410
// AS plot coords (px in 0..500, py in 0..-300) -> canvas px
function plotX(px) { return PLOT.ml + px; }
function plotY(py) { return PLOT.mt + PLOT_H + py; }  // py is <=0

// wrap helper (matches (a % w + w) % w)
function wrapW(v) { return ((v % PLOT_W) + PLOT_W) % PLOT_W; }

/* build the static HTML axis labels once (hours, months, events, axis titles) */
function buildPlotLabels() {
  const box = els.plotOverlays;
  box.innerHTML = "";
  const per = (cx, cy) => `left:${(cx/CANVAS_W*100).toFixed(3)}%;top:${(cy/CANVAS_H*100).toFixed(3)}%;`;
  const add = (cls, styleStr, text) => {
    const s = document.createElement("span");
    s.className = "dhe-lbl " + cls; s.setAttribute("style", styleStr); s.textContent = text;
    box.appendChild(s); return s;
  };
  const step = PLOT_W / 365;
  // event labels (top)
  for (const e of EVENT_LABELS) {
    const x = wrapW(step * (e.doy - VERNAL_EQUINOX_DOY));
    add("dhe-lbl--event", per(plotX(x), PLOT.mt - 40) + "transform:translate(-50%,0);",
        e.name.replace(" ", "\n"));
  }
  // month labels (bottom) -- centred within each month band, as in AS
  let prevX = wrapW(step * (MONTHS[0].doy - VERNAL_EQUINOX_DOY));
  for (let i = MONTHS.length - 1; i >= 0; i--) {
    const x = wrapW(step * (MONTHS[i].doy - VERNAL_EQUINOX_DOY));
    let cx;
    if (x > prevX) cx = x + (PLOT_W + prevX - x) / 2;
    else           cx = x + (prevX - x) / 2;
    add("dhe-lbl--month", per(plotX(cx % PLOT_W), plotY(0) + 6) + "transform:translate(-50%,0);",
        MONTHS[i].shortName);
    prevX = x;
  }
  // hour tick labels (left)
  for (const h of HOUR_TICK_LABELS) {
    const y = -PLOT_H / 24 * h;
    add("dhe-lbl--hour", per(plotX(0) - 10, plotY(y)) + "transform:translate(-100%,-50%);", String(h));
  }
  // axis titles
  add("dhe-lbl--axis", per(plotX(PLOT_W/2), plotY(0) + 28) + "transform:translate(-50%,0);", "Day of Year");
  const yAxis = add("dhe-lbl--axis dhe-lbl--yaxis",
      per(plotX(0) - 42, plotY(-PLOT_H/2)) + "transform:translate(-50%,-50%) rotate(-90deg);",
      "Number of Daylight Hours");
  // dynamic cursor tabs
  els.dayTab = add("dhe-tab dhe-tab--day", "", "");
  els.hoursTab = add("dhe-tab dhe-tab--hours", "", "");
}

/* -------------------------- PLOT DRAW -------------------------- */
function drawPlot() {
  const ctx = plotCtx;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // plot background
  ctx.fillStyle = COL_PLOT_BG;
  ctx.fillRect(plotX(0), plotY(0) - PLOT_H, PLOT_W, PLOT_H);

  // --- daylight curve + fill (ported from Daylight Hours Plot.as p.update) ---
  const lat = state.latitude;
  drawCurve(ctx, lat);

  // tick marks (month bottom, hour left, event top) -- drawn on canvas in black
  ctx.strokeStyle = COL_BORDER; ctx.lineWidth = 1; ctx.beginPath();
  const step = PLOT_W / 365;
  for (const e of EVENT_LABELS) {
    const x = wrapW(step * (e.doy - VERNAL_EQUINOX_DOY));
    ctx.moveTo(plotX(x), plotY(-PLOT_H)); ctx.lineTo(plotX(x), plotY(-PLOT_H) - 6);
  }
  for (const m of MONTHS) {
    const x = wrapW(step * (m.doy - VERNAL_EQUINOX_DOY));
    ctx.moveTo(plotX(x), plotY(0)); ctx.lineTo(plotX(x), plotY(0) + 7);
  }
  for (let h = 0; h <= 24; h++) {
    const y = -PLOT_H/24*h;
    ctx.moveTo(plotX(0), plotY(y)); ctx.lineTo(plotX(0) - 6, plotY(y));
  }
  ctx.stroke();

  // yearly average dashed line
  if (state.showAverage) {
    ctx.save();
    ctx.strokeStyle = COL_AVG; ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(plotX(0), plotY(-PLOT_H/2)); ctx.lineTo(plotX(PLOT_W), plotY(-PLOT_H/2));
    ctx.stroke();
    ctx.restore();
  }

  // plot border
  ctx.strokeStyle = COL_BORDER; ctx.lineWidth = 1;
  ctx.strokeRect(plotX(0), plotY(0) - PLOT_H, PLOT_W, PLOT_H);

  // cursor (dashed crosshair + dot)
  if (state.showCursor) drawCursor(ctx);
  updateCursorTabs();
}

// The daylight curve, matching the branching in AS p.update()
function drawCurve(ctx, latitude) {
  const scaleY = -PLOT_H / 24;
  if (latitude === -90 || latitude === 90) {
    // polar special cases (AS uses autumnal-vernal span)
    const x9 = wrapW(step0() * (AUTUMNAL_EQUINOX_DOY - VERNAL_EQUINOX_DOY));
    ctx.fillStyle = COL_FILL;
    ctx.beginPath();
    if (latitude === -90) {
      ctx.moveTo(plotX(x9), plotY(0));
      ctx.lineTo(plotX(x9), plotY(-PLOT_H));
      ctx.lineTo(plotX(PLOT_W), plotY(-PLOT_H));
      ctx.lineTo(plotX(PLOT_W), plotY(0));
      ctx.closePath(); ctx.fill();
      strokeSeg(ctx, x9, 0, x9, -PLOT_H);
    } else {
      ctx.moveTo(plotX(0), plotY(0));
      ctx.lineTo(plotX(0), plotY(-PLOT_H));
      ctx.lineTo(plotX(x9), plotY(-PLOT_H));
      ctx.lineTo(plotX(x9), plotY(0));
      ctx.closePath(); ctx.fill();
      strokeSeg(ctx, x9, -PLOT_H, x9, 0);
    }
    return;
  }

  const latRad = latitude * DEG;
  const scan = PLOT_W;                 // one sample per pixel (_loc17_)
  const dx = PLOT_W / scan;
  const ddoy = 365 / scan;
  let x = 0;
  let doy = VERNAL_EQUINOX_DOY - DOY_OFFSET;   // _loc3_
  let hours = getDaylightHours(latRad, getSunDeclination(doy + DOY_OFFSET));
  // Build fill polygon and curve stroke pieces
  const fill = [[plotX(0), plotY(scaleY * hours)]];
  const strokePts = [];               // array of arrays (contiguous strokable runs)
  let lineOn = (hours !== 0 && hours !== 24);
  let curRun = lineOn ? [[plotX(0), plotY(scaleY*hours)]] : null;
  let prevHours = hours;

  const sin = Math.sin, cos = Math.cos;
  for (let i = 0; i < scan; i++) {
    x += dx; doy += ddoy;
    // inline sun-dec (identical constants to getSunDeclination)
    const l3 = doy;
    const l13 = -0.0000043796019
      + 0.001830724  * cos(0.017214206*l3) - 0.032070267  * sin(0.017214206*l3)
      - 0.015952904  * cos(0.034428413*l3) - 0.04026479   * sin(0.034428413*l3)
      - 0.00044373354* cos(0.051642619*l3) - 0.0013114725 * sin(0.051642619*l3)
      - 0.00064591583* cos(0.068856825*l3) - 0.00070547099* sin(0.068856825*l3);
    const l14 = 0.01721421*l3 - 1.3793799796 - l13;
    const l8 = Math.atan2(sin(l14), 2.30644456403329);
    const l11 = Math.asin((-Math.tan(latRad)) * Math.tan(l8));
    if (isNaN(l11)) {
      hours = !((l8 > 0 && latRad > 0) || (l8 < 0 && latRad < 0)) ? 0 : 24;
    } else {
      hours = 24 * (-2*l11 + Math.PI) / (2*Math.PI);
    }
    const cx = plotX(x), cy = plotY(scaleY * hours);
    fill.push([cx, cy]);
    if (hours === 24 || hours === 0) {
      if (hours !== prevHours) { lineOn = true; if (!curRun) curRun = [[plotX(x - dx), plotY(scaleY*prevHours)]]; }
      if (lineOn) { curRun.push([cx, cy]); }
      if (lineOn) { lineOn = false; if (curRun) { strokePts.push(curRun); curRun = null; } }
    } else if (!lineOn) {
      lineOn = true; curRun = [[plotX(x - dx), plotY(scaleY*prevHours)], [cx, cy]];
    } else {
      curRun.push([cx, cy]);
    }
    prevHours = hours;
  }
  if (curRun && curRun.length) strokePts.push(curRun);

  // close fill down to baseline
  ctx.fillStyle = COL_FILL;
  ctx.beginPath();
  ctx.moveTo(fill[0][0], fill[0][1]);
  for (let i=1;i<fill.length;i++) ctx.lineTo(fill[i][0], fill[i][1]);
  ctx.lineTo(plotX(PLOT_W), plotY(0));
  ctx.lineTo(plotX(0), plotY(0));
  ctx.closePath();
  ctx.fill();

  // stroke the curve line only where daylight is strictly between 0 and 24h
  ctx.strokeStyle = COL_CURVE; ctx.lineWidth = 1; ctx.lineJoin = "round";
  for (const run of strokePts) {
    if (run.length < 2) continue;
    ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]);
    for (let i=1;i<run.length;i++) ctx.lineTo(run[i][0], run[i][1]);
    ctx.stroke();
  }
}
function step0() { return PLOT_W / 365; }
function strokeSeg(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = COL_CURVE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(plotX(x1), plotY(y1)); ctx.lineTo(plotX(x2), plotY(y2)); ctx.stroke();
}

// DoyCursor.update : dashed crosshair + dot
function drawCursor(ctx) {
  const x = PLOT_W * (state.doy - VERNAL_EQUINOX_DOY) / 365;   // _loc3_
  const y = -PLOT_H * state.hours / 24;                        // _loc2_
  ctx.save();
  ctx.strokeStyle = COL_CURSOR; ctx.lineWidth = 2; ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(plotX(0), plotY(y)); ctx.lineTo(plotX(x), plotY(y)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(plotX(x), plotY(0)); ctx.lineTo(plotX(x), plotY(y)); ctx.stroke();
  ctx.restore();
  // dot
  ctx.fillStyle = COL_CURSOR;
  ctx.beginPath(); ctx.arc(plotX(x), plotY(y), 4.5, 0, 2*Math.PI); ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.stroke();
}

function updateCursorTabs() {
  const show = state.showCursor;
  const x = PLOT_W * (state.doy - VERNAL_EQUINOX_DOY) / 365;
  const y = -PLOT_H * state.hours / 24;
  const perX = (cx) => (cx / CANVAS_W * 100).toFixed(3) + "%";
  const perY = (cy) => (cy / CANVAS_H * 100).toFixed(3) + "%";
  els.dayTab.style.display = show ? "" : "none";
  els.hoursTab.style.display = show ? "" : "none";
  if (!show) return;
  els.dayTab.textContent = state.shortDoyString;
  els.dayTab.style.left = perX(plotX(x));
  els.dayTab.style.top = perY(plotY(0) + 3);
  els.dayTab.style.transform = "translate(-50%,0)";
  els.hoursTab.textContent = state.hoursString;
  els.hoursTab.style.left = perX(plotX(0) - 3);
  els.hoursTab.style.top = perY(plotY(y));
  els.hoursTab.style.transform = "translate(-100%,-50%)";
}

/* -------------------------- GLOBE DRAW -------------------------- */
const GLOBE_CX = 130, GLOBE_CY = 130;
function drawGlobe() {
  const ctx = globeCtx;
  ctx.clearRect(0, 0, 260, 260);
  ctx.save();
  ctx.translate(GLOBE_CX, GLOBE_CY);

  // update sphere orientation + arc geometry from state
  sphere.setThetaAndPhi(state.theta, state.phi);
  globe.calcR(); globe.calcQ();
  globe.setSunPosition(state.sunDec * 180 / Math.PI);   // updateGlobe: setSunPosition({dec: sunDec deg})

  // day/night arc parameters (p.updateGlobe)
  let latC = state.latitude;
  if (latC < -89) latC = -89; else if (latC > 89) latC = 89;
  const gamma = state.hours / 2 * 15;
  dayArc.setParameters({ra:0, dec:latC, tilt:0, gammaStart:-gamma, gammaEnd:gamma});
  nightArc.setParameters({ra:0, dec:latC, tilt:0, gammaStart:gamma, gammaEnd:-gamma});
  if (state.hours >= 24)      { nightArc.visible = false; dayArc.visible = true; }
  else if (state.hours <= 0)  { nightArc.visible = true;  dayArc.visible = false; }
  else                        { nightArc.visible = true;  dayArc.visible = true; }

  // back pole axis (behind globe) first
  const axis = globe.drawAxis(ctx);
  // draw south/north stub whose outer point is on the far side, behind globe
  if (axis.pz <= 0) axis.north(); else axis.south();   // the behind one

  // water sphere disk (radial gradient)
  const r = sphere.c.r;
  const wg = ctx.createRadialGradient(0.32*r, -0.32*r, 2, 0, 0, r*1.25);
  wg.addColorStop(0, "#bcc8f5"); wg.addColorStop(1, "#728aeb");
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 2*Math.PI); ctx.fillStyle = wg; ctx.fill();

  // continents
  const lg = ctx.createRadialGradient(0.32*r, -0.32*r, 2, 0, 0, r*1.25);
  lg.addColorStop(0, "#b79562"); lg.addColorStop(1, "#86683e");
  globe.drawLand(ctx, lg);

  // night shading over the globe
  globe.drawShading(ctx);

  // equator + day/night arcs (front hemisphere, over the globe)
  equator.draw(ctx);
  if (nightArc.visible) nightArc.draw(ctx);
  if (dayArc.visible) dayArc.draw(ctx);

  // front pole axis (over globe)
  if (axis.pz > 0) axis.north(); else axis.south();

  ctx.restore();
}

/* -------------------------- GLOBE CAPTION -------------------------- */
function updateCaption() {
  // matches outputField text in updateTextfields()
  els.globeCaption.textContent =
    "an observer at a latitude of " + state.latString +
    " will receive " + state.hoursString + " hours of daylight on " + state.longDoyString;
}

/* =====================================================================
   MASTER RENDER
   ===================================================================== */
function render() {
  recompute();
  // plot title (p.updateTextfields: titleField)
  els.plotTitle.textContent = "Hours of Daylight per Day at " + state.latString;
  drawPlot();
  drawGlobe();
  updateCaption();
  // keep DOM controls in sync
  els.latInput.value = state.latitude.toFixed(1);
  syncSliderAria();
}

/* live-region announcements (committed changes, with units) */
let liveTimer = null;
function announce(msg) {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { els.liveRegion.textContent = msg; }, 60);
}
function announceState() {
  announce("Latitude " + spokenLat(state.latitude) + ". Day " + state.longDoyString +
           ". " + state.hoursString + " hours of daylight.");
}
function syncSliderAria() {
  els.latSlider.value = String(clampLat(state.latitude));
  els.latSlider.setAttribute("aria-valuetext", "latitude " + spokenLat(state.latitude));
  const doyVal = Math.round(state.doy - VERNAL_EQUINOX_DOY);
  els.doySlider.value = String(Math.max(0, Math.min(364, doyVal)));
  els.doySlider.setAttribute("aria-valuetext",
      "day of year " + state.longDoyString + ", " + state.hoursString + " hours of daylight");
  syncDoyDropdowns();
}
function clampLat(v){ return Math.max(-90, Math.min(90, v)); }

/* --- month/day dropdowns (365-day calendar from MONTHS table) --- */
function daysInMonth(m) { return (m < 11 ? MONTHS[m + 1].doy : 365) - MONTHS[m].doy; }
function doyToMonthDay(doy) {
  const d = Math.round(doy) % 365;
  let m = 1;
  while (m < 12) { if (d < MONTHS[m].doy) break; m++; }
  m -= 1;
  return { m, day: 1 + d - MONTHS[m].doy };
}
function populateDays(m) {
  const n = daysInMonth(m);
  let html = "";
  for (let d = 1; d <= n; d++) html += "<option value=\"" + d + "\">" + d + "</option>";
  els.daySelect.innerHTML = html;
}
function syncDoyDropdowns() {
  const md = doyToMonthDay(state.doy);
  if (parseInt(els.monthSelect.value, 10) !== md.m || els.daySelect.options.length !== daysInMonth(md.m)) {
    els.monthSelect.value = String(md.m);
    populateDays(md.m);
  }
  els.daySelect.value = String(md.day);
}

/* =====================================================================
   CONTROL WIRING
   ===================================================================== */
// latitude value snaps to 0.1 (slider precision "fixed digits" 1)
function setLatitude(v, doAnnounce) {
  v = clampLat(Math.round(v * 10) / 10);
  state.latitude = v;
  render();
  if (doAnnounce) announceState();
}
// p.setDoy
function setDoy(doy, doAnnounce) {
  state.doy = doy;
  render();
  if (doAnnounce) announceState();
}
// p.onDoySliderChanged : doy = sliderValue + vernalEquinoxDoy
function onDoySlider(v, doAnnounce) {
  setDoy(v + VERNAL_EQUINOX_DOY, doAnnounce);
}

function wireControls() {
  // latitude slider
  els.latSlider.addEventListener("input", () => setLatitude(parseFloat(els.latSlider.value), false));
  els.latSlider.addEventListener("change", () => announceState());
  // latitude text field (editable, like the Flash field)
  els.latInput.addEventListener("change", () => {
    const v = parseFloat(els.latInput.value);
    if (isFinite(v)) setLatitude(v, true); else render();
  });
  els.latInput.addEventListener("keydown", (e) => { if (e.key === "Enter") els.latInput.blur(); });

  // day-of-year slider
  els.doySlider.addEventListener("input", () => onDoySlider(parseInt(els.doySlider.value, 10), false));
  els.doySlider.addEventListener("change", () => announceState());

  // month / day dropdowns -> set the exact calendar day
  const onMonthDay = () => {
    const m = parseInt(els.monthSelect.value, 10);
    const maxD = daysInMonth(m);
    let day = parseInt(els.daySelect.value, 10);
    if (!day || day > maxD) day = Math.min(day || 1, maxD);
    setDoy(MONTHS[m].doy + (day - 1), true);
  };
  els.monthSelect.addEventListener("change", onMonthDay);
  els.daySelect.addEventListener("change", onMonthDay);

  // checkboxes
  els.showAverage.addEventListener("change", () => { state.showAverage = els.showAverage.checked; drawPlot(); });
  els.showCursor.addEventListener("change", () => {
    state.showCursor = els.showCursor.checked; drawPlot();
    announce(state.showCursor ? "Draggable point shown." : "Draggable point hidden.");
  });

  // masthead reset
  document.addEventListener("sim-reset", () => { doReset(); announce("Simulation reset."); });

  wirePlotDrag();
  wireGlobeDrag();
}

/* p.reset : exact initial state */
function doReset() {
  state.showAverage = false;
  state.showCursor = true;
  state.theta = 140; state.phi = 0;         // sphereMC.setThetaAndPhi(140,0)
  state.latitude = 41;                       // latitudeSlider.value = 41
  els.showAverage.checked = false;
  els.showCursor.checked = true;
  setDoy(121, false);                        // this.setDoy(121)
}

/* -------- plot: drag the point on the curve (DoyCursor.onMouseMoveFunc) -------- */
function wirePlotDrag() {
  const canvas = plotCanvas;
  let dragging = false, xOffsetPlot = 0;
  const toPlotCoords = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
    const cx = (ev.clientX - rect.left) * sx;
    const cy = (ev.clientY - rect.top) * sy;
    return { px: cx - PLOT.ml, py: cy - (PLOT.mt + PLOT_H) };  // plot coords (py<=0 upward)
  };
  const hitDot = (p) => {
    const x = PLOT_W * (state.doy - VERNAL_EQUINOX_DOY) / 365;
    const y = -PLOT_H * state.hours / 24;
    return Math.hypot(p.px - x, p.py - y) <= 12;
  };
  canvas.addEventListener("pointerdown", (ev) => {
    if (!state.showCursor) return;
    const p = toPlotCoords(ev);
    if (!hitDot(p)) return;
    dragging = true;
    const x = PLOT_W * (state.doy - VERNAL_EQUINOX_DOY) / 365;
    xOffsetPlot = x - p.px;                 // Doy Cursor Dot.onPress: xOffset
    canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const p = toPlotCoords(ev);
    // onMouseMoveFunc: xmouse + xOffset, wrapped over plotWidth
    let x = p.px + xOffsetPlot;
    x = ((x % PLOT_W) + PLOT_W) % PLOT_W;
    setDoy(365 * x / PLOT_W + VERNAL_EQUINOX_DOY, false);
    ev.preventDefault();
  });
  const end = (ev) => { if (dragging) { dragging = false; announceState(); try{canvas.releasePointerCapture(ev.pointerId);}catch(e){} } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

/* -------- globe: simple drag rotates the sphere (4 CS Mouse startSimpleDragging) -------- */
function wireGlobeDrag() {
  const canvas = globeCanvas;
  let dragging = false, dx0 = 0, dy0 = 0, theta0 = 0, phi0 = 0;
  const toSphere = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const sx = 260 / rect.width, sy = 260 / rect.height;
    return { x: (ev.clientX - rect.left) * sx - GLOBE_CX, y: (ev.clientY - rect.top) * sy - GLOBE_CY };
  };
  canvas.addEventListener("pointerdown", (ev) => {
    const m = toSphere(ev);
    dragging = true; dx0 = m.x; dy0 = m.y; theta0 = state.theta; phi0 = state.phi;
    canvas.setPointerCapture(ev.pointerId); ev.preventDefault();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const m = toSphere(ev);
    const r = sphere.c.r;
    // updateSimpleDragging: theta = dragTheta - (dx)/r ; phi = dragPhi + (dy)/r  (degrees)
    state.theta = theta0 - (m.x - dx0) / r * (180/Math.PI);
    state.phi = phi0 + (m.y - dy0) / r * (180/Math.PI);
    if (state.phi > 89.9) state.phi = 89.9; else if (state.phi < -89.9) state.phi = -89.9;
    drawGlobe();
    ev.preventDefault();
  });
  const end = (ev) => { if (dragging){ dragging=false; try{canvas.releasePointerCapture(ev.pointerId);}catch(e){} } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  // keyboard rotation for the globe
  canvas.addEventListener("keydown", (ev) => {
    const stepD = ev.shiftKey ? 15 : 5;
    let used = true;
    switch (ev.key) {
      case "ArrowLeft":  state.theta -= stepD; break;
      case "ArrowRight": state.theta += stepD; break;
      case "ArrowUp":    state.phi = Math.min(89.9, state.phi + stepD); break;
      case "ArrowDown":  state.phi = Math.max(-89.9, state.phi - stepD); break;
      default: used = false;
    }
    if (used) { ev.preventDefault(); drawGlobe();
      announce("Globe rotated. " + state.longDoyString + ", " + state.hoursString + " hours of daylight."); }
  });
}

/* =====================================================================
   INIT
   ===================================================================== */
function init() {
  plotCanvas = document.getElementById("plotCanvas");
  globeCanvas = document.getElementById("globeCanvas");
  // crisp rendering on HiDPI while keeping original internal coordinates
  setupHiDPI(plotCanvas, CANVAS_W, CANVAS_H);
  setupHiDPI(globeCanvas, 260, 260);
  plotCtx = plotCanvas.getContext("2d");
  globeCtx = globeCanvas.getContext("2d");

  els = {
    plotOverlays: document.getElementById("plotOverlays"),
    plotTitle: document.getElementById("plot-heading"),
    latInput: document.getElementById("latInput"),
    latSlider: document.getElementById("latSlider"),
    doySlider: document.getElementById("doySlider"),
    doyLabel: document.getElementById("doyLabel"),
    monthSelect: document.getElementById("monthSelect"),
    daySelect: document.getElementById("daySelect"),
    showAverage: document.getElementById("showAverage"),
    showCursor: document.getElementById("showCursor"),
    globeCaption: document.getElementById("globeCaption"),
    liveRegion: document.getElementById("liveRegion")
  };

  sphere = new CelestialSphere(170);
  globe = new Globe(sphere);
  equator  = new CSCircle(sphere, {thickness:1, color:3182640,  alpha:70});
  dayArc   = new CSCircle(sphere, {thickness:2, color:16448128, alpha:100});
  nightArc = new CSCircle(sphere, {thickness:1, color:10000536, alpha:100});
  equator.setParameters({ra:0, dec:0, tilt:0});

  buildPlotLabels();
  wireControls();
  doReset();
  window.addEventListener("resize", () => { /* percentages handle layout; redraw for HiDPI */ });
}

// Backing-store scaling for sharpness; drawing code keeps original coords.
function setupHiDPI(canvas, w, h) {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* redefine the foundation equation initialiser (no equations in this sim) */
window.klunlInitEqn = function () { /* Daylight Hours Explorer has no LaTeX equations */ };

/* =====================================================================
   SHORE DATA  --  continent outlines, copied verbatim from
   "Globe Component v2.as" p._shoreData (unit vectors on the globe).
   ===================================================================== */
const SHORE_DATA = [[{x:-0.3346,y:0.0459,z:0.9413},{x:-0.3416,y:0.0996,z:0.9346},{x:-0.2114,y:0.2266,z:0.9508},{x:-0.096,y:0.2606,z:0.9607},{x:-0.0754,y:0.2221,z:0.9721},{x:0.1858,y:0.3188,z:0.9294},{x:0.2601,y:0.2689,z:0.9274},{x:0.3333,y:0.1093,z:0.9365},{x:0.5148,y:0.0304,z:0.8568},{x:0.5205,y:0.0699,z:0.851},{x:0.4949,y:0.0935,z:0.8639},{x:0.5415,y:0.1316,z:0.8304},{x:0.4746,y:0.1559,z:0.8663},{x:0.4533,y:0.1428,z:0.8798},{x:0.3811,y:0.182,z:0.9064},{x:0.5518,y:0.1955,z:0.8107},{x:0.5657,y:0.1123,z:0.8169},{x:0.5325,y:0.0913,z:0.8415},{x:0.5788,y:0.0726,z:0.8123},{x:0.6521,y:0.0005,z:0.7582},{x:0.6599,y:-0.0552,z:0.7494},{x:0.6902,y:-0.0128,z:0.7235},{x:0.7263,y:-0.0199,z:0.6871},{x:0.7223,y:-0.1168,z:0.6817},{x:0.7875,y:-0.1261,z:0.6033},{x:0.8049,y:-0.079,z:0.5882},{x:0.7916,y:-0.0099,z:0.611},{x:0.7267,y:0.0424,z:0.6856},{x:0.7059,y:0.1082,z:0.7},{x:0.7406,y:0.2044,z:0.6401},{x:0.761,y:0.2109,z:0.6135},{x:0.7249,y:0.2418,z:0.645},{x:0.7003,y:0.1548,z:0.6969},{x:0.6782,y:0.1634,z:0.7165},{x:0.701,y:0.2505,z:0.6677},{x:0.7398,y:0.316,z:0.5939},{x:0.7024,y:0.2932,z:0.6486},{x:0.6614,y:0.3481,z:0.6644},{x:0.5977,y:0.3465,z:0.723},{x:0.5499,y:0.4863,z:0.679},{x:0.6837,y:0.3491,z:0.6408},{x:0.7121,y:0.3693,z:0.5971},{x:0.6462,y:0.4721,z:0.5996},{x:0.7063,y:0.479,z:0.5213},{x:0.7515,y:0.4162,z:0.5118},{x:0.7804,y:0.3107,z:0.5427},{x:0.816,y:0.2808,z:0.5053},{x:0.8186,y:0.1474,z:0.5552},{x:0.7832,y:0.1514,z:0.6031},{x:0.8072,y:-0.0792,z:0.5849},{x:0.8913,y:-0.2764,z:0.3594},{x:0.9222,y:-0.2913,z:0.2545},{x:0.968,y:-0.2156,z:0.1285},{x:0.996,y:-0.0345,z:0.0829},{x:0.991,y:0.0669,z:0.116},{x:0.9841,y:0.1734,z:0.0387},{x:0.9529,y:0.2358,z:-0.191},{x:0.9216,y:0.199,z:-0.3334},{x:0.7843,y:0.2596,z:-0.5635},{x:0.7424,y:0.3784,z:-0.5528},{x:0.7432,y:0.53,z:-0.4084},{x:0.7742,y:0.5361,z:-0.3363},{x:0.7322,y:0.6312,z:-0.2559},{x:0.7731,y:0.629,z:-0.0816},{x:0.6711,y:0.7371,z:0.0794},{x:0.6185,y:0.7582,z:0.2064},{x:0.7094,y:0.6835,z:0.172},{x:0.7425,y:0.6167,z:0.2616},{x:0.7323,y:0.4634,z:0.499},{x:0.7047,y:0.6485,z:0.288},{x:0.709,y:0.6702,z:0.2195},{x:0.547,y:0.7839,z:0.2936},{x:0.4669,y:0.7999,z:0.3771},{x:0.5075,y:0.7499,z:0.4244},{x:0.5708,y:0.7106,z:0.4113},{x:0.5873,y:0.6439,z:0.4903},{x:0.5637,y:0.6524,z:0.5065},{x:0.4562,y:0.7854,z:0.4183},{x:0.285,y:0.8918,z:0.3513},{x:0.2137,y:0.9667,z:0.1405},{x:0.1742,y:0.9683,z:0.179},{x:0.1617,y:0.9492,z:0.2701},{x:-0.0245,y:0.9218,z:0.3868},{x:-0.0724,y:0.9584,z:0.276},{x:-0.1291,y:0.9498,z:0.2851},{x:-0.1512,y:0.9825,z:0.1087},{x:-0.2453,y:0.9692,z:0.024},{x:-0.2253,y:0.9697,z:0.0943},{x:-0.162,y:0.9742,z:0.1569},{x:-0.1693,y:0.9583,z:0.2302},{x:-0.2604,y:0.9534,z:0.1521},{x:-0.324,y:0.9204,z:0.2189},{x:-0.2558,y:0.9105,z:0.3249},{x:-0.4007,y:0.8273,z:0.3937},{x:-0.461,y:0.7336,z:0.4994},{x:-0.4007,y:0.7145,z:0.5736},{x:-0.428,y:0.6691,z:0.6076},{x:-0.385,y:0.6794,z:0.6247},{x:-0.4476,y:0.6263,z:0.6383},{x:-0.4855,y:0.663,z:0.5698},{x:-0.5161,y:0.6355,z:0.5743},{x:-0.4692,y:0.6094,z:0.6391},{x:-0.5192,y:0.5174,z:0.6803},{x:-0.5026,y:0.4055,z:0.7635},{x:-0.4193,y:0.3708,z:0.8287},{x:-0.4622,y:0.1663,z:0.871},{x:-0.5025,y:0.2226,z:0.8355},{x:-0.5765,y:0.2476,z:0.7787},{x:-0.5338,y:0.1583,z:0.8306},{x:-0.4863,y:0.1283,z:0.8643},{x:-0.4672,y:0.0074,z:0.8841},{x:-0.418,y:0.0021,z:0.9084},{x:-0.4004,y:-0.072,z:0.9135}],[{x:0.206,y:-0.5678,z:-0.797},{x:0.3392,y:-0.6758,z:-0.6544},{x:0.5784,y:-0.6598,z:-0.4797},{x:0.5974,y:-0.6792,z:-0.4264},{x:0.6996,y:-0.6096,z:-0.3727},{x:0.7597,y:-0.612,z:-0.22},{x:0.8105,y:-0.5663,z:-0.1498},{x:0.8141,y:-0.5728,z:-0.0954},{x:0.6662,y:-0.7455,z:0.0175},{x:0.6302,y:-0.767,z:0.1205},{x:0.3556,y:-0.9081,z:0.2212},{x:0.2267,y:-0.9645,z:0.1355},{x:0.1876,y:-0.9681,z:0.1662},{x:0.1322,y:-0.9786,z:0.1575},{x:0.1114,y:-0.9592,z:0.2597},{x:0.0201,y:-0.9619,z:0.2728},{x:0.0499,y:-0.9301,z:0.3639},{x:-0.0045,y:-0.9324,z:0.3614},{x:-0.0268,y:-0.9479,z:0.3173},{x:-0.1023,y:-0.9327,z:0.3458},{x:-0.125,y:-0.8816,z:0.4551},{x:-0.0824,y:-0.8601,z:0.5034},{x:0.0953,y:-0.8597,z:0.5018},{x:0.1497,y:-0.8938,z:0.4228},{x:0.1263,y:-0.8453,z:0.5192},{x:0.1937,y:-0.7964,z:0.5729},{x:0.2105,y:-0.7227,z:0.6583},{x:0.2559,y:-0.7013,z:0.6653},{x:0.2381,y:-0.6877,z:0.6859},{x:0.2978,y:-0.6315,z:0.7159},{x:0.3001,y:-0.6601,z:0.6886},{x:0.3373,y:-0.6187,z:0.7096},{x:0.2658,y:-0.6144,z:0.7428},{x:0.2193,y:-0.6474,z:0.7299},{x:0.2561,y:-0.5848,z:0.7697},{x:0.3205,y:-0.5532,z:0.7689},{x:0.3322,y:-0.4862,z:0.8082},{x:0.284,y:-0.4991,z:0.8187},{x:0.2136,y:-0.4479,z:0.8682},{x:0.195,y:-0.4938,z:0.8474},{x:0.1718,y:-0.4534,z:0.8746},{x:0.0976,y:-0.4563,z:0.8845},{x:0.1089,y:-0.6066,z:0.7875},{x:0.0729,y:-0.5727,z:0.8165},{x:-0.0263,y:-0.5471,z:0.8366},{x:-0.0364,y:-0.4856,z:0.8734},{x:0.0594,y:-0.3827,z:0.922},{x:0.052,y:-0.3518,z:0.9346},{x:0.0091,y:-0.376,z:0.9266},{x:-0.0262,y:-0.3095,z:0.9505},{x:-0.0904,y:-0.365,z:0.9266},{x:-0.2194,y:-0.2788,z:0.9349},{x:-0.2931,y:-0.1264,z:0.9477},{x:-0.3515,y:-0.0852,z:0.9323},{x:-0.3753,y:-0.1338,z:0.9172},{x:-0.407,y:-0.0856,z:0.9094},{x:-0.406,y:-0.1419,z:0.9028},{x:-0.4614,y:-0.1161,z:0.8795},{x:-0.4954,y:-0.1572,z:0.8543},{x:-0.4735,y:-0.2013,z:0.8575},{x:-0.5529,y:-0.168,z:0.8162},{x:-0.4737,y:-0.2264,z:0.8511},{x:-0.4053,y:-0.2586,z:0.8768},{x:-0.3598,y:-0.3663,z:0.8581},{x:-0.3688,y:-0.5542,z:0.7462},{x:-0.433,y:-0.6465,z:0.6282},{x:-0.3806,y:-0.7794,z:0.4977},{x:-0.3212,y:-0.8604,z:0.3956},{x:-0.3576,y:-0.7715,z:0.5262},{x:-0.2197,y:-0.924,z:0.313},{x:0.0463,y:-0.9711,z:0.2343},{x:0.1108,y:-0.9829,z:0.1468},{x:0.1636,y:-0.9786,z:0.125},{x:0.1918,y:-0.9704,z:0.147},{x:0.2199,y:-0.9734,z:0.0637},{x:0.1579,y:-0.9849,z:-0.0705},{x:0.2319,y:-0.939,z:-0.254},{x:0.3228,y:-0.8834,z:-0.3398},{x:0.2626,y:-0.7902,z:-0.5538},{x:0.2245,y:-0.7628,z:-0.6064},{x:0.1743,y:-0.5802,z:-0.7956}],[{x:0.2884,y:-0.169,z:0.9425},{x:0.258,y:-0.135,z:0.9567},{x:0.2665,y:-0.0991,z:0.9587},{x:0.1582,y:-0.0467,z:0.9863},{x:0.0767,y:-0.1085,z:0.9911},{x:0.0709,y:-0.1896,z:0.9793},{x:0.2796,y:-0.3484,z:0.8947},{x:0.3541,y:-0.3522,z:0.8663}],[{x:-0.6199,y:0.4769,z:-0.6232},{x:-0.7027,y:0.3948,z:-0.5919},{x:-0.8027,y:0.4056,z:-0.4373},{x:-0.7799,y:0.5977,z:-0.1855},{x:-0.7366,y:0.6049,z:-0.3026},{x:-0.6881,y:0.6783,z:-0.2577},{x:-0.7106,y:0.6728,z:-0.2059},{x:-0.6562,y:0.7295,z:-0.193},{x:-0.6152,y:0.7435,z:-0.2623},{x:-0.5707,y:0.7852,z:-0.2406},{x:-0.487,y:0.8068,z:-0.3345},{x:-0.3773,y:0.8479,z:-0.3725},{x:-0.3439,y:0.7982,z:-0.4946},{x:-0.4027,y:0.7092,z:-0.5787},{x:-0.5375,y:0.6569,z:-0.5288},{x:-0.616,y:0.5528,z:-0.5612}],[{x:0.195,y:-0.4301,z:0.8815},{x:0.1489,y:-0.3678,z:0.9179},{x:0.1884,y:-0.3839,z:0.9039},{x:0.1903,y:-0.3474,z:0.9182},{x:0.0234,y:-0.286,z:0.9579},{x:0.0282,y:-0.3259,z:0.945},{x:0.1146,y:-0.3675,z:0.9229},{x:0.1043,y:-0.411,z:0.9056}],[{x:0.3616,y:0.0008,z:-0.9323},{x:0.2757,y:-0.095,z:-0.9565},{x:0.1623,y:-0.1217,z:-0.9792},{x:0.1207,y:-0.2253,z:-0.9668},{x:0.2426,y:-0.377,z:-0.8939},{x:0.0849,y:-0.3383,z:-0.9372},{x:0.0888,y:-0.2744,z:-0.9575},{x:-0.0569,y:-0.3062,z:-0.9503},{x:-0.1779,y:-0.2219,z:-0.9587},{x:-0.2086,y:0.0366,z:-0.9773},{x:-0.3158,y:0.0556,z:-0.9472},{x:-0.2925,y:0.2905,z:-0.9111},{x:-0.0938,y:0.4102,z:-0.9072},{x:0.056,y:0.4063,z:-0.912},{x:0.0955,y:0.3336,z:-0.9379},{x:0.2419,y:0.3294,z:-0.9127},{x:0.3116,y:0.1986,z:-0.9292},{x:0.3043,y:0.1373,z:-0.9426}],[{x:-0.8538,y:0.5009,z:-0.1421},{x:-0.7416,y:0.6703,z:-0.0256},{x:-0.709,y:0.7032,z:-0.0528},{x:-0.6683,y:0.7438,z:-0.0045},{x:-0.6686,y:0.741,z:-0.0628},{x:-0.74,y:0.6658,z:-0.0956},{x:-0.7476,y:0.6484,z:-0.1438},{x:-0.7854,y:0.5973,z:-0.1622},{x:-0.8088,y:0.5738,z:-0.129}],[{x:0.412,y:-0.5346,z:0.7379},{x:0.3479,y:-0.5141,z:0.784},{x:0.3439,y:-0.5681,z:0.7477},{x:0.3846,y:-0.5658,z:0.7293}],[{x:-0.476,y:0.8794,z:0.0094},{x:-0.4487,y:0.8918,z:0.0578},{x:-0.4865,y:0.8683,z:0.0968},{x:-0.4544,y:0.8824,z:0.1219},{x:-0.3257,y:0.9452,z:0.0238},{x:-0.3543,y:0.9338,z:-0.0508},{x:-0.4199,y:0.9043,z:-0.0771}],[{x:0.6229,y:-0.0015,z:0.7823},{x:0.5351,y:-0.0161,z:0.8447},{x:0.5191,y:-0.045,z:0.8535},{x:0.5664,y:-0.054,z:0.8224},{x:0.6044,y:-0.0332,z:0.796},{x:0.6377,y:-0.0634,z:0.7677}],[{x:-0.6002,y:0.5602,z:0.5709},{x:-0.63,y:0.5126,z:0.5834},{x:-0.5865,y:0.4671,z:0.6617},{x:-0.5851,y:0.5637,z:0.583},{x:-0.5406,y:0.6248,z:0.5634},{x:-0.5876,y:0.603,z:0.5395}],[{x:0.617,y:0.664,z:-0.4225},{x:0.6136,y:0.7434,z:-0.2664},{x:0.6383,y:0.7414,z:-0.2071},{x:0.6869,y:0.6617,z:-0.3006},{x:0.6624,y:0.6263,z:-0.4111}],[{x:-0.5157,y:0.8519,z:-0.0911},{x:-0.5141,y:0.857,z:-0.0346},{x:-0.5742,y:0.8181,z:0.0314},{x:-0.5062,y:0.8623,z:0.0162},{x:-0.4805,y:0.8757,z:-0.0484}],[{x:0.4193,y:-0.1148,z:0.9006},{x:0.3867,y:-0.0987,z:0.9169},{x:0.3781,y:-0.1507,z:0.9134},{x:0.4088,y:-0.1714,z:0.8964}],[{x:0.6119,y:-0.0864,z:0.7862},{x:0.5713,y:-0.0666,z:0.818},{x:0.5764,y:-0.1031,z:0.8107},{x:0.605,y:-0.1146,z:0.7879}],[{x:-0.7522,y:0.0451,z:-0.6574},{x:-0.8171,y:0.0431,z:-0.5749},{x:-0.8274,y:0.0859,z:-0.555},{x:-0.7623,y:0.0812,z:-0.6421}],[{x:-0.2696,y:0.958,z:-0.0974},{x:-0.2767,y:0.9593,z:-0.0563},{x:-0.2353,y:0.9719,z:0.0031},{x:-0.0907,y:0.9911,z:0.0973}],[{x:0.2428,y:-0.9068,z:0.3446},{x:0.1414,y:-0.9078,z:0.3949},{x:0.0949,y:-0.9173,z:0.3867},{x:0.1925,y:-0.9144,z:0.3562},{x:0.2009,y:-0.9193,z:0.3384}],[{x:0.0223,y:-0.7332,z:0.6796},{x:0.0589,y:-0.6836,z:0.7275},{x:-0.0229,y:-0.6822,z:0.7308},{x:0.0178,y:-0.6568,z:0.7539},{x:0.1038,y:-0.6978,z:0.7087},{x:0.0942,y:-0.7242,z:0.6831},{x:0.0629,y:-0.698,z:0.7134},{x:0.0448,y:-0.7453,z:0.6652}],[{x:0.4824,y:0.5331,z:0.6951},{x:0.4116,y:0.5444,z:0.7309},{x:0.4499,y:0.5682,z:0.689},{x:0.4702,y:0.6478,z:0.5994},{x:0.521,y:0.5986,z:0.6085}],[{x:0.3431,y:-0.8806,z:0.3269},{x:0.2745,y:-0.8987,z:0.3421},{x:0.2662,y:-0.9088,z:0.3212},{x:0.3042,y:-0.8984,z:0.3167}],[{x:-0.5955,y:0.4446,z:0.6691},{x:-0.6012,y:0.4083,z:0.6869},{x:-0.5515,y:0.4322,z:0.7135},{x:-0.5679,y:0.4685,z:0.6767},{x:-0.5955,y:0.4446,z:0.6691},{x:-0.5955,y:0.4446,z:0.6691}]];


if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
