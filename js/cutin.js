// cutin.js: the close-up that cuts across the screen when a sword style is taken: a band showing the character's
// eyes, which change to the style's colour. It is drawn with HTML and SVG on top of the game, and the game itself
// stands still while it plays (main.js checks cutinActive()).

const CUTIN_TIME = 1.05;      // seconds the band stays on screen
const EYES_CHANGE_AT = 0.28;  // seconds in, when the eyes switch colour

// One eye, drawn around the point (0, 0). The second eye is this one mirrored.
const EYE = `
  <g class="eye">
    <path class="white" d="M -175 0 Q 0 -100 175 0 Q 0 72 -175 0 Z"/>
    <g clip-path="url(#eyeClip)">
      <circle class="iris" cx="0" cy="-6" r="62"/>
      <circle class="pupil" cx="0" cy="-6" r="22"/>
      <circle class="shine" cx="-22" cy="-30" r="13"/>
    </g>
    <path class="lid" d="M -180 2 Q 0 -108 180 2"/>
    <path class="brow" d="M -200 -128 L 175 -78"/>
  </g>`;

const el = document.createElement('div');
el.id = 'cutin';
el.innerHTML = `
  <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice">
    <defs><clipPath id="eyeClip"><path d="M -175 0 Q 0 -100 175 0 Q 0 72 -175 0 Z"/></clipPath></defs>
    <g transform="translate(285 160)">${EYE}</g>
    <g transform="translate(715 160) scale(-1 1)">${EYE}</g>
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
  // first the eyes change colour, then the band closes again
  timer = setTimeout(() => {
    el.classList.add('lit');
    timer = setTimeout(() => el.classList.remove('on', 'lit'), (CUTIN_TIME - EYES_CHANGE_AT) * 1000);
  }, EYES_CHANGE_AT * 1000);
}
