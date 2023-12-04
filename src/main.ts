import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PlayerControls } from './playerControls';

// RENDERER
const canvas = document.querySelector( '#c' );
const rendererParameters = {
    canvas,
    antialias: false
};
const renderer = new THREE.WebGLRenderer(rendererParameters);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color("rgb(101, 130, 153)");

// CAMERA
const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
camera.position.y = 2;
camera.position.z = 5;
camera.position.x = 0;

// CAMERA ORBIT CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.minDistance = 3;
orbitControls.maxDistance = 15;
orbitControls.enablePan = false;
orbitControls.maxPolarAngle = 90 * Math.PI / 180;
orbitControls.update();

// CONTROL KEYS
const keysPressed = {};
document.addEventListener('keydown', (event) => {
    (keysPressed as any)[event.code] = true;
});
document.addEventListener('keyup', (event) => {
    (keysPressed as any)[event.code] = false;
});

// WINDOW
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// LIGHTS
addLight(scene);

// SKY
addSky(scene);

// FLOOR
addFloor(scene);

function addLight(scene: THREE.Scene) {
    const ambLight = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(-50, 100, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = - 50;
    dirLight.shadow.camera.left = - 50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    scene.add(dirLight);
}

function addSky(scene: THREE.Scene) {
    const loader = new THREE.CubeTextureLoader();
    loader.setPath('./public/textures/');
    const textureCube = loader.load([
        'stars.jpg', 'stars.jpg',
        'stars.jpg', 'stars.jpg',
        'stars.jpg', 'stars.jpg'
    ]);
    scene.background = textureCube;
}

function addFloor(scene: THREE.Scene) {
    const width = 100;
    const height = 100;
    const geometry = new THREE.PlaneGeometry(width, height, 512, 512);
    const material = new THREE.MeshBasicMaterial({
        color: 0xe8ebff,
        side: THREE.FrontSide
    });
    const floor = new THREE.Mesh(geometry, material);
    floor.receiveShadow = true
    floor.rotation.x = -Math.PI / 2
    scene.add(floor);
}











// MODEL WITH ANIMATIONS
let playerControls: PlayerControls
const loader = new GLTFLoader();
loader.load('./public/models/Soldier.glb', function (gltf) {
    const model = gltf.scene;
    model.traverse(function (object: any) {
        if (object.isMesh) object.castShadow = true;
    });
    scene.add(model);

    const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
    const mixer = new THREE.AnimationMixer(model);
    const animationsMap: Map<string, THREE.AnimationAction> = new Map()
    gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
        animationsMap.set(a.name, mixer.clipAction(a))
    })

    playerControls = new PlayerControls(model, mixer, animationsMap, orbitControls, camera,  'Idle');
});




// ANIMATE
const clock = new THREE.Clock();
function animate() {
    let mixerUpdateDelta = clock.getDelta();
    if (playerControls) {
        playerControls.update(mixerUpdateDelta, keysPressed);
    }
    orbitControls.update()
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

