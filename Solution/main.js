"use strict"

import * as THREE from "../Libraries/three.js-master/build/three.module.js";
import { PointerLockControls } from '../Libraries/three.js-master/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from '../Libraries/three.js-master/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from '../Libraries/three.js-master/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../Libraries/three.js-master/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../Libraries/three.js-master/examples/jsm/postprocessing/UnrealBloomPass.js';

const THRUST = 40;
const TURNRATE = 1.5;
const FOV = 75;

let camera, topCamera, weaponCamera;
let composer, topCameraComposer, weaponCameraComposer;
let renderer, scene, controls, manager;

let inGame = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let acceleration = new THREE.Vector3();
let ship, turret, boundingBox;
let health = 10;
let velocityArrow;
let weaponView = false;
let enemies = [];
let projectiles = [];

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
	controls.maxPolarAngle = 1.8;
	renderer.domElement.addEventListener('click', function() {
		controls.lock();
	});

	// Set up bloom post processing
	// borrowed from https://github.com/mrdoob/three.js/blob/master/examples/webgl_postprocessing_unreal_bloom.html
	const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
	bloomPass.threshold = 0.9;
	bloomPass.strength = 0.5;
	bloomPass.radius = 0.3;
	topCameraComposer = new EffectComposer( renderer );
	topCameraComposer.addPass( new RenderPass( scene, topCamera ) );
	topCameraComposer.addPass( bloomPass );
	weaponCameraComposer = new EffectComposer( renderer );
	weaponCameraComposer.addPass( new RenderPass( scene, weaponCamera ) );
	weaponCameraComposer.addPass( bloomPass );

	composer = topCameraComposer;

	// Light sources
	let ambientLight = new THREE.AmbientLight(0xDDDDFF, 0.4);
	scene.add(ambientLight);
	// let pointLight = new THREE.PointLight(0xFFBBBB, 10, 0);
	// pointLight.position.set(0,15,0);
	// scene.add(pointLight);
	let areaLight = new THREE.RectAreaLight(0xDDDDFF, 5, 50, 50);
	areaLight.position.set(0,15,0);
	// scene.add(areaLight);

	// HDRI environment mapping
	// new RGBELoader().setPath('../Assets/hdri/').load('Milkyway_small.hdr', function (texture) {
		// texture.mapping = THREE.EquirectangularReflectionMapping;
		// scene.background = texture;
		// scene.environment = texture;
	// });

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
	loader.load('ship_8.gltf', function (gltf) {
		ship = gltf.scene;
		scene.add(ship);
		// Bounding box for the player ship. Invisible rect used for collision detection
		const transparent = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 });
		const colliderGeometry = new THREE.BoxGeometry(20, 4, 8);
		boundingBox = new THREE.Mesh(colliderGeometry, transparent);
		boundingBox.translateX(2);
		ship.add(boundingBox);
		boundingBox.updateMatrixWorld();
		console.log(boundingBox);
	});
	loader.load('turret.gltf', function (gltf) {
		turret = gltf.scene;
		turret.translateZ(-3);
		turret.translateY(-1);
		weaponCamera.add(turret);
	});
	// Arrow showing the velocity vector of the player
	velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,4,0), 100, 0xbbffbb);
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
	let cubeTexture = cubeLoader.load(skyboxTextures);
	scene.background = cubeTexture;
	scene.environment = cubeTexture;

	// Create Stars
	let starGeometry = new THREE.SphereGeometry(100, 50, 50);
	const textureLoader = new THREE.TextureLoader();
	let starMaterial = new THREE.MeshBasicMaterial({ map: textureLoader.load('../Assets/sun.jpg') });
	// let starMaterial = new THREE.MeshBasicMaterial();
	let star1 = new THREE.Mesh(starGeometry, starMaterial);
	star1.position.set(0, -120, 0);
	star1.rotateX(1.55);
	scene.add(star1);
	let star2 = new THREE.Mesh(starGeometry, starMaterial);
	star2.position.set(-100, 320, 120);
	star2.rotateX(-1.55);
	scene.add(star2);
	// add strong point light for stars
	let star1Light = new THREE.PointLight(0xFFBBBB, 2, 0, 2);
	star1Light.position.set(0,-120,0);
	scene.add(star1Light);
	let star2Light = new THREE.PointLight(0xFFBBBB, 2, 0, 2);
	star2Light.position.set(-100,120,120);
	scene.add(star2Light);

	// Create enemy ships
	for (let i = 0; i < 10; i++) {
		let shipGeometry = new THREE.BoxGeometry(10, 10, 35);
		let shipMaterial = new THREE.MeshStandardMaterial({
			color: 0xFFFFFF
		});
		let enemy = new THREE.Mesh(shipGeometry, shipMaterial);
		enemy.userData = {
			health: 5,
			shootCooldown: Math.random() * 10 + 8,
		};
		enemy.position.set(
			Math.random() * 600 - 300,
			Math.random() * 10 + 20,
			Math.random() * 600 - 300
		);
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
		composer = topCameraComposer;
	} else {
		weaponView = true;
		camera = weaponCamera;
		composer = weaponCameraComposer;
	}
}

function shoot() {
	// We want to cast a ray in the direction the camera is facing
	let direction = new THREE.Vector3();
	camera.getWorldDirection(direction);
	// convert from normalised viewing coordinates to world coordinates
	// direction.unproject(weaponCamera); 
	const arrowHelper = new THREE.ArrowHelper(direction, camera.position, 100, 0xff0000);
	scene.add(arrowHelper);
	const raycaster = new THREE.Raycaster(camera.position, direction.normalize());
	let collisions = raycaster.intersectObjects(enemies, false);
	for (const c of collisions) {
		c.object.material.color.r = 0;
		c.object.userData.health -= 1;
		console.log('collided with ' + c);
		console.log('health now ' + c.object.userData.health);
	}
}

function render() {
	composer.render();
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
		velocityArrow.setLength(Math.max(velocity.length(), 6), 5, 2);
		velocityArrow.position.x += velocity.x * delta;
		velocityArrow.position.z += velocity.z * delta;

		// update enemy ships 
		for (const e of enemies) {
			// look at player
			e.lookAt(ship.position);
			// if enough time has passed: shoot
			e.userData.shootCooldown -= delta;
			if (e.userData.shootCooldown <= 0) {
				// reset cooldown
				e.userData.shootCooldown += 8;
				// create projectile
				let material = new THREE.MeshStandardMaterial();
				let geometry = new THREE.BoxGeometry(1, 1, 1);
				let mesh = new THREE.Mesh(geometry, material);
				mesh.position.set(
					e.position.x,
					e.position.y,
					e.position.z
				);
				// get the direction vector of the enemy ship
				let matrix = new THREE.Matrix4();
				matrix.extractRotation(e.matrix);
				let direction = new THREE.Vector3(0, 0, 1);
				direction = direction.applyMatrix4(matrix).multiplyScalar(10);
				// add projectile to scene
				projectiles.push({
					object: mesh,
					velocity: direction,
					timeSinceCreation: 0.0,
				});
				scene.add(mesh);
			}
		}

		// update projectiles
		for (let i=0; i< projectiles.length; i++) {
			let p = projectiles[i];

			p.timeSinceCreation += delta;
			// After 30 seconds the object is deleted for performance reasons
			if (p.timeSinceCreation > 30) {
				p.object.geometry.dispose();
				p.object.material.dispose();
				scene.remove(p.object);
				projectiles.splice(i, 1);
			}
			
			// update projectile positions
			p.object.position.x += p.velocity.x * delta;
			p.object.position.y += p.velocity.y * delta;
			p.object.position.z += p.velocity.z * delta;

			// check for collision with player
			const direction = p.velocity.clone();
			direction.normalize();
			const raycaster = new THREE.Raycaster(p.object.position, direction, 0, 1);
			//const arrowHelper = new THREE.ArrowHelper(p.velocity, p.object.position, 10, 0x00ff00);
			//scene.add(arrowHelper);
			let intersects = raycaster.intersectObject(boundingBox, true);
			if (intersects.length > 0) {
				health -= 1;
				console.log("player hit");
				p.object.geometry.dispose();
				p.object.material.dispose();
				scene.remove(p.object);
				projectiles.splice(i, 1);
			}


		}
	}

	render();
}

main();
