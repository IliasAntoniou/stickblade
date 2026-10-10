// skins.js: what each kind of enemy looks like. Every dummy is the same stick figure underneath; this adds the
// shapes that say what it does, on top of its colour:
//   basic   = a practice dummy: a painted target on the chest and a bucket on its head.
//   shield  = a guard: a steel helm with a crest and heavy shoulder plates, thicker limbs.
//   flying  = a winged thing: two wings that flap, and a slighter body.
//   fighter = a brute: horns, spiked shoulders, thick arms, glowing eyes, and bigger than the rest.
// dressDummy() is called once when a dummy is made (dummies.js). The shapes and materials here are made once and
// shared by every dummy, so a new dummy costs nothing extra to build.
// To keep the number of draw calls down, shapes that always go together (both horns, both shoulder plates, both
// eyes) are joined into a single shape.

import * as THREE from 'three';

// Join several shapes into one. Each entry is [shape, x, y, z, turnX, turnY, turnZ, scale]. Also used by mounts.js.
export function joined(parts) {
  const pos = [], nor = [];
  const place = new THREE.Object3D();
  for (const [shape, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, scale = 1] of parts) {
    place.position.set(x, y, z);
    place.rotation.set(rx, ry, rz);
    place.scale.setScalar(scale);
    place.updateMatrix();
    const g = shape.clone().applyMatrix4(place.matrix).toNonIndexed();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

// ---------- practice dummy ----------
// The target: red and white rings, painted once.
const targetTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  for (const [r, color] of [[32, '#f4efe6'], [25, '#c8321e'], [17, '#f4efe6'], [9, '#c8321e']]) {
    x.fillStyle = color;
    x.beginPath(); x.arc(32, 32, r, 0, Math.PI * 2); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
const targetGeo = new THREE.CircleGeometry(0.17, 20);
const targetMat = new THREE.MeshLambertMaterial({ map: targetTex });
const bucketGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.2, 12);
const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });

// ---------- guard ----------
const steelMat = new THREE.MeshLambertMaterial({ color: 0x9aa4b4 });
const helmGeo = joined([
  [new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10)],                         // the helm
  [new THREE.BoxGeometry(0.045, 0.13, 0.34), 0, 0.2, 0],                   // a crest along the top
  [new THREE.BoxGeometry(0.3, 0.035, 0.03), 0, 0.02, 0.195],               // the bar across the eye slit
]);
const plateGeo = joined([
  [new THREE.SphereGeometry(0.13, 8, 6), 0.2, 0, 0],
  [new THREE.SphereGeometry(0.13, 8, 6), -0.2, 0, 0],
]);

// ---------- winged ----------
// One wing, lying flat and pointing out to the side: a fan of triangles from the shoulder, with a scalloped edge.
const wingGeo = (() => {
  const edge = [[0.78, 0.3], [0.62, -0.06], [0.44, 0.02], [0.34, -0.28], [0.2, -0.14], [0.08, -0.3]];
  const pos = [], nor = [];
  for (let i = 0; i < edge.length - 1; i++) {
    pos.push(0, 0, 0, edge[i][0], edge[i][1], 0, edge[i + 1][0], edge[i + 1][1], 0);
    nor.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
})();
const wingMat = new THREE.MeshLambertMaterial({ color: 0xbfeaff, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });

// ---------- brute ----------
const hornMat = new THREE.MeshLambertMaterial({ color: 0xe9ddc2 });
const hornGeo = joined([
  [new THREE.ConeGeometry(0.05, 0.3, 6), 0.13, 0.2, 0, 0, 0, -0.55],
  [new THREE.ConeGeometry(0.05, 0.3, 6), -0.13, 0.2, 0, 0, 0, 0.55],
]);
const darkMat = new THREE.MeshLambertMaterial({ color: 0x2b2136 });
const spikedGeo = joined([
  [new THREE.SphereGeometry(0.14, 8, 6), 0.21, 0, 0],
  [new THREE.SphereGeometry(0.14, 8, 6), -0.21, 0, 0],
  [new THREE.ConeGeometry(0.05, 0.24, 6), 0.3, 0.14, 0, 0, 0, -0.7],
  [new THREE.ConeGeometry(0.05, 0.24, 6), -0.3, 0.14, 0, 0, 0, 0.7],
]);
const glareMat = new THREE.MeshBasicMaterial({ color: 0xff3030, toneMapped: false });
const glareGeo = joined([
  [new THREE.SphereGeometry(0.034, 8, 6), 0.062, 0.02, 0.156],
  [new THREE.SphereGeometry(0.034, 8, 6), -0.062, 0.02, 0.156],
]);

// Make the rod-thin limbs of a stick figure thicker. arms and legs = how many times thicker.
function bulk(sm, arms, legs) {
  const widen = (group, width) => {
    for (const part of group.children) {
      if (part.isMesh) { part.scale.x = width; part.scale.z = width; }
    }
  };
  for (const g of [sm.shL, sm.shR, sm.elL, sm.elR]) widen(g, arms);
  for (const g of [sm.hipL, sm.hipR, sm.kneeL, sm.kneeR]) widen(g, legs);
  widen(sm.spine, legs);
}
// Put a shape on a part of the body.
function attach(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Give a dummy the look of its type. d = the Dummy (its stick figure is d.sm, its own body material d.mat).
export function dressDummy(d) {
  const sm = d.sm;
  if (d.type === 'basic') {
    attach(sm.chest, targetGeo, targetMat, 0, -0.17, 0.062);
    attach(sm.head, bucketGeo, woodMat, 0, 0.1, 0);
  } else if (d.type === 'shield') {
    bulk(sm, 1.9, 2.1);
    attach(sm.head, helmGeo, steelMat, 0, 0.02, 0);
    attach(sm.chest, plateGeo, steelMat, 0, 0, 0);
    sm.root.scale.setScalar(1.06);
  } else if (d.type === 'flying') {
    bulk(sm, 0.75, 0.75);
    // d.wings is read by Dummy.update, which flaps them
    const left = attach(sm.chest, wingGeo, wingMat, 0.04, -0.06, -0.07);
    const right = attach(sm.chest, wingGeo, wingMat, -0.04, -0.06, -0.07);
    right.scale.x = -1;
    d.wings = [left, right];
    sm.root.scale.setScalar(0.92);
  } else if (d.type === 'fighter') {
    bulk(sm, 2.6, 2.2);
    attach(sm.head, hornGeo, hornMat);
    attach(sm.head, glareGeo, glareMat);
    attach(sm.chest, spikedGeo, darkMat);
    sm.root.scale.setScalar(1.16);
  }
}
