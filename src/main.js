import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Сцена
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

// Камера
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 5);

// Рендерер
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Освещение
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 10, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Заменяем куб на модель кота
let target;
const loader = new GLTFLoader();
loader.load(
  "/models/cat.glb",
  (gltf) => {
    target = gltf.scene;
    target.position.y = 0;
    target.scale.set(0.5, 0.5, 0.5);
    target.castShadow = true;

    // Центрируем модель и настраиваем тени
    target.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    scene.add(target);


    
    
    
    
  },
  undefined,
  (error) => {
    console.error("Error loading cat model:", error);
    // Если модель не загрузилась, создаем куб как fallback
    const cubeMaterials = [
      new THREE.MeshPhongMaterial({ color: 0xff0000 }),
      new THREE.MeshPhongMaterial({ color: 0xff0000 }),
      new THREE.MeshPhongMaterial({ color: 0xff0000 }),
      new THREE.MeshPhongMaterial({ color: 0xff0000 }),
      new THREE.MeshPhongMaterial({ color: 0xffffff }),
      new THREE.MeshPhongMaterial({ color: 0xff0000 }),
    ];
    target = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), cubeMaterials);
    target.castShadow = true;
    target.position.y = 1;
    scene.add(target);
  }
);

// Шахматный пол с тенями (увеличена площадь)
function createChessboard(size, tiles) {
  const group = new THREE.Group();
  const tileSize = size / tiles;
  const halfSize = size / 2;

  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(tileSize, tileSize),
        new THREE.MeshPhongMaterial({
          color: (i + j) % 2 === 0 ? 0xffffff : 0x333333,
          side: THREE.DoubleSide,
        })
      );
      tile.receiveShadow = true;
      tile.position.x = i * tileSize - halfSize + tileSize / 2;
      tile.position.z = j * tileSize - halfSize + tileSize / 2;
      tile.rotation.x = -Math.PI / 2;
      group.add(tile);
    }
  }
  return group;
}

// Увеличиваем размер доски до 40x40 с 16x16 клетками
const chessboard = createChessboard(40, 16);
scene.add(chessboard);

// Настройка управления
const controls = new PointerLockControls(camera, renderer.domElement);

// Параметры камеры
const cameraDistance = 5;
let cameraAngleX = Math.PI;
let cameraAngleY = Math.PI / 4;

// Управление движением (уменьшена скорость)
const moveSpeed = 0.12;
const rotationSpeed = 0.15;
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false,
  ShiftRight: false,
};

// Физика
let velocity = new THREE.Vector3();
let isOnGround = true;
const gravity = -0.01;
const jumpForce = 0.15;

// UI элементы
const instructions = document.createElement("div");
instructions.id = "instructions";
instructions.innerHTML = `
    <h3>Управление</h3>
    <p>Кликните для захвата управления</p>
    <p>WASD - движение</p>
    <p>SPACE - прыжок</p>
    <p>SHIFT - ускорение</p>
    <p>ESC - выход из режима</p>
`;
document.body.appendChild(instructions);

// Обработчики событий
function setupEventListeners() {
  function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
      controls.enabled = true;
      instructions.style.display = "none";
    } else {
      controls.enabled = false;
      instructions.style.display = "block";
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("click", () => {
    renderer.domElement.requestPointerLock();
  });

  document.addEventListener("mousemove", (event) => {
    if (!controls.enabled) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    cameraAngleX -= movementX * 0.002;
    cameraAngleY = THREE.MathUtils.clamp(
      cameraAngleY + movementY * 0.002,
      0.1,
      Math.PI / 2 - 0.1
    );
  });

  document.addEventListener("keydown", (event) => {
    if (event.code in keys) keys[event.code] = true;
    if (event.code === "Space" && isOnGround) {
      velocity.y = jumpForce;
      isOnGround = false;
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code in keys) keys[event.code] = false;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Обновление позиции камеры
function updateCamera() {
  if (!target) return;

  const x =
    target.position.x +
    cameraDistance * Math.sin(cameraAngleX) * Math.cos(cameraAngleY);
  const y = target.position.y + 1 + cameraDistance * Math.sin(cameraAngleY);
  const z =
    target.position.z +
    cameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);

  camera.position.set(x, y, z);
  camera.lookAt(target.position.x, target.position.y + 1, target.position.z);
}

// Обработка движения
function handleMovement(delta) {
  if (!target) return;

  const forward = new THREE.Vector3(
    Math.sin(cameraAngleX),
    0,
    Math.cos(cameraAngleX)
  ).normalize();

  const right = new THREE.Vector3(
    Math.sin(cameraAngleX + Math.PI / 2),
    0,
    Math.cos(cameraAngleX + Math.PI / 2)
  ).normalize();

  const direction = new THREE.Vector3();
  if (keys.KeyW) direction.sub(forward);
  if (keys.KeyS) direction.add(forward);
  if (keys.KeyA) direction.sub(right);
  if (keys.KeyD) direction.add(right);

  const speedMultiplier = keys.ShiftLeft || keys.ShiftRight ? 1.5 : 1;

  if (direction.length() > 0) {
    direction.normalize();
    let targetRotation = Math.atan2(direction.x, direction.z);

    // Вычисляем разницу между текущим и целевым углом
    let angleDifference = targetRotation - target.rotation.y;

    // Нормализуем разницу в диапазон [-π, π]
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

    // Плавный поворот
    target.rotation.y += angleDifference * rotationSpeed;

    velocity.x = direction.x * moveSpeed * speedMultiplier;
    velocity.z = direction.z * moveSpeed * speedMultiplier;
  } else {
    velocity.x *= 0.9;
    velocity.z *= 0.9;
  }

  velocity.y += gravity;

  if (target.position.y <= 0) {
    target.position.y = 0;
    velocity.y = 0;
    isOnGround = true;
  }

  target.position.add(velocity);

  // Увеличены границы движения в соответствии с размером доски
  target.position.x = THREE.MathUtils.clamp(target.position.x, -20, 20);
  target.position.z = THREE.MathUtils.clamp(target.position.z, -20, 20);
}

// Анимация
let lastTime = 0;
function animate(time) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;

  handleMovement(delta);
  updateCamera();
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// Инициализация
setupEventListeners();
animate();
