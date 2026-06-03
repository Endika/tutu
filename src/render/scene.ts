import * as THREE from 'three';
import type { Board, Move, Piece } from '../core/types';
import { SIZE, EXIT_ROW } from '../core/types';
import { legalMoves } from '../core/board';
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
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 9, 7.5);
  camera.lookAt(0, 0, 0.3);

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
  // map marker → Move that produced it
  const markerMoves = new Map<THREE.Mesh, Move>();

  let onMoveCb: ((move: Move) => void) | null = null;
  let onBlockedCb: (() => void) | null = null;

  let animFn: (() => void) | null = null;

  const markerGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24);

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
      // Place marker at the visual center of the destination position
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

  function onPointerDown(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);

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

    const allGroups = [...carGroups.values()];
    const ch = ray.intersectObjects(allGroups, true);
    if (ch.length) {
      let obj: THREE.Object3D | null = ch[0]?.object ?? null;
      while (obj && obj.parent && !(obj.userData['piece'] as Piece | undefined)) {
        obj = obj.parent;
      }
      const piece = obj?.userData['piece'] as Piece | undefined;
      if (piece) {
        if (selected !== null && selected.id === piece.id) {
          deselect();
        } else {
          deselect();
          selectPiece(piece);
        }
        return;
      }
    }

    deselect();
  }

  canvas.addEventListener('pointerdown', onPointerDown);

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

    // remove old car groups
    for (const g of carGroups.values()) scene.remove(g);
    carGroups.clear();
    deselect();

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

    // pulse the car briefly
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
