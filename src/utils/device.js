export function isMobileViewport() {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const shortEdge = Math.min(window.innerWidth, window.innerHeight);
  return coarsePointer || shortEdge <= 900;
}
