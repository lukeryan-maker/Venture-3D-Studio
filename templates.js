import { jersey } from "./jersey.js";

// Dimensions below are authored in centimeters. All primitives have a unit bounding box.
const unit = 1;
const clay = '#bf6047';
const coal = '#293536';
const brass = '#c89e62';
const linen = '#f1e5ce';
const teal = '#397b76';
const steel = { roughness: .32, metalness: .75 };
const rubber = { roughness: .88 };

function part(name, shape, color, position, scale, rotation = [0, 0, 0], finish = {}) {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name, shape, color, position: position.map(v => v * unit),
    rotation: rotation.length ? rotation : [0, 0, 0], scale: scale.map(v => v * unit),
    roughness: .58, metalness: .04, opacity: 1, ...finish
  };
}

function project(name, type, description, parts) {
  return { name, type, description, parts, background: '#e4ded3',
    lighting: 'studio', grid: true, axes: false, references: [] };
}

const bottle = project('Canyon flask', 'Bottle',
  'A powder-coated insulated flask with a protective base, steel collar and carry loop.', [
    part('Bottle body', 'cylinder', clay, [0, 9.7, 0], [7.5, 17.4, 7.5]),
    part('Base boot', 'cylinder', '#924936', [0, .8, 0], [7.6, 1.6, 7.6], [], rubber),
    part('Rounded shoulder', 'sphere', clay, [0, 18.25, 0], [7.48, 4.3, 7.48]),
    part('Neck collar', 'cylinder', '#b6aaa0', [0, 20, 0], [4.9, 1.4, 4.9], [], steel),
    part('Lid', 'cylinder', coal, [0, 21.15, 0], [5.3, 1.8, 5.3], [], rubber),
    part('Lid gasket', 'cylinder', '#151d1e', [0, 20.47, 0], [5.35, .23, 5.35]),
    part('Carry loop', 'torus', coal, [0, 23, 0], [4.65, 4.4, 1.0], [], rubber),
    part('Maker medallion', 'cylinder', brass, [0, 8, 3.74], [1.25, .12, 1.25], [90, 0, 0], steel),
    part('Medallion inlay', 'box', coal, [0, 8, 3.82], [.17, .63, .06], [0, 0, -26])
  ]);

const carton = project('Citrus Press', 'Box', 'A consumer carton with a kraft sleeve, citrus seal and folded end flaps.', [
  part('Carton', 'box', '#efba52', [0, 7, 0], [9, 14, 5]),
  part('Wraparound sleeve', 'box', '#e87734', [0, 6.2, 0], [9.07, 7.3, 5.08]),
  part('Front label', 'box', linen, [0, 6.65, 2.56], [6.7, 4.8, .08]),
  part('Citrus seal', 'cylinder', '#dc793a', [0, 6.8, 2.64], [2.8, .11, 2.8], [90, 0, 0]),
  part('Seal leaf', 'sphere', teal, [.68, 8.12, 2.72], [1.1, .46, .15], [0, 0, 32]),
  part('Top fold', 'box', linen, [0, 14.04, 0], [8.96, .1, 4.97]),
  part('Closure tab', 'box', '#b88144', [0, 14.13, .1], [1.65, .08, 4.8])
]);

const tote = project('Market tote', 'Bag', 'A canvas carryall with twin handles, contrast binding and an exterior pocket.', [
  part('Canvas shell', 'box', '#52847b', [0, 14, 0], [32, 28, 12], [], rubber),
  part('Contrast base', 'box', coal, [0, 2.1, 0], [32.2, 4.2, 12.2], [], rubber),
  part('Top binding', 'box', '#315b54', [0, 27.2, 0], [32.1, 1.7, 12.15]),
  part('Front handle', 'torus', '#b6814c', [0, 30.8, 5.7], [14, 16, 1.4]),
  part('Rear handle', 'torus', '#b6814c', [0, 30.8, -5.7], [14, 16, 1.4]),
  part('Outer pocket', 'box', '#8fae99', [0, 13.4, 6.2], [16, 12, .5], [], rubber),
  part('Pocket binding', 'box', linen, [0, 19.35, 6.5], [16.2, .7, .35]),
  part('Woven tag', 'box', '#e4be7f', [4.6, 15.95, 6.55], [3.15, 1.7, .15])
]);

const mascot = project('Pip the owl', 'Mascot', 'A pocket-sized owl mascot with a teal body, cream facial disks and a small gold beak.', [
  part('Body', 'sphere', teal, [0, 5.35, 0], [7.8, 9.4, 6.7]),
  part('Head', 'sphere', teal, [0, 10.45, 0], [8.8, 6.75, 6.85]),
  ...[-1, 1].flatMap(sign => {
    const side = sign < 0 ? 'Left' : 'Right';
    return [
      part(side + ' ear', 'cone', teal, [sign * 3.1, 12.75, -.15], [2.5, 3, 2.2], [0, 0, sign * -16]),
      part(side + ' face disk', 'sphere', linen, [sign * 1.58, 10.55, 2.78], [3.3, 3.15, 1.5]),
      part(side + ' eye', 'sphere', coal, [sign * 1.58, 10.75, 3.48], [1.12, 1.28, .58]),
      part(side + ' eye glint', 'sphere', '#ffffff', [sign * 1.58 - .15, 10.97, 3.74], [.31, .31, .1]),
      part(side + ' wing', 'sphere', '#2b615e', [sign * 3.5, 5.95, .12], [2.3, 5.3, 3.8], [0, 0, sign * 13]),
      part(side + ' foot', 'sphere', brass, [sign * 1.78, .67, .85], [2.6, 1.34, 3])
    ];
  }),
  part('Beak', 'cone', '#d89e45', [0, 9.62, 3.43], [1.15, 1.75, 1.1], [0, 0, 180]),
  part('Belly patch', 'sphere', '#a3c0aa', [0, 5.05, 2.74], [4.7, 4.7, 1.4])
]);

const merch = project('Club mug', 'Merchandise', 'An enamel camp mug with an ocean-blue body, rolled rim and a cream crest.', [
  part('Cup body', 'cylinder', '#416775', [0, 4.3, 0], [8.5, 8.6, 8.5]),
  part('Rolled rim', 'torus', '#c6bfb1', [0, 8.58, 0], [8.9, 8.9, .52], [90, 0, 0], steel),
  part('Inside surface', 'cylinder', '#1e333a', [0, 8.61, 0], [7.65, .11, 7.65]),
  part('Enamel handle', 'torus', '#416775', [4.6, 4.45, 0], [5.1, 6.3, .95]),
  part('Cream crest', 'cylinder', linen, [0, 4.55, 4.2], [3.1, .18, 3.1], [90, 0, 0]),
  part('Mountain mark', 'cone', '#416775', [0, 4.62, 4.34], [1.72, 1.62, .23])
]);

const room = project('Welcome kiosk', 'Service environment', 'A scale model of a service counter with a wall sign, worktop and potted plant.', [
  part('Floor', 'box', '#c1a582', [0, 4, 0], [250, 8, 200]),
  part('Rear wall', 'box', '#b4c6ba', [0, 103, -97], [250, 190, 6]),
  part('Side wall', 'box', '#d8d9c6', [-122, 87, 0], [6, 158, 200]),
  part('Counter base', 'box', '#477d74', [-19, 51, 30], [128, 86, 55]),
  part('Countertop', 'box', linen, [-19, 97, 30], [136, 6, 62]),
  part('Counter ledge', 'box', brass, [-19, 73, 58], [128, 3, 2], [], steel),
  part('Wall sign', 'box', '#e9e1cd', [12, 145, -92], [111, 52, 4]),
  part('Sign emblem', 'torus', teal, [12, 145, -88], [33, 33, 3]),
  part('Planter', 'cylinder', clay, [83, 23, 24], [31, 30, 31]),
  part('Plant stem', 'cylinder', '#47644c', [83, 54, 24], [3.5, 36, 3.5]),
  part('Left leaf', 'sphere', '#688965', [73, 62, 24], [13, 35, 11], [0, 0, 36]),
  part('Right leaf', 'sphere', '#567e62', [92, 70, 24], [16, 44, 12], [0, 0, -27])
]);

const sculpture = project('Orbit study', 'Sculpture', 'A tabletop balance sculpture with a rising brass arc and a suspended sphere.', [
  part('Plinth', 'box', '#364445', [0, 1, 0], [13, 2, 9]),
  part('Base inset', 'box', brass, [0, 2.25, 0], [9, .5, 6], [], steel),
  part('Upright', 'cylinder', '#657879', [-2, 5, 0], [1.25, 5, 1.25], [], steel),
  part('Orbital ring', 'torus', brass, [0, 13, 0], [13.5, 14.5, 1.4], [0, 22, -16], steel),
  part('Suspension pin', 'cylinder', brass, [.75, 17, 0], [.24, 4.8, .24], [], steel),
  part('Orbiting sphere', 'sphere', clay, [.75, 13, 0], [5.3, 5.3, 5.3]),
  part('Counterweight', 'sphere', '#91aaa1', [-5.3, 9.5, 1.4], [2.8, 2.8, 2.8])
]);

export const templates = [jersey, bottle, carton, tote, mascot, merch, room, sculpture];
