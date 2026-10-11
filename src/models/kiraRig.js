import { createJohnnyRig } from './johnnyRig.js';

// Kira's jacket rises a little higher than Johnny's vest, and the sculpted
// hair starts above the collar. The same seven-bone skinning uses those bounds.
export function createKiraRig(source) {
  return createJohnnyRig(source, {
    hip: .31,
    shoulder: .57,
    neck: .68,
    headStart: .64,
    headEnd: .74,
    blendSeams: true,
  });
}
