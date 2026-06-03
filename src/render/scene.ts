import * as THREE from 'three';
import type { Board, Move, Piece } from '../core/types';
import { SIZE, EXIT_ROW } from '../core/types';
import { legalMoves, buildGrid } from '../core/board';
import { createCarGroup } from './car';

// Fixed palette: id 0 = red car, rest bright colours
const PALETTE: number[] = [0xe23b3b, 0x3b82f6, 0x22c55e, 0xf4c025, 0x8b5cf6, 0xff8a3d, 0x06b6d4, 0xf97316, 0xa3e635, 0xe879f9];

function pieceColor(id: number): number {
  return PALETTE[id] ?? 0x888888;
}

function groupCenter(p: Piece): [number, number] {
  const cx = p.c + (p.o === 'H' ? (p.len - 1) / 2 : 0);
  const cz = p.r + (p.o === 'V' ? (p.len - 1) / 2 : 0);
  return [cx - SIZE / 2 + 0.5, cz - SIZE / 2 + 0.5];
}

// Returns the continuous [min, max] head position a piece can slide to.
// For the red car (id 0) rightward, allow head up to SIZE-2 (exit).
function legalRange(piece: Piece, board: Board): [number, number] {
  const g = buildGrid(board);
  if (piece.o === 'H') {
    let min = piece.c;
    while (min - 1 >= 0 && (g[piece.r] as number[])[min - 1] === -1) min--;
    let tail = piece.c + piece.len - 1;
    let max = piece.c;
    while (tail + 1 < SIZE && (g[piece.r] as number[])[tail + 1] === -1) { tail++; max++; }
    if (piece.id === 0 && tail === SIZE - 1) max = SIZE - 2;
    return [min, max];
  } else {
    let min = piece.r;
    while (min - 1 >= 0 && (g[min - 1] as number[])[piece.c] === -1) min--;
    let tail = piece.r + piece.len - 1;
    let max = piece.r;
    while (tail + 1 < SIZE && (g[tail + 1] as number[])[piece.c] === -1) { tail++; max++; }
    return [min, max];
  }
}

interface DragState {
  piece: Piece;
  group: THREE.Group;
  axis: 'x' | 'z';
  startHead: number;
  startHitOnPlane: number;
  min: number;
  max: number;
  moved: boolean;
  liveHead: number;
}

export interface SceneController {
  renderBoard(board: Board): void;
  setOnMove(cb: (move: Move) => void): void;
  setOnBlocked(cb: () => void): void;
  highlightHint(move: Move): void;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneController {
  // --- renderer ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // --- scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9d9bd);

  // --- camera ---
  // Near-top-down view: a clear, readable grid (slight tilt keeps the 3D toy look).
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 13, 3.2);
  camera.lookAt(0, 0, 0);

  // --- lights ---
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d6b3f, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 10, 6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  // --- board geometry ---
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SIZE + 0.5, 0.5, SIZE + 0.5),
    new THREE.MeshStandardMaterial({ color: 0xc98f4f, roughness: 0.85 }),
  );
  boardMesh.position.y = -0.26;
  boardMesh.receiveShadow = true;
  scene.add(boardMesh);

  // grid lines
  const lineMat = new THREE.LineBasicMaterial({ color: 0x9c6a32 });
  for (let i = 0; i <= SIZE; i++) {
    const x = i - SIZE / 2;
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.01, -SIZE / 2),
          new THREE.Vector3(x, 0.01, SIZE / 2),
        ]),
        lineMat,
      ),
    );
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-SIZE / 2, 0.01, x),
          new THREE.Vector3(SIZE / 2, 0.01, x),
        ]),
        lineMat,
      ),
    );
  }

  // exit marker
  const exitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.05, 1),
    new THREE.MeshStandardMaterial({ color: 0xffd23f }),
  );
  exitMesh.position.set(SIZE / 2 + 0.05, 0.02, EXIT_ROW - 2.5);
  scene.add(exitMesh);

  // --- resize ---
  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // --- state ---
  let currentBoard: Board = [];
  const carGroups = new Map<number, THREE.Group>();

  let selected: Piece | null = null;
  const markers: THREE.Mesh[] = [];
  const markerMoves = new Map<THREE.Mesh, Move>();

  let onMoveCb: ((move: Move) => void) | null = null;
  let onBlockedCb: (() => void) | null = null;

  let animFn: (() => void) | null = null;

  // Drag state: null when idle
  let drag: DragState | null = null;

  // Large, easy-to-tap destination discs (nearly a full cell) — small ones were finicky to hit.
  const markerGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 28);

  // Board plane for drag raycasting (y = 0)
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeHit = new THREE.Vector3();

  // --- helpers ---
  function setLit(group: THREE.Group, on: boolean) {
    group.position.y = on ? 0.12 : 0;
    const lm = group.userData['lightMat'] as THREE.MeshStandardMaterial | undefined;
    const bm = group.userData['beamMat'] as THREE.MeshBasicMaterial | undefined;
    if (lm) lm.emissiveIntensity = on ? 0.9 : 0.18;
    if (bm) bm.opacity = on ? 0.16 : 0;
  }

  function clearMarkers() {
    for (const m of markers) scene.remove(m);
    markers.length = 0;
    markerMoves.clear();
  }

  function showMarkers(piece: Piece) {
    clearMarkers();
    const moves = legalMoves(currentBoard).filter((mv) => mv.idx === piece.id);
    for (const mv of moves) {
      const isExit = piece.id === 0 && mv.nc === SIZE - 2;
      const mk = new THREE.Mesh(
        markerGeo,
        new THREE.MeshStandardMaterial({
          color: isExit ? 0xffd23f : 0x37d67a,
          emissive: isExit ? 0x886600 : 0x14502c,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.92,
        }),
      );
      let markerX: number;
      let markerZ: number;
      if (piece.o === 'H') {
        markerX = mv.nc + (piece.len - 1) / 2 - SIZE / 2 + 0.5;
        markerZ = mv.nr - SIZE / 2 + 0.5;
      } else {
        markerX = mv.nc - SIZE / 2 + 0.5;
        markerZ = mv.nr + (piece.len - 1) / 2 - SIZE / 2 + 0.5;
      }
      mk.position.set(markerX, 0.06, markerZ);
      scene.add(mk);
      markers.push(mk);
      markerMoves.set(mk, mv);
    }
  }

  function blockedFlash(group: THREE.Group) {
    const body = group.children[0] as THREE.Mesh;
    const mat = body.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;
    const c0 = mat.color.clone();
    const x0 = group.position.x;
    let t = 0;
    const iv = setInterval(() => {
      group.position.x = x0 + Math.sin(t * 1.2) * 0.06;
      t += 2;
      if (t > 18) {
        clearInterval(iv);
        group.position.x = x0;
        mat.color.copy(c0);
      }
    }, 16);
  }

  function selectPiece(piece: Piece) {
    selected = piece;
    const group = carGroups.get(piece.id);
    if (!group) return;
    setLit(group, true);
    showMarkers(piece);
    const moves = legalMoves(currentBoard).filter((mv) => mv.idx === piece.id);
    if (!moves.length) {
      onBlockedCb?.();
      blockedFlash(group);
    }
  }

  function deselect() {
    if (selected !== null) {
      const group = carGroups.get(selected.id);
      if (group) setLit(group, false);
    }
    selected = null;
    clearMarkers();
  }

  function doMove(piece: Piece, mv: Move) {
    clearMarkers();
    const group = carGroups.get(piece.id);
    if (!group) return;
    setLit(group, false);
    selected = null;

    const from = group.position.clone();
    const targetPiece = { ...piece, r: mv.nr, c: mv.nc };
    const [tx, tz] = groupCenter(targetPiece);
    const to = new THREE.Vector3(tx, 0, tz);

    const t0 = performance.now();
    const dur = 160;
    animFn = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - (1 - k) * (1 - k);
      group.position.lerpVectors(from, to, e);
      if (k >= 1) {
        animFn = null;
        onMoveCb?.(mv);
      }
    };
  }

  // --- raycaster ---
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function setNdc(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function onPointerDown(e: PointerEvent) {
    setNdc(e);
    ray.setFromCamera(ndc, camera);

    // 1. If a car is selected, check markers first (tap-to-destination)
    if (selected !== null) {
      const mh = ray.intersectObjects(markers);
      if (mh.length) {
        const mk = mh[0]?.object as THREE.Mesh;
        const mv = markerMoves.get(mk);
        if (mv) {
          doMove(selected, mv);
          return;
        }
      }
    }

    // 2. Raycast car groups
    const allGroups = [...carGroups.values()];
    const ch = ray.intersectObjects(allGroups, true);
    if (ch.length) {
      let obj: THREE.Object3D | null = ch[0]?.object ?? null;
      while (obj && obj.parent && !(obj.userData['piece'] as Piece | undefined)) {
        obj = obj.parent;
      }
      const piece = obj?.userData['piece'] as Piece | undefined;
      if (piece) {
        // Select if not already selected
        if (selected === null || selected.id !== piece.id) {
          deselect();
          selectPiece(piece);
        }

        // Begin a potential drag
        ray.setFromCamera(ndc, camera);
        ray.ray.intersectPlane(boardPlane, planeHit);
        const startHitOnPlane = piece.o === 'H' ? planeHit.x : planeHit.z;
        const startHead = piece.o === 'H' ? piece.c : piece.r;
        const [min, max] = legalRange(piece, currentBoard);
        const group = carGroups.get(piece.id);
        if (group) {
          drag = {
            piece,
            group,
            axis: piece.o === 'H' ? 'x' : 'z',
            startHead,
            startHitOnPlane,
            min,
            max,
            moved: false,
            liveHead: startHead,
          };
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }
    }

    // 3. Empty board click → deselect
    deselect();
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    setNdc(e);
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(boardPlane, planeHit);

    const now = drag.axis === 'x' ? planeHit.x : planeHit.z;
    const delta = now - drag.startHitOnPlane;
    const rawHead = drag.startHead + delta;
    const clampedHead = Math.max(drag.min, Math.min(drag.max, rawHead));
    drag.liveHead = clampedHead;

    if (Math.abs(clampedHead - drag.startHead) > 0.15) {
      if (!drag.moved) {
        drag.moved = true;
        clearMarkers(); // hide markers during drag
      }
      // Move the car group continuously
      const p = drag.piece;
      if (p.o === 'H') {
        const cx = clampedHead + (p.len - 1) / 2 - SIZE / 2 + 0.5;
        drag.group.position.x = cx;
      } else {
        const cz = clampedHead + (p.len - 1) / 2 - SIZE / 2 + 0.5;
        drag.group.position.z = cz;
      }
      // Lift slightly while dragging
      drag.group.position.y = 0.2;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag) return;

    if (drag.moved) {
      // Snap to nearest integer within [min, max]
      const snapped = Math.max(drag.min, Math.min(drag.max, Math.round(drag.liveHead)));
      const piece = drag.piece;

      if (snapped !== drag.startHead) {
        // Commit the move via the same path as tapped moves
        const mv: Move =
          piece.o === 'H'
            ? { idx: piece.id, nr: piece.r, nc: snapped }
            : { idx: piece.id, nr: snapped, nc: piece.c };
        doMove(piece, mv);
      } else {
        // Dragged but ended at start — return car to resting position
        const [wx, wz] = groupCenter(piece);
        drag.group.position.set(wx, 0, wz);
        deselect();
      }
    }
    // If !drag.moved: it was a tap — leave car selected with markers showing

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if pointer was already released
    }
    drag = null;
  }

  function onPointerCancel(e: PointerEvent) {
    if (!drag) return;
    // Return car to its original position
    const [wx, wz] = groupCenter(drag.piece);
    drag.group.position.set(wx, 0, wz);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    drag = null;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  // --- animation loop ---
  renderer.setAnimationLoop(() => {
    if (animFn) animFn();
    const t = performance.now();
    for (const m of markers) {
      m.position.y = 0.06 + Math.sin(t / 250 + m.position.x) * 0.03;
    }
    renderer.render(scene, camera);
  });

  // --- controller implementation ---
  function renderBoard(board: Board) {
    currentBoard = board;

    for (const g of carGroups.values()) scene.remove(g);
    carGroups.clear();
    deselect();
    drag = null;

    for (const piece of board) {
      const group = createCarGroup(piece, pieceColor(piece.id));
      group.userData['piece'] = piece;
      const [wx, wz] = groupCenter(piece);
      group.position.set(wx, 0, wz);
      scene.add(group);
      carGroups.set(piece.id, group);
    }
  }

  function highlightHint(move: Move) {
    const piece = currentBoard[move.idx];
    if (!piece) return;
    const group = carGroups.get(piece.id);
    if (!group) return;

    const lm = group.userData['lightMat'] as THREE.MeshStandardMaterial | undefined;
    const prev = lm?.emissiveIntensity ?? 0.18;
    if (lm) lm.emissiveIntensity = 0.9;
    setTimeout(() => {
      if (lm) lm.emissiveIntensity = prev;
    }, 400);
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    resizeObserver.disconnect();
    renderer.dispose();
  }

  return { renderBoard, setOnMove, setOnBlocked, highlightHint, dispose };

  function setOnMove(cb: (move: Move) => void) {
    onMoveCb = cb;
  }
  function setOnBlocked(cb: () => void) {
    onBlockedCb = cb;
  }
}
