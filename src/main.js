import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import Stats from "stats.js";

let renderer, pointerLockControls, actions, group, model, mixer, shadowHelper;

const instructionsHTML = createInstructionsHTML();

const scene = new THREE.Scene();
const clock = new THREE.Clock();
const stats = new Stats();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false,
};

const floorSize = 256;
const floorSizeHalf = floorSize / 2;

let currentAction = "";

const playerVelocity = new THREE.Vector3();
const walkSpeed = 0.2;
const runSpeed = 0.3;
const rotSpeed = 0.3;
const jumpForce = 0.3;
const gravity = 2;

let cameraAngleX = Math.PI;
let cameraAngleY = Math.PI / 4;
let currentCameraDistance = 10;
let targetCameraDistance = 10;

let playerOnFloor = true;
let canJump = true;

init();

function init() {
  const containerHTML = document.getElementById("container");

  scene.background = new THREE.Color(0x333333);

  group = new THREE.Group();
  scene.add(group);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(1, 25, 3);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.right = floorSizeHalf;
  directionalLight.shadow.camera.left = -floorSizeHalf;
  directionalLight.shadow.camera.top = floorSizeHalf;
  directionalLight.shadow.camera.bottom = -floorSizeHalf;
  directionalLight.shadow.mapSize.width = 2048 * 1;
  directionalLight.shadow.mapSize.height = 2048 * 1;
  directionalLight.shadow.bias = -0.001;
  scene.add(directionalLight);

  shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  shadowHelper.visible = false; // Отключаем по умолчанию
  scene.add(shadowHelper);

  stats.showPanel(0);
  containerHTML.appendChild(stats.domElement);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  containerHTML.appendChild(renderer.domElement);

  pointerLockControls = new PointerLockControls(camera, renderer.domElement);

  // EVENTS
  window.addEventListener("resize", onWindowResize);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("click", onClick);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("wheel", onWheel);

  addModel();
  addFloor();
}

function addFloor() {
  let repeat = floorSize / 8;

  const floorT = new THREE.TextureLoader().load("textures/floor.jpg");
  floorT.colorSpace = THREE.SRGBColorSpace;
  floorT.repeat.set(repeat, repeat);
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  floorT.anisotropy = renderer.capabilities.getMaxAnisotropy();

  let mat = new THREE.MeshStandardMaterial({
    map: floorT,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0xffffff,
    depthWrite: false,
    roughness: 0.85,
  });

  let g = new THREE.PlaneGeometry(floorSize, floorSize, 100, 100);
  g.rotateX(-Math.PI / 2);

  const floor = new THREE.Mesh(g, mat);
  floor.receiveShadow = true;
  floor.position.y = -0.1;
  scene.add(floor);

  return floor;
}

function addModel() {
  const loader = new GLTFLoader();
  loader.load("/models/cat.glb", (gltf) => {
    model = gltf.scene;
    group.add(model);
    model.position.y = 0;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const animations = gltf.animations;
    mixer = new THREE.AnimationMixer(model);

    const clipIdle = THREE.AnimationClip.findByName(animations, "idle");
    const clipWalk = THREE.AnimationClip.findByName(animations, "walk");
    const clipRun = THREE.AnimationClip.findByName(animations, "run");
    const clipJump = THREE.AnimationClip.findByName(animations, "jump");

    actions = {
      idle: mixer.clipAction(clipIdle),
      walk: mixer.clipAction(clipWalk),
      run: mixer.clipAction(clipRun),
      jump: mixer.clipAction(clipJump),
    };

    for (let a in actions) {
      actions[a].enabled = true;
      actions[a].setEffectiveTimeScale(1);

      if (a == "run") {
        actions[a].setEffectiveTimeScale(1.5);
      } else if (a == "walk") {
        actions[a].setEffectiveTimeScale(1.2);
      } else if (a == "jump") {
        actions[a].setEffectiveTimeScale(1.5);
      }
    }

    actions.idle.play();
  });
}

function updatePlayer(delta) {
  if (!playerOnFloor) {
    playerVelocity.y -= gravity * delta;
  }

  if (!model || !mixer) return;

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

  const playerDirection = new THREE.Vector3();

  if (keys.KeyW) playerDirection.sub(forward);
  if (keys.KeyS) playerDirection.add(forward);
  if (keys.KeyA) playerDirection.sub(right);
  if (keys.KeyD) playerDirection.add(right);

  if (playerDirection.length() > 0 && playerOnFloor) {
    const isRunning = keys.ShiftLeft;
    setAction(isRunning ? "run" : "walk");
  } else if (playerOnFloor == false) {
    setAction("jump");
  } else {
    setAction("idle");
  }

  const speedMultiplier = keys.ShiftLeft ? runSpeed / walkSpeed : 1;

  if (playerDirection.length() > 0) {
    playerDirection.normalize();
    let targetRotation = Math.atan2(playerDirection.x, playerDirection.z);

    let angleDifference = targetRotation - model.rotation.y;
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

    model.rotation.y += angleDifference * rotSpeed;

    playerVelocity.x = playerDirection.x * walkSpeed * speedMultiplier;
    playerVelocity.z = playerDirection.z * walkSpeed * speedMultiplier;
  } else {
    playerVelocity.x = 0;
    playerVelocity.z = 0;
  }

  // Проверка нахождения на земле с учетом позиции пола
  if (model.position.y <= 0) {
    model.position.y = 0;
    playerVelocity.y = 0;
    playerOnFloor = true;
  } else {
    playerOnFloor = false;
  }

  if (!canJump) {
    playerVelocity.y = 5 * 2 * delta;
  }

  // Применяем движение
  const newPosition = model.position.clone().add(playerVelocity);

  model.position.copy(newPosition);

  mixer.update(delta);
}

function updateCamera() {
  currentCameraDistance = THREE.MathUtils.lerp(
    currentCameraDistance,
    targetCameraDistance,
    0.1
  );

  if (!model) return;
  const x =
    model.position.x +
    currentCameraDistance * Math.sin(cameraAngleX) * Math.cos(cameraAngleY);
  const y =
    model.position.y + 1 + currentCameraDistance * Math.sin(cameraAngleY);
  const z =
    model.position.z +
    currentCameraDistance * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);

  camera.position.set(x, y, z);
  camera.lookAt(model.position.x, model.position.y + 4, model.position.z);
}

function setAction(actionName) {
  if (currentAction === actionName || !actions[actionName]) return;

  if (currentAction) {
    actions[currentAction].fadeOut(0.2);
  }

  actions[actionName].reset().fadeIn(0.2).play();
  currentAction = actionName;
}

function onKeyDown(event) {
  if (event.code in keys) keys[event.code] = true;

  if (event.code === "Space" && playerOnFloor && canJump) {
    playerVelocity.y = jumpForce;
    playerOnFloor = false;
    canJump = false;
    setAction("jump");

    setTimeout(() => {
      canJump = true;
    }, 500);
  }

  if (event.code === "KeyH") {
    shadowHelper.visible = !shadowHelper.visible;
  }
}

function onKeyUp(event) {
  if (event.code in keys) keys[event.code] = false;

  if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
    const anyMovementKeyPressed =
      keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;

    if (!anyMovementKeyPressed) {
      console.log(playerVelocity);
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerLockChange() {
  if (document.pointerLockElement === renderer.domElement) {
    pointerLockControls.enabled = true;
    instructionsHTML.style.display = "none";
  } else {
    pointerLockControls.enabled = false;
    instructionsHTML.style.display = "block";
  }
}

function onClick() {
  renderer.domElement.requestPointerLock();
}

function onMouseMove(event) {
  if (!pointerLockControls.enabled) return;

  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;

  cameraAngleX -= movementX * 0.004;
  cameraAngleY = THREE.MathUtils.clamp(
    cameraAngleY + movementY * 0.004,
    0.1,
    Math.PI / 2 - 0.1
  );
}

function onWheel(event) {
  targetCameraDistance = THREE.MathUtils.clamp(
    targetCameraDistance - event.deltaY * 0.01,
    5,
    20
  );
}

function createInstructionsHTML() {
  const instructionsHTML = document.createElement("div");
  instructionsHTML.id = "instructions";
  instructionsHTML.innerHTML = `
      <h1>Кликните для начала игры</h1>
      <h3>Управление</h3>
      <p>WASD - движение</p>
      <p>SPACE - прыжок</p>
      <p>SHIFT - ускорение</p>
      <p>ESC - выход</p>
  `;
  document.body.appendChild(instructionsHTML);
  return instructionsHTML;
}

function animate() {
  const delta = clock.getDelta();
  updatePlayer(delta);
  updateCamera();

  renderer.render(scene, camera);
  stats.update();
}
