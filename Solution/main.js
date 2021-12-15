"use strict"

import * as THREE from "../Libraries/three.js-master/build/three.module.js";
import { PointerLockControls } from '../Libraries/three.js-master/examples/jsm/controls/PointerLockControls.js';

const THRUST = 100;
const TURNRATE = 1;
const FOV = 75;

let camera, topCamera, weaponCamera;
let renderer, scene, controls;

let inGame = true;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let acceleration = new THREE.Vector3();
let ship;
let weaponView = false;

let accelerate, turnLeft, turnRight = false;

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
	topCamera.position.y = 1000;
	topCamera.lookAt(0, 0, 0);

	weaponCamera = new THREE.PerspectiveCamera(FOV, window.innerWidth/window.innerHeight,0.1,1000)
	weaponCamera.position.y = 11;

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
	let shipGeometry = new THREE.BoxGeometry(10, 10, 35);
	let shipMaterial = new THREE.MeshStandardMaterial({
		color: 0xFFFFFF
	});
	ship = new THREE.Mesh(shipGeometry, shipMaterial);
	scene.add(ship);

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

	let cubeLoader = new THREE.CubeTextureLoader();
	scene.background = cubeLoader.load(skyboxTextures);
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
			let direction = new THREE.Vector3(0, 0, -1);
			acceleration = direction.applyMatrix4(matrix).multiplyScalar(THRUST);
			console.log(acceleration);
		}

		// update ship velocity
		velocity.x += acceleration.x * delta;
		velocity.z += acceleration.z * delta;

		// update ship position
		ship.position.x += velocity.x * delta;
		ship.position.z += velocity.z * delta;
		// update camera position
		weaponCamera.position.x += velocity.x * delta;
		weaponCamera.position.z += velocity.z * delta;
	}

	render();
}

main();
