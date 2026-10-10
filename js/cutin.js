// cutin.js: the close-up that cuts across the screen when a sword style is taken: a dark band showing the
// character's eyes, which snap open blazing in the style's colour. It is meant to look like power arriving:
// narrowed, slanted eyes under heavy brows, slit pupils, a glow behind them, a streak of light across both and
// cracks of energy spreading outwards. It is drawn with HTML and SVG on top of the game, and the game itself
// stands still while it plays (main.js checks cutinActive()). How it looks and moves is the #cutin CSS in index.html.

const CUTIN_TIME = 1.5;       // seconds the band stays on screen
const EYES_OPEN_AT = 0.38;    // seconds in, when the eyes snap open (until then they are closed slits in the dark)

// The outline of one eye, drawn around the point (0, 0): the outer corner (left) is raised and the inner corner
// (right, towards the nose) is pulled down to a point. That slant is what makes it a glare.
const SHAPE = 'M -185 -28 Q -40 -80 120 -18 L 174 24 Q 20 58 -120 22 Z';
// Thin lines fanning out inside the iris, like the spokes of a wheel.
let spokes = '';
for (let i = 0; i < 16; i++) {
  const a = i / 16 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  spokes += `<line x1="${(c * 22 - 8).toFixed(1)}" y1="${(s * 22 - 8).toFixed(1)}" x2="${(c * 56 - 8).toFixed(1)}" y2="${(s * 56 - 8).toFixed(1)}"/>`;
}
// One eye. The second eye is this one mirrored.
const EYE = `
  <g class="eye">
    <ellipse class="aura" cx="-10" cy="-6" rx="290" ry="135"/>
    <path class="crack" d="M -180 -30 L -235 -62 L -262 -50 L -318 -96 L -350 -88"/>
    <path class="crack" d="M -150 8 L -214 26 L -240 12 L -300 44"/>
    <path class="crack" d="M -60 -66 L -84 -112 L -70 -130 L -96 -168"/>
    <path class="crack" d="M 60 44 L 78 86 L 62 104 L 84 140"/>
    <g class="ball">
      <path class="white" d="${SHAPE}"/>
      <g clip-path="url(#eyeClip)">
        <circle class="iris" cx="-8" cy="-8" r="60"/>
        <g class="spokes">${spokes}</g>
        <circle class="ring" cx="-8" cy="-8" r="60"/>
        <ellipse class="pupil" cx="-8" cy="-8" rx="9" ry="38"/>
        <circle class="shine" cx="-30" cy="-30" r="8"/>
      </g>
    </g>
    <path class="lid" d="M -204 -42 Q -40 -100 126 -32 L 180 24 L 122 -12 Q -40 -68 -186 -22 Z"/>
    <path class="lower" d="M -122 24 Q 20 62 176 26"/>
    <path class="brow" d="M -226 -122 L 150 -64 L 198 -20 L 138 -40 L -214 -86 Z"/>
    <ellipse class="streak" cx="-8" cy="-8" rx="340" ry="5"/>
  </g>`;

const el = document.createElement('div');
el.id = 'cutin';
el.innerHTML = `
  <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice">
    <defs>
      <clipPath id="eyeClip"><path d="${SHAPE}"/></clipPath>
      <radialGradient id="irisGlow">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.3" style="stop-color:var(--style)"/>
        <stop offset="0.82" style="stop-color:var(--style)"/>
        <stop offset="1" stop-color="#05060c"/>
      </radialGradient>
      <radialGradient id="auraGlow">
        <stop offset="0" style="stop-color:var(--style)" stop-opacity="0.85"/>
        <stop offset="1" style="stop-color:var(--style)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g transform="translate(280 168)">${EYE}</g>
    <g transform="translate(720 168) scale(-1 1)">${EYE}</g>
  </svg>
  <div class="flare"></div>`;
document.body.appendChild(el);

let until = 0, timer = 0;
// True while the close-up is on screen. The game does not advance during it.
export function cutinActive() { return performance.now() < until; }
// Play the close-up. color = the style's colour as a number, for example 0x2f8fff.
export function playCutin(color) {
  const css = '#' + color.toString(16).padStart(6, '0');
  el.style.setProperty('--style', css);
  el.classList.remove('lit');
  el.classList.add('on');
  until = performance.now() + CUTIN_TIME * 1000;
  clearTimeout(timer);
  // the band opens on closed eyes in the dark; then they snap open ('lit'); then the band closes
  timer = setTimeout(() => {
    el.classList.add('lit');
    timer = setTimeout(() => el.classList.remove('on', 'lit'), (CUTIN_TIME - EYES_OPEN_AT) * 1000);
  }, EYES_OPEN_AT * 1000);
}
