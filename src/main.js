import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ========== НАСТРОЙКИ ==========
const SETTINGS = {
  // Коэффициенты скорости анимаций
  ANIMATION_SPEED: {
    IDLE: 1.0,
    WALK: 1.2,
    RUN: 1.5,
  },

  // Параметры движения
  MOVEMENT: {
    WALK_SPEED: 0.15,
    RUN_SPEED: 0.25,
    ROTATION_SPEED: 0.3,
    JUMP_FORCE: 0.2,
    GRAVITY: -0.02,
  },

  // Параметры камеры
  CAMERA: {
    DISTANCE: {
      MIN: 3, // Минимальное расстояние
      MAX: 10, // Максимальное расстояние
      DEFAULT: 5, // Расстояние по умолчанию
      ZOOM_SPEED: 0.5, // Скорость изменения расстояния
      LERP_FACTOR: 0.1, // Плавность интерполяции
    },
    MIN_ANGLE_Y: 0.1,
    MAX_ANGLE_Y: Math.PI / 2 - 0.1,
  },
};
// ===============================

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Мягкий белый свет
scene.add(ambientLight);

// Основной направленный свет - сделаем его мягче
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 10, 1);
directionalLight.castShadow = true;

// Настройки теней для покрытия всей площади пола
directionalLight.shadow.mapSize.width = 1024; // Высокое разрешение тени
directionalLight.shadow.mapSize.height = 1024;

// Увеличиваем область видимости камеры теней
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -30; // Увеличиваем влево
directionalLight.shadow.camera.right = 30; // Увеличиваем вправо
directionalLight.shadow.camera.top = 30; // Увеличиваем вверх
directionalLight.shadow.camera.bottom = -30; // Увеличиваем вниз

// Уменьшаем артефакты теней
directionalLight.shadow.bias = -0.001;
directionalLight.shadow.normalBias = 0.05;

scene.add(directionalLight);

// Добавим заполняющий свет с противоположной стороны
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-1, 0.5, -1);
scene.add(fillLight);

// Модель кота
let target;
let mixer;
let actions = {};
let currentAction = "";

const loader = new GLTFLoader();
loader.load(
  "/models/cat.glb",
  (gltf) => {
    target = gltf.scene;
    target.position.y = 0;
    target.scale.set(0.5, 0.5, 0.5);
    target.castShadow = true;

    // Центрируем модель и настраиваем материалы для матового вида
    target.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        // Заменяем материалы на матовые
        if (child.material) {
          child.material = new THREE.MeshStandardMaterial({
            color: child.material.color,
            roughness: 0.8, // Увеличиваем шероховатость для матовости
            metalness: 0.1, // Уменьшаем металличность
          });
        }
      }
    });

    // Инициализация анимаций
    mixer = new THREE.AnimationMixer(target);

    // Находим нужные анимации
    const clips = gltf.animations;
    const clipIdle = THREE.AnimationClip.findByName(clips, "idle") || clips[0];
    const clipWalk = THREE.AnimationClip.findByName(clips, "walk") || clips[0];
    const clipRun = THREE.AnimationClip.findByName(clips, "run") || clipWalk;

    // Создаем действия
    actions = {
      idle: mixer.clipAction(clipIdle),
      walk: mixer.clipAction(clipWalk),
      run: mixer.clipAction(clipRun),
    };

    // Настройка анимаций
    actions.idle.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.IDLE);
    actions.walk.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.WALK);
    actions.run.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.RUN);

    Object.values(actions).forEach((action) => {
      action.setEffectiveWeight(1);
      action.setLoop(THREE.LoopRepeat, Infinity);
    });

    // Запускаем анимацию покоя по умолчанию
    setAction("idle");

    scene.add(target);
  },
  undefined,
  (error) => {
    console.error("Error loading cat model:", error);
    // Fallback куб с матовым материалом
    const matMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.7,
      metalness: 0.1,
    });
    target = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), matMaterial);
    target.castShadow = true;
    target.position.y = 1;
    scene.add(target);
  }
);

// Функция для переключения анимаций
function setAction(actionName) {
  if (currentAction === actionName || !actions[actionName]) return;

  if (currentAction) {
    // Плавное затухание текущей анимации
    actions[currentAction].fadeOut(0.2);
  }

  // Плавное появление новой анимации
  actions[actionName].reset().fadeIn(0.2).play();
  currentAction = actionName;
}

// Шахматный пол с тенями
function createChessboard(size, tiles) {
  const group = new THREE.Group();
  const tileSize = size / tiles;
  const halfSize = size / 2;

  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(tileSize, tileSize),
        new THREE.MeshStandardMaterial({
          color: (i + j) % 2 === 0 ? 0xffffff : 0x333333,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0.0,
        })
      );
      tile.receiveShadow = true; // Важно: пол должен получать тени
      tile.position.x = i * tileSize - halfSize + tileSize / 2;
      tile.position.z = j * tileSize - halfSize + tileSize / 2;
      tile.rotation.x = -Math.PI / 2;
      group.add(tile);
    }
  }
  return group;
}

// Создаем доску большего размера (40x40 единиц с 16x16 клетками)
const SIZE_FLOOR = 256;
const chessboard = createChessboard(SIZE_FLOOR, 64);
scene.add(chessboard);

// Настройка управления
const controls = new PointerLockControls(camera, renderer.domElement);

// Параметры камеры
// Параметры камеры
let cameraAngleX = Math.PI;
let cameraAngleY = Math.PI / 4;
let currentCameraDistance = SETTINGS.CAMERA.DISTANCE.DEFAULT; // Текущее расстояние
let targetCameraDistance = SETTINGS.CAMERA.DISTANCE.DEFAULT; // Целевое расстояние

// Управление движением
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
let canJump = true;

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

    cameraAngleX -= movementX * 0.004;
    cameraAngleY = THREE.MathUtils.clamp(
      cameraAngleY + movementY * 0.004,
      SETTINGS.CAMERA.MIN_ANGLE_Y,
      SETTINGS.CAMERA.MAX_ANGLE_Y
    );
  });

  // Обработка колесика мыши для приближения/отдаления
  document.addEventListener("wheel", (event) => {
    targetCameraDistance = THREE.MathUtils.clamp(
      targetCameraDistance -
        event.deltaY * SETTINGS.CAMERA.DISTANCE.ZOOM_SPEED * 0.01,
      SETTINGS.CAMERA.DISTANCE.MIN,
      SETTINGS.CAMERA.DISTANCE.MAX
    );
  });

  document.addEventListener("keydown", (event) => {
    if (event.code in keys) keys[event.code] = true;

    // Обработка прыжка
    if (event.code === "Space" && isOnGround && canJump) {
      velocity.y = SETTINGS.MOVEMENT.JUMP_FORCE;
      isOnGround = false;
      canJump = false;

      // Задержка перед следующим прыжком
      setTimeout(() => {
        canJump = true;
      }, 300);
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code in keys) keys[event.code] = false;

    // Мгновенная остановка при отпускании клавиш движения
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      // Проверяем, остались ли нажатыми другие клавиши движения
      const anyMovementKeyPressed =
        keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;

      if (!anyMovementKeyPressed) {
        // Если больше нет нажатых клавиш движения - мгновенно останавливаемся
        velocity.x = 0;
        velocity.z = 0;
      }
    }
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
    currentCameraDistance * Math.sin(cameraAngleX) * Math.cos(cameraAngleY);
  const y =
    target.position.y + 1 + currentCameraDistance * Math.sin(cameraAngleY);
  const z =
    target.position.z +
    currentCameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);

  camera.position.set(x, y, z);
  camera.lookAt(target.position.x, target.position.y + 2, target.position.z);
}

// Обработка движения
function handleMovement(delta) {
  if (!target || !mixer) return;

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

  // Определяем текущее действие
  if (direction.length() > 0) {
    const isRunning = keys.ShiftLeft || keys.ShiftRight;
    setAction(isRunning ? "run" : "walk");

    // Устанавливаем скорость анимации в зависимости от действия
    const targetSpeed = isRunning
      ? SETTINGS.ANIMATION_SPEED.RUN
      : SETTINGS.ANIMATION_SPEED.WALK;
    actions[currentAction].setEffectiveTimeScale(targetSpeed);
  } else {
    setAction("idle");
    actions.idle.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.IDLE);
  }

  const speedMultiplier =
    keys.ShiftLeft || keys.ShiftRight
      ? SETTINGS.MOVEMENT.RUN_SPEED / SETTINGS.MOVEMENT.WALK_SPEED
      : 1;

  if (direction.length() > 0) {
    direction.normalize();
    let targetRotation = Math.atan2(direction.x, direction.z);

    let angleDifference = targetRotation - target.rotation.y;
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

    target.rotation.y += angleDifference * SETTINGS.MOVEMENT.ROTATION_SPEED;

    velocity.x = direction.x * SETTINGS.MOVEMENT.WALK_SPEED * speedMultiplier;
    velocity.z = direction.z * SETTINGS.MOVEMENT.WALK_SPEED * speedMultiplier;
  } else {
    // Мгновенная остановка
    velocity.x = 0;
    velocity.z = 0;
  }

  // Применяем гравитацию
  velocity.y += SETTINGS.MOVEMENT.GRAVITY;

  // Проверка нахождения на земле
  if (target.position.y <= 0) {
    target.position.y = 0;
    velocity.y = 0;
    isOnGround = true;
  } else {
    isOnGround = false;
  }

  if (canJump == 0) {
    velocity.y = 5 * 2 * delta;
  }

  // Применяем движение
  target.position.add(velocity);

  // Ограничиваем движение в пределах игровой области
  target.position.x = THREE.MathUtils.clamp(
    target.position.x,
    -SIZE_FLOOR / 2,
    SIZE_FLOOR / 2
  );
  target.position.z = THREE.MathUtils.clamp(
    target.position.z,
    -SIZE_FLOOR / 2,
    SIZE_FLOOR / 2
  );

  // Обновляем микшер анимаций
  mixer.update(delta);
}

// Анимация
let lastTime = 0;
function animate(time) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;

  // Плавное изменение расстояния камеры
  currentCameraDistance = THREE.MathUtils.lerp(
    currentCameraDistance,
    targetCameraDistance,
    SETTINGS.CAMERA.DISTANCE.LERP_FACTOR
  );

  handleMovement(delta);
  updateCamera();
  renderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// Инициализация
setupEventListeners();
animate();
