// threeShim.js — the game loads vendor/three.min.js as a classic script, which
// sets window.THREE. ES modules cannot `import *` a global, so this one file
// re-exports it as a default import for every other module.
const THREE = window.THREE;
if (!THREE) throw new Error('three.min.js failed to load before the game modules');
export default THREE;
