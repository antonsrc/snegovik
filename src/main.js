import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Stats from "stats.js";

const SETTINGS = {
  ANIMATION_SPEED: {
    IDLE: 1.0,
    WALK: 1.2,
    RUN: 1.5,
    JUMP: 1.0,
  },

  MOVEMENT: {
    WALK_SPEED: 0.15,
    RUN_SPEED: 0.25,
    ROTATION_SPEED: 0.3,
    JUMP_FORCE: 0.2,
    GRAVITY: -0.02,
  },

  CAMERA: {
    DISTANCE: {
      MIN: 3,
      MAX: 10,
      DEFAULT: 5,
      ZOOM_SPEED: 0.5, // Скорость изменения расстояния
      LERP_FACTOR: 0.1, // Плавность интерполяции
    },
    MIN_ANGLE_Y: 0.1,
    MAX_ANGLE_Y: Math.PI / 2 - 0.1,
  },
};

const SIZE_FLOOR = 256;

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false,
  ShiftRight: false,
};

let clock = new THREE.Clock();

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 5);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 20, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 8192;
directionalLight.shadow.mapSize.height = 8192;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = SIZE_FLOOR * 2;
directionalLight.shadow.camera.left = -SIZE_FLOOR;
directionalLight.shadow.camera.right = SIZE_FLOOR;
directionalLight.shadow.camera.top = SIZE_FLOOR;
directionalLight.shadow.camera.bottom = -SIZE_FLOOR;
scene.add(directionalLight);

const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
scene.add(shadowHelper);

setupEventListeners();
addFloor();

// Модель кота
let modelCat;
let mixer;
let actions = {};
let currentAction = "";

const loader = new GLTFLoader();
loader.load("/models/cat.glb", (gltf) => {
  modelCat = gltf.scene;
  modelCat.position.y = 0;
  modelCat.scale.set(0.5, 0.5, 0.5);
  modelCat.castShadow = true;

  // Инициализация анимаций
  mixer = new THREE.AnimationMixer(modelCat);

  // Находим нужные анимации
  const clips = gltf.animations;
  const clipIdle = THREE.AnimationClip.findByName(clips, "idle");
  const clipWalk = THREE.AnimationClip.findByName(clips, "walk");
  const clipRun = THREE.AnimationClip.findByName(clips, "run");
  const clipJump = THREE.AnimationClip.findByName(clips, "jump");

  // Создаем действия
  actions = {
    idle: mixer.clipAction(clipIdle),
    walk: mixer.clipAction(clipWalk),
    run: mixer.clipAction(clipRun),
    jump: mixer.clipAction(clipJump),
  };

  // Настройка анимаций
  actions.idle.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.IDLE);
  actions.walk.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.WALK);
  actions.run.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.RUN);
  actions.jump.setEffectiveTimeScale(SETTINGS.ANIMATION_SPEED.JUMP);

  Object.values(actions).forEach((action) => {
    action.setEffectiveWeight(1);
    action.setLoop(THREE.LoopRepeat, Infinity);
  });

  scene.add(modelCat);
});

// Настройка управления
const controls = new PointerLockControls(camera, renderer.domElement);

// Параметры камеры
// Параметры камеры
let cameraAngleX = Math.PI;
let cameraAngleY = Math.PI / 4;
let currentCameraDistance = SETTINGS.CAMERA.DISTANCE.DEFAULT; // Текущее расстояние
let targetCameraDistance = SETTINGS.CAMERA.DISTANCE.DEFAULT; // Целевое расстояние

// Физика
let velocity = new THREE.Vector3();
let isOnGround = true;
let canJump = true;

// UI элементы
const instructions = document.createElement("div");
instructions.id = "instructions";
instructions.innerHTML = `
    <h1>Кликните для начала игры</h1>
    <h3>Управление</h3>
    <p>WASD - движение</p>
    <p>SPACE - прыжок</p>
    <p>SHIFT - ускорение</p>
    <p>ESC - выход</p>
`;
document.body.appendChild(instructions);

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
      setAction("jump"); // Включаем анимацию прыжка

      // Задержка перед следующим прыжком
      setTimeout(() => {
        canJump = true;
      }, 500);
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
  // Плавное изменение расстояния камеры
  currentCameraDistance = THREE.MathUtils.lerp(
    currentCameraDistance,
    targetCameraDistance,
    SETTINGS.CAMERA.DISTANCE.LERP_FACTOR
  );

  if (!modelCat) return;
  const x =
    modelCat.position.x +
    currentCameraDistance * Math.sin(cameraAngleX) * Math.cos(cameraAngleY);
  const y =
    modelCat.position.y + 1 + currentCameraDistance * Math.sin(cameraAngleY);
  const z =
    modelCat.position.z +
    currentCameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);

  camera.position.set(x, y, z);
  camera.lookAt(
    modelCat.position.x,
    modelCat.position.y + 2,
    modelCat.position.z
  );
}

// Обработка движения
function handleMovement(delta) {
  if (!modelCat || !mixer) return;

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
  if (direction.length() > 0 && isOnGround) {
    const isRunning = keys.ShiftLeft || keys.ShiftRight;
    setAction(isRunning ? "run" : "walk");

    // Устанавливаем скорость анимации в зависимости от действия
    const targetSpeed = isRunning
      ? SETTINGS.ANIMATION_SPEED.RUN
      : SETTINGS.ANIMATION_SPEED.WALK;
    actions[currentAction].setEffectiveTimeScale(targetSpeed);
  } else if (isOnGround == false) {
    // console.log('прыг')
    setAction("jump");
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

    let angleDifference = targetRotation - modelCat.rotation.y;
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

    modelCat.rotation.y += angleDifference * SETTINGS.MOVEMENT.ROTATION_SPEED;

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
  if (modelCat.position.y <= 0) {
    modelCat.position.y = 0;
    velocity.y = 0;
    isOnGround = true;
  } else {
    isOnGround = false;
  }

  if (canJump == 0) {
    velocity.y = 5 * 2 * delta;
  }

  // Применяем движение
  modelCat.position.add(velocity);

  // Ограничиваем движение в пределах игровой области
  modelCat.position.x = THREE.MathUtils.clamp(
    modelCat.position.x,
    -SIZE_FLOOR / 2,
    SIZE_FLOOR / 2
  );
  modelCat.position.z = THREE.MathUtils.clamp(
    modelCat.position.z,
    -SIZE_FLOOR / 2,
    SIZE_FLOOR / 2
  );

  // Обновляем микшер анимаций
  mixer.update(delta);
}

function animate(time) {
  const delta = clock.getDelta();

  handleMovement(delta);
  updateCamera();

  renderer.render(scene, camera);
  stats.update();
}

function addFloor() {
  let size = 50;
  let repeat = 32;

  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const floorT = new THREE.TextureLoader().load("textures/floor.jpg");
  floorT.colorSpace = THREE.SRGBColorSpace;
  floorT.repeat.set(repeat, repeat);
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  floorT.anisotropy = maxAnisotropy;

  let mat = new THREE.MeshStandardMaterial({
    map: floorT,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0xffffff,
    depthWrite: false,
    roughness: 0.85,
  });

  let g = new THREE.PlaneGeometry(size * 10, size * 10, 50, 50);
  g.rotateX(-Math.PI / 2);

  const floor = new THREE.Mesh(g, mat);
  floor.receiveShadow = true;
  scene.add(floor);
}

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
