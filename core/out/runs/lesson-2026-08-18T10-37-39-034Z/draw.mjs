import { draw } from '../../../pipeline/lib/sampling.mjs';
// FINAL declared ranges (see plan.out.json -> operand_draw):
//   A = 4 x d,  d integer 3..24   -> the awkward-looking percent, 12..96
//   B = 25 x e, e integer 1..3    -> the friendly quantity, {25, 50, 75}
const A = draw(343064731, { min: 3, max: 24, filter: { max_digits: 2, nonzero: true, positive_only: true } }, 1);
const B = draw(343064732, { min: 1, max: 3,  filter: { max_digits: 1, nonzero: true, positive_only: true } }, 1);
const a = 4 * A.draws[0], b = 25 * B.draws[0];
console.log(JSON.stringify({ A, B, a, b, product: a * b / 100 }, null, 2));
