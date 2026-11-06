import { lengthOf, type State } from '../model/game';

export type Vec3 = [number, number, number];
export const PIECE_SCALE = 1.22;
export const MARKER_STACK_HEIGHT = .19;
// Equal pitch gives a square grid and 45-degree board edges.
export const GRID = { columnStep: .8, rowStep: .8 } as const;
export const spacing = GRID.rowStep;
export const TILE_SIZE = { width: .66, height: .10, depth: .66 } as const;
export const SOCKET_SIZE = { width: .75, height: .035, depth: .75 } as const;
export const LABEL_SIZE = { width: .78, depth: .62 } as const;
export const LABEL_GAP = .75;
export const EDGE_SLOPE = GRID.rowStep / GRID.columnStep;
export const FACE_PADDING = .20;

// Support distances of the complete socket and label rectangles against the
// sloping edges. Centre the whole composition, including its number band.
const longestHalfTrack = (lengthOf(7) - 1) * GRID.rowStep / 2;
const farExtent = longestHalfTrack + SOCKET_SIZE.depth / 2 + EDGE_SLOPE * SOCKET_SIZE.width / 2;
const nearExtent = longestHalfTrack + LABEL_GAP + LABEL_SIZE.depth / 2 + EDGE_SLOPE * LABEL_SIZE.width / 2;
export const GRID_CENTRE_Z = (farExtent - nearExtent) / 2;
const faceDepth = (farExtent + nearExtent) / 2 + FACE_PADDING;
function squareLayer(extra: number) {
  const halfDiagonal = faceDepth + extra;
  return { halfWidth: halfDiagonal, halfDepth: halfDiagonal, centreZ: 0 } as const;
}
export const BOARD_LAYERS = {
  face: squareLayer(0), rim: squareLayer(.10), base: squareLayer(.22)
} as const;
export const BOARD_FACE = BOARD_LAYERS.face;
export type BoardFraming = {
  leftCorner: {x:number;y:number}; rightCorner: {x:number;y:number};
  topCorner: {x:number;y:number}; bottomCorner: {x:number;y:number};
  tracks: {column:number;x:number;y:number;label:{left:number;right:number;top:number;bottom:number}}[];
};
export function trackLabel(column: number): Vec3 {
  const bottom = cell(column, 1);
  return [bottom[0], .535, bottom[2] + LABEL_GAP];
}
export const PODIUM = { x: -3.4, z: 4.7, radius: 1.16, surface: .205 } as const;

export function cell(column: number, position: number): Vec3 {
  return [(column - 7) * GRID.columnStep, .64, GRID_CENTRE_Z + ((lengthOf(column) - 1) / 2 - (position - 1)) * spacing];
}

/** Exact square centres; shared positions stack upward, never sideways. */
export function markerPoint(state: State, column: number, position: number, owner: number): Vec3 {
  const point = cell(column, position);
  const below = state.saved.filter((saved, index) => index < owner && saved[column] === position).length;
  point[1] += below * MARKER_STACK_HEIGHT;
  return point;
}

export function runnerPoint(state: State, column: number, position: number): Vec3 {
  const point = cell(column, position);
  point[1] += state.saved.filter(saved => saved[column] === position).length * MARKER_STACK_HEIGHT;
  return point;
}

/** Three stable triangular slots on the ivory disk, in board-local coordinates. */
export function runnerHome(slot: number): Vec3 {
  const offsets = [[-.44, -.35], [.44, -.35], [0, .44]];
  if (!offsets[slot]) throw new Error('A runner needs a podium slot from 0 to 2');
  return [PODIUM.x + offsets[slot][0], PODIUM.surface, PODIUM.z + offsets[slot][1]];
}
