import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createScene(container, params, { onError } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.1, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3, 5, 4);
  scene.add(key);

  const spinner = document.createElement('div');
  spinner.className = 'loader';
  spinner.style.setProperty('--ship-color', params.color);
  container.append(spinner);

  let rocket = null;
  let disposed = false;
  let raf = 0;
  const clock = new THREE.Clock();

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function tick() {
    const t = clock.getElapsedTime();
    if (rocket) {
      rocket.rotation.y = t * 0.5;
      rocket.position.y = Math.sin(t * 1.5) * 0.15;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  function teardown() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    spinner.remove();
    if (rocket) disposeObject3D(rocket);
    renderer.dispose();
    renderer.domElement.remove();
  }

  // The load is async; the scene may be disposed before it resolves. Guard both
  // callbacks so a late load neither touches a torn-down scene nor leaks the GPU
  // resources it just allocated.
  new GLTFLoader().load(
    import.meta.env.BASE_URL + 'rocket.glb',
    (gltf) => {
      spinner.remove();
      if (disposed) {
        disposeObject3D(gltf.scene);
        return;
      }
      rocket = gltf.scene;
      tint(rocket, params.color);
      fitToHeight(rocket, 2.4);
      scene.add(rocket);
    },
    undefined,
    (err) => {
      if (disposed) return;
      console.warn('rocket.glb failed to load', err);
      teardown();
      onError?.(err);
    },
  );

  return { dispose: teardown };
}

function tint(object3d, color) {
  const c = new THREE.Color(color);
  object3d.traverse((node) => {
    if (node.isMesh && node.material) {
      node.material = node.material.clone();
      node.material.color = c;
    }
  });
}

function fitToHeight(object3d, targetHeight) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  object3d.scale.setScalar(scale);
  object3d.position.sub(center.multiplyScalar(scale));
}

function disposeObject3D(obj) {
  obj.traverse((node) => {
    if (node.isMesh) {
      node.geometry?.dispose();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) disposeMaterial(m);
    }
  });
}

function disposeMaterial(material) {
  if (!material) return;
  // A material owns its textures (map, normalMap, roughnessMap, …); dispose them
  // too, or the GPU handles leak. Walk its properties rather than naming each map.
  for (const value of Object.values(material)) {
    if (value?.isTexture) value.dispose();
  }
  material.dispose();
}
