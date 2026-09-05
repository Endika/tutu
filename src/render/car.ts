import * as THREE from 'three'
import type { Piece } from '../core/types'

function carBodyGeometry(len: number): THREE.ExtrudeGeometry {
  const L = len * 0.92
  const h = 0.42
  const s = new THREE.Shape()
  s.moveTo(0.18, 0)
  s.lineTo(L - 0.18, 0)
  s.quadraticCurveTo(L, 0, L, 0.16)
  s.lineTo(L, h)
  s.quadraticCurveTo(L, h + 0.05, L - 0.18, h + 0.05)
  s.lineTo(L * 0.6, h + 0.05)
  s.quadraticCurveTo(L * 0.54, h + 0.06, L * 0.49, h + 0.42)
  s.lineTo(L * 0.3, h + 0.42)
  s.quadraticCurveTo(L * 0.2, h + 0.4, L * 0.17, h + 0.05)
  s.lineTo(0.18, h + 0.05)
  s.quadraticCurveTo(0, h + 0.05, 0, h)
  s.lineTo(0, 0.16)
  s.quadraticCurveTo(0, 0, 0.18, 0)
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.74,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 12,
  })
  geo.translate(-L / 2, 0, -0.37)
  return geo
}

export function createCarGroup(piece: Piece, color: number): THREE.Group {
  const group = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 })
  const body = new THREE.Mesh(carBodyGeometry(piece.len), bodyMat)
  body.castShadow = true
  body.position.y = 0.16
  group.add(body)

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fd8ff,
    roughness: 0.08,
    metalness: 0.2,
  })
  const glass = new THREE.Mesh(new THREE.BoxGeometry(piece.len * 0.3, 0.3, 0.8), glassMat)
  glass.position.set(-piece.len * 0.06, 0.66, 0)
  group.add(glass)

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 })
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4, metalness: 0.3 })
  const ax = piece.len * 0.3
  for (const sx of [-ax, ax]) {
    for (const sz of [-0.42, 0.42]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 20), tireMat)
      tire.rotation.x = Math.PI / 2
      tire.position.set(sx, 0.18, sz)
      tire.castShadow = true
      group.add(tire)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12), hubMat)
      hub.rotation.x = Math.PI / 2
      hub.position.set(sx, 0.18, sz)
      group.add(hub)
    }
  }

  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xffe08a,
    emissiveIntensity: 0.18,
  })
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff1b0,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const frontX = (piece.len * 0.92) / 2 - 0.03
  for (const sz of [-0.26, 0.26]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), lightMat)
    hl.position.set(frontX, 0.28, sz)
    group.add(hl)
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 18, 1, true), beamMat)
    beam.rotation.z = Math.PI / 2
    beam.position.set(frontX + 0.55, 0.28, sz)
    group.add(beam)
  }

  group.userData['lightMat'] = lightMat
  group.userData['beamMat'] = beamMat

  if (piece.o === 'V') group.rotation.y = Math.PI / 2

  return group
}
