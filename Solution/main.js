"use strict"

import * as THREE from "../Libraries/three.js-master/build/three.module.js";
import { PointerLockControls } from '../Libraries/three.js-master/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from '../Libraries/three.js-master/examples/jsm/loaders/GLTFLoader.js';

const THRUST = 40;
const TURNRATE = 1;
const FOV = 75;

let camera, topCamera, weaponCamera;
let renderer, scene, controls, manager;

let inGame = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let acceleration = new THREE.Vector3();
let ship;
let velocityArrow;
let weaponView = false;
let enemies = [];

let accelerate, turnLeft, turnRight = false;
let canShoot = true;

function main() {
	// Setting up the renderer
	let canvas = document.getElementById("gl-canvas");

	renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);

	// Add event listeners
	window.addEventListener('resize', onWindowResize);
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener('keyup', onKeyUp);
	document.addEventListener('mousedown', shoot);
	document.addEventListener('mouseup', onMouseUp);

	// Set up loading manager
	manager = new THREE.LoadingManager();
	manager.onLoad = function() {
		inGame = true;
	};

	// Set up the scene
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0, 0, 0);
	init(scene);

	animate();
}

function onKeyDown(event) {
	switch(event.code) {
		
		case 'ArrowUp':
		case 'KeyW':
			accelerate = true;
			break;

		case 'ArrowLeft':
		case 'KeyA':
			turnLeft = true;
			break;

		case 'ArrowRight':
		case 'KeyD':
			turnRight = true;
			break;
	}
}

function onKeyUp(event) {
	switch(event.code) {
		
		case 'ArrowUp':
		case 'KeyW':
			accelerate = false;
			break;

		case 'ArrowLeft':
		case 'KeyA':
			turnLeft = false;
			break;

		case 'ArrowRight':
		case 'KeyD':
			turnRight = false;
			break;

		case 'Space':
			switchView();
			break;
	}
}

function onMouseDown() {
	shoot = true;
}

function onMouseUp() {
	shoot = false;
	canShoot = true;
}

function init(scene) {
	// Setup camera
	// camera = new THREE.OrthographicCamera(
		// window.innerWidth / -2,
		// window.innerWidth / 2,
		// window.innerHeight / 2,
		// window.innerHeight / -2,
		// 0.1,
		// 1000
	// );
	
	topCamera = new THREE.PerspectiveCamera(FOV, window.innerWidth/window.innerHeight,0.1,1000)
	topCamera.position.y = 200;
	topCamera.lookAt(0, 0, 0);
	topCamera.layers.enable(1);

	weaponCamera = new THREE.PerspectiveCamera(FOV, window.innerWidth/window.innerHeight,0.1,1000)
	weaponCamera.position.y = 3.5;

	camera = topCamera;

	controls = new PointerLockControls( weaponCamera, renderer.domElement );
	controls.constrainVertical = true;
	controls.lookSpeed = 0.5;
	controls.maxPolarAngle = 2.0;
	renderer.domElement.addEventListener('click', function() {
		controls.lock();
	});

	// Light sources
	let ambientLight = new THREE.AmbientLight(0xDDDDFF, 0.2);
	scene.add(ambientLight);
	let pointLight = new THREE.PointLight(0xFFBBBB, 10, 0);
	pointLight.position.set(0,15,0);
	scene.add(pointLight);

	// Objects
	const crosshairTexture = new THREE.TextureLoader(manager).load( '../Assets/crosshair.png' );
	const crosshairMaterial = new THREE.SpriteMaterial( { map: crosshairTexture } );
	const crosshair = new THREE.Sprite(crosshairMaterial);
	crosshair.scale.set(0.1, 0.1, 0.1);
	crosshair.translateZ(-1);
	weaponCamera.add(crosshair);
	// Cameras don't usually have to be added to the scene, but since it has a child it must be
	scene.add(weaponCamera);

	const loader = new GLTFLoader(manager).setPath('../Assets/models/');
	loader.load('ship.glb', function (gltf) {
		ship = gltf.scene;
		scene.add(ship);
	});
	velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 100, 0xbbffbb);
	velocityArrow.traverse(function(node) {
		// set the arrow and it's children to layer 1
		node.layers.set(1);
	});
	scene.add(velocityArrow);
	// let shipGeometry = new THREE.BoxGeometry(10, 10, 35);
	// let shipMaterial = new THREE.MeshStandardMaterial({
		// color: 0xFFFFFF
	// });
	// ship = new THREE.Mesh(shipGeometry, shipMaterial);
	// scene.add(ship);

	loadLevel1();
}

function loadLevel1() {
	// Create skybox
	let skyboxTextures = [
		'../Assets/skyboxes/blue/bkg1_right.png',
		'../Assets/skyboxes/blue/bkg1_left.png',
		'../Assets/skyboxes/blue/bkg1_top.png',
		'../Assets/skyboxes/blue/bkg1_bot.png',
		'../Assets/skyboxes/blue/bkg1_front.png',
		'../Assets/skyboxes/blue/bkg1_back.png'
	];

	let cubeLoader = new THREE.CubeTextureLoader(manager);
	scene.background = cubeLoader.load(skyboxTextures);
	for (let i = 0; i < 10; i++) {
		let shipGeometry = new THREE.BoxGeometry(10, 10, 35);
		let shipMaterial = new THREE.MeshStandardMaterial({
			color: 0xFFFFFF
		});
		let enemy = new THREE.Mesh(shipGeometry, shipMaterial);
		enemy.position.set(i*10, 20, i*10);
		enemies.push(enemy);
		scene.add(enemy);
	}
}

function onWindowResize() {
	// Update aspect ratio
	let aspect = window.innerWidth / window.innerHeight;
	topCamera.aspect = aspect;
	weaponCamera.aspect = aspect;
	topCamera.updateProjectionMatrix();
	weaponCamera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function switchView() {
	// switch active camera
	if (weaponView) {
		weaponView = false;
		camera = topCamera;
	} else {
		weaponView = true;
		camera = weaponCamera;
	}
}

function shoot() {
	console.log('shoot');
	// We want to cast a ray in the direction the camera is facing
	let direction = new THREE.Vector3();
	camera.getWorldDirection(direction);
	// convert from normalised viewing coordinates to world coordinates
	// direction.unproject(weaponCamera); 
	console.log(direction);
	const arrowHelper = new THREE.ArrowHelper(direction, camera.position, 100, 0xff0000);
	scene.add(arrowHelper);
	const raycaster = new THREE.Raycaster(camera.position, direction.normalize());
	let collisions = raycaster.intersectObjects(enemies, false);
	console.log(collisions);
	for (const c of collisions) {
		c.object.material.color.r = 0;
		console.log('collided with ' + c);
	}
}

function render() {
	renderer.render(scene, camera);
}

function animate() {
	requestAnimationFrame(animate);

	acceleration.set(0.0, 0.0, 0.0);

	// Figure out how much time has passed since last frame
	const time = performance.now();
	const delta = (time - prevTime) / 1000;
	prevTime = time;

	if (inGame) {
		if (turnLeft) {
			ship.rotateY(0.01 * TURNRATE);
		}
		if (turnRight) {
			ship.rotateY(-0.01 * TURNRATE);
		}
		if (accelerate) {
			// Get the direction of the ship and accelerate in that direction
			let matrix = new THREE.Matrix4();
			matrix.extractRotation(ship.matrix);
			let direction = new THREE.Vector3(1, 0, 0);
			acceleration = direction.applyMatrix4(matrix).multiplyScalar(THRUST);
		}

		// update ship velocity
		velocity.x += acceleration.x * delta;
		velocity.z += acceleration.z * delta;

		// update ship position
		ship.position.x += velocity.x * delta;
		ship.position.z += velocity.z * delta;
		// update camera positions
		weaponCamera.position.x += velocity.x * delta;
		weaponCamera.position.z += velocity.z * delta;
		topCamera.position.x += velocity.x * delta;
		topCamera.position.z += velocity.z * delta;

		// update velocity arrow
		velocityArrow.setDirection(velocity);
		velocityArrow.setLength(velocity.length(), 5, 2);
		velocityArrow.position.x += velocity.x * delta;
		velocityArrow.position.z += velocity.z * delta;
	}

	render();
}

main();
