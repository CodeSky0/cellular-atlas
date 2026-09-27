import * as THREE from 'three';

export function makeStriationTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E8D5D5';
  ctx.fillRect(0, 0, 512, 64);

  ctx.fillStyle = '#8A4A55';
  ctx.fillRect(120, 0, 272, 64);

  ctx.fillStyle = '#B8737D';
  ctx.fillRect(216, 0, 80, 64);

  ctx.fillStyle = '#5C2E36';
  ctx.fillRect(252, 0, 8, 64);

  ctx.fillStyle = '#4A1C24';
  ctx.fillRect(0, 0, 12, 64);
  ctx.fillRect(500, 0, 12, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeStriationNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 64);

  ctx.fillStyle = '#6060ff';
  ctx.fillRect(0, 0, 12, 64);
  ctx.fillRect(500, 0, 12, 64);

  ctx.fillStyle = '#a0a0ff';
  ctx.fillRect(120, 0, 272, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
