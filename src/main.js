import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ================================
// RENDERER SETUP
// ================================
const canvas = document.querySelector("#c");
const rendererParameters = {
  canvas,
  antialias: false, // Отключаем сглаживание для повышения производительности
};
const renderer = new THREE.WebGLRenderer(rendererParameters);
renderer.setSize(window.innerWidth, window.innerHeight); // Устанавливаем размеры рендера
renderer.setPixelRatio(window.devicePixelRatio); // Настройка плотности пикселей
renderer.shadowMap.enabled = true; // Включаем тени
document.body.append(renderer.domElement); // Добавляем элемент рендера в DOM

// ================================
// SCENE AND CAMERA SETUP
// ================================
const scene = new THREE.Scene(); // Создаем сцену
scene.background = new THREE.Color("rgb(101, 130, 153)"); // Устанавливаем фоновый цвет

// Настройка камеры
const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000); // Угол обзора, соотношение сторон, ближняя и дальняя плоскости отсечения
camera.position.set(0, 2, 5); // Начальная позиция камеры (x, y, z)

// ================================
// ORBIT CONTROLS
// ================================
const orbitControls = new OrbitControls(camera, renderer.domElement); // Добавляем управление орбитой
orbitControls.enableDamping = true; // Включаем затухание для плавного движения
orbitControls.minDistance = 3; // Минимальное расстояние до объекта
orbitControls.maxDistance = 15; // Максимальное расстояние до объекта
orbitControls.enablePan = false; // Отключаем возможность перемещения камеры по экрану
orbitControls.maxPolarAngle = (90 * Math.PI) / 180; // Ограничиваем угол наклона камеры
orbitControls.update(); // Обновляем контроллер

// ================================
// KEYBOARD INPUT HANDLING
// ================================
const keysPressed = {}; // Храним состояние нажатых клавиш
document.addEventListener("keydown", (event) => {
  keysPressed[event.code] = true; // При нажатии клавиши добавляем её в объект
});
document.addEventListener("keyup", (event) => {
  keysPressed[event.code] = false; // При отпускании клавиши удаляем её из объекта
});

// ================================
// WINDOW RESIZE HANDLING
// ================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight; // Обновляем соотношение сторон камеры
  camera.updateProjectionMatrix(); // Обновляем матрицу проекции
  renderer.setSize(window.innerWidth, window.innerHeight); // Обновляем размеры рендера
});

// ================================
// LIGHTS AND ENVIRONMENT
// ================================
addLight(scene); // Добавляем источники света
addSky(scene); // Добавляем текстуру неба
addGridFloor(scene); // Добавляем разлинованный пол

// Функция для добавления источников света
function addLight(scene) {
  const ambLight = new THREE.DirectionalLight(0xffffff, 1); // Базовое освещение
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1); // Направленный источник света
  dirLight.position.set(-50, 100, 10); // Позиция источника света
  dirLight.castShadow = true; // Включаем тени
  dirLight.shadow.camera.top = 50; // Настройка камеры теней
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.mapSize.width = 4096; // Разрешение карты теней
  dirLight.shadow.mapSize.height = 4096;
  scene.add(dirLight);
}

// Функция для добавления текстуры неба
function addSky(scene) {
  const loader = new THREE.CubeTextureLoader();
  loader.setPath("./public/textures/"); // Путь к текстурам
  const textureCube = loader.load([
    "stars.jpg",
    "stars.jpg",
    "stars.jpg",
    "stars.jpg",
    "stars.jpg",
    "stars.jpg",
  ]);
  scene.background = textureCube; // Устанавливаем текстуру неба
}

// Функция для добавления разлинованного пола
function addGridFloor(scene) {
  const gridSize = 100; // Размер плоскости (в единицах)
  const cellSize = 5; // Размер одной клетки
  const divisions = gridSize / cellSize; // Количество клеток

  // Создаем текстуру для клетчатого пола
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  // Рисуем фон
  context.fillStyle = "#ffffff"; // Белый фон
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Рисуем сетку
  const cellWidth = canvas.width / divisions;
  const cellHeight = canvas.height / divisions;
  context.strokeStyle = "#000000"; // Черные линии
  context.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += cellWidth) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  for (let y = 0; y <= canvas.height; y += cellHeight) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  // Создаем материал с текстурой
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide, // Текстура видна с обеих сторон
  });

  // Создаем геометрию и добавляем пол
  const geometry = new THREE.PlaneGeometry(gridSize, gridSize);
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2; // Поворачиваем плоскость горизонтально
  floor.receiveShadow = true; // Пол принимает тени
  scene.add(floor);
}

// ================================
// PLAYER CONTROLS FUNCTIONS
// ================================
const W = "KeyW";
const A = "KeyA";
const S = "KeyS";
const D = "KeyD";
const SHIFT = "ShiftLeft";
const DIRECTIONS = [W, A, S, D];

// Состояние игрока
let playerState = {
  model: null, // 3D-модель персонажа
  mixer: null, // Микшер анимаций
  animationsMap: new Map(), // Карта анимаций
  orbitControl: orbitControls, // Управление камерой
  camera: camera, // Камера
  toggleRun: true, // Переключатель бега
  currentAction: "idle", // Текущая анимация
  walkDirection: new THREE.Vector3(), // Направление ходьбы
  rotateAngle: new THREE.Vector3(0, 1, 0), // Ось вращения
  rotateQuaternion: new THREE.Quaternion(), // Кватернион для вращения
  cameraTarget: new THREE.Vector3(), // Цель камеры
  fadeDuration: 0.2, // Длительность перехода между анимациями
  runVelocity: 5, // Скорость бега
  walkVelocity: 2, // Скорость ходьбы
};

// Инициализация управления персонажем
function initPlayerControls(model, mixer, animationsMap, currentAction) {
  playerState.model = model;
  playerState.mixer = mixer;
  playerState.animationsMap = animationsMap;
  playerState.currentAction = currentAction;

  // Запускаем начальную анимацию
  const initialAnimation = animationsMap.get(currentAction);
  if (initialAnimation) {
    initialAnimation.play();
  }

  // Инициализируем цель камеры
  updateCameraTarget(0, 0);
}

// Обновление состояния игрока
function updatePlayer(delta, keysPressed) {
  const directionPressed = DIRECTIONS.some((key) => keysPressed[key] === true);

  let play = "";
  if (directionPressed && keysPressed[SHIFT]) {
    play = "run"; // Если нажата клавиша Shift, то бежим
  } else if (directionPressed) {
    play = "walk"; // Иначе ходим
  } else {
    play = "idle"; // Если ничего не нажато, стоим
  }

  // Переход между анимациями
  if (playerState.currentAction !== play) {
    const toPlay = playerState.animationsMap.get(play);
    const current = playerState.animationsMap.get(playerState.currentAction);

    if (current && toPlay) {
      current.fadeOut(playerState.fadeDuration); // Плавно выключаем текущую анимацию
      toPlay.reset().fadeIn(playerState.fadeDuration).play(); // Плавно включаем новую анимацию
      playerState.currentAction = play; // Обновляем текущую анимацию
    }
  }

  // Обновляем микшер анимаций
  if (playerState.mixer) {
    playerState.mixer.update(delta);
  }

  // Логика движения
  if (play === "run" || play === "walk") {
    const angleYCameraDirection = Math.atan2(
      playerState.camera.position.x - playerState.model.position.x,
      playerState.camera.position.z - playerState.model.position.z
    );
    const directionOffset = calculateDirectionOffset(keysPressed);

    playerState.rotateQuaternion.setFromAxisAngle(
      playerState.rotateAngle,
      angleYCameraDirection + directionOffset
    );
    playerState.model.quaternion.rotateTowards(playerState.rotateQuaternion, 0.2);

    playerState.camera.getWorldDirection(playerState.walkDirection);
    playerState.walkDirection.y = 0;
    playerState.walkDirection.normalize();
    playerState.walkDirection.applyAxisAngle(playerState.rotateAngle, directionOffset);

    const velocity = play === "run" ? playerState.runVelocity : playerState.walkVelocity;

    const moveX = playerState.walkDirection.x * velocity * delta;
    const moveZ = playerState.walkDirection.z * velocity * delta;
    playerState.model.position.x += moveX;
    playerState.model.position.z += moveZ;

    updateCameraTarget(moveX, moveZ);
  }
}

// Обновление цели камеры
function updateCameraTarget(moveX, moveZ) {
  if (!playerState.cameraTarget) {
    console.error("cameraTarget is not initialized!");
    return;
  }

  playerState.camera.position.x += moveX;
  playerState.camera.position.z += moveZ;

  playerState.cameraTarget.x = playerState.model.position.x;
  playerState.cameraTarget.y = playerState.model.position.y + 1;
  playerState.cameraTarget.z = playerState.model.position.z;
  playerState.orbitControl.target = playerState.cameraTarget;
}

// Расчет направления движения
function calculateDirectionOffset(keysPressed) {
  let directionOffset = 0; // По умолчанию движемся вперед

  if (keysPressed[W]) {
    if (keysPressed[A]) {
      directionOffset = Math.PI / 4; // w+a (вперед-влево)
    } else if (keysPressed[D]) {
      directionOffset = -Math.PI / 4; // w+d (вперед-вправо)
    }
  } else if (keysPressed[S]) {
    if (keysPressed[A]) {
      directionOffset = Math.PI / 4 + Math.PI / 2; // s+a (назад-влево)
    } else if (keysPressed[D]) {
      directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d (назад-вправо)
    } else {
      directionOffset = Math.PI; // s (назад)
    }
  } else if (keysPressed[A]) {
    directionOffset = Math.PI / 2; // a (влево)
  } else if (keysPressed[D]) {
    directionOffset = -Math.PI / 2; // d (вправо)
  }

  return directionOffset;
}

// ================================
// LOAD MODEL AND ANIMATIONS
// ================================
const loader = new GLTFLoader();
loader.load("./public/models/cat.glb", function (gltf) {
  const model = gltf.scene;
  model.traverse(function (object) {
    if (object.isMesh) object.castShadow = true; // Включаем тени для модели
  });
  scene.add(model);

  const gltfAnimations = gltf.animations;
  const mixer = new THREE.AnimationMixer(model);
  const animationsMap = new Map();
  gltfAnimations.forEach((a) => {
    animationsMap.set(a.name, mixer.clipAction(a)); // Добавляем анимации в карту
  });

  model.scale.multiplyScalar(0.1); // Масштабируем модель
  initPlayerControls(model, mixer, animationsMap, "idle"); // Инициализируем управление персонажем
});

// ================================
// ANIMATION LOOP
// ================================
const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta(); // Получаем время с последнего кадра
  updatePlayer(delta, keysPressed); // Обновляем состояние игрока
  orbitControls.update(); // Обновляем управление камерой
  renderer.render(scene, camera); // Рендерим сцену
  requestAnimationFrame(animate); // Запрашиваем следующий кадр
}
animate();