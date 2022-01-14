'use strict';

import * as THREE from '../Libraries/three.js/build/three.module.js';
import { PointerLockControls } from '../Libraries/three.js/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from '../Libraries/three.js/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from '../Libraries/three.js/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../Libraries/three.js/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../Libraries/three.js/examples/jsm/postprocessing/UnrealBloomPass.js';

const THRUST = 40;
const TURNRATE = 150;
const FOV = 75;
const PROJECTILE_SPEED_1 = 15;
const PROJECTILE_SPEED_2 = 50;

let camera, topCamera, weaponCamera;
let composer, topCameraComposer, weaponCameraComposer;
let renderer, scene, controls, manager;
let bgm, shootSound, explosionSound, impactSound;
let mixer;

let inGame = false;
let loaded = false;
let gameIsOver = false;
let isLevel1 = true;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let acceleration = new THREE.Vector3();
let ship, turret, boundingBox;
let missile, missileAnimationGroup;
let health = 10;
let shootCooldown = 1;
let velocityArrow;
let weaponView = false;
let levelObjects = [];
let enemies = [];
let projectiles = [];
let toDestroy = [];

let accelerate, turnLeft, turnRight = false;

function main() {
	// Setting up the renderer
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);

	// Add event listeners
	window.addEventListener('resize', onWindowResize);
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener('keyup', onKeyUp);
	document.addEventListener('mousedown', shoot);

	// Set up loading manager
	manager = new THREE.LoadingManager();
	manager.onLoad = function() {
		if (!loaded) {
			loaded = true;
			document.body.appendChild(renderer.domElement);
			document.getElementById('loading').style.display = 'none';
			document.getElementById('instructions').style.display = 'flex';
			document.getElementById('blocker').style.display = 'block';
		}
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
		if (!weaponView) {
			accelerate = true;
		}
		break;

	case 'ArrowLeft':
	case 'KeyA':
		if (!weaponView) {
			turnLeft = true;
		}
		break;

	case 'ArrowRight':
	case 'KeyD':
		if (!weaponView) {
			turnRight = true;
		}
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
		if (inGame) {
			switchView();
		}
		break;
	}
}

function init(scene) {
	// Create cameras
	topCamera = new THREE.PerspectiveCamera(FOV, window.innerWidth/window.innerHeight,0.1,1000);
	topCamera.position.y = 200;
	topCamera.lookAt(0, 0, 0);
	topCamera.layers.enable(1);

	weaponCamera = new THREE.PerspectiveCamera(FOV, window.innerWidth/window.innerHeight,0.1,1000);
	weaponCamera.position.y = 3.5;

	camera = topCamera;

	// Setup first person controls for weapon view
	const instructions = document.getElementById('instructions');
	const blocker = document.getElementById('blocker');
	const health = document.getElementById('health-container');
	controls = new PointerLockControls( weaponCamera, document.body );
	controls.constrainVertical = true;
	controls.lookSpeed = 0.5;
	controls.maxPolarAngle = 1.8;
	instructions.addEventListener('click', function() {
		controls.lock();
		inGame = true;
		bgm.play();
	});
	controls.addEventListener('lock', function () {
		instructions.style.display = 'none';
		blocker.style.display = 'none';
		health.style.display = 'block';
	});
	controls.addEventListener('unlock', function () {
		if (!gameIsOver) {
			blocker.style.display = 'block';
			instructions.style.display = 'flex';
			health.style.display = 'none';
		}
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
	let ambientLight = new THREE.AmbientLight(0xDDDDFF, 0.8);
	scene.add(ambientLight);

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
	loader.load('ship.gltf', function (gltf) {
		ship = gltf.scene;
		scene.add(ship);
		// Bounding box for the player ship. Invisible rect used for collision detection
		const transparent = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
		const colliderGeometry = new THREE.BoxGeometry(20, 10, 8);
		boundingBox = new THREE.Mesh(colliderGeometry, transparent);
		boundingBox.translateX(2);
		boundingBox.translateY(-2);
		ship.add(boundingBox);
		boundingBox.updateMatrixWorld();
	});
	loader.load('turret.glb', function (gltf) {
		// Add the turret as a child of the weapon camera
		turret = gltf.scene;
		turret.translateZ(-3);
		turret.translateY(-1);
		weaponCamera.add(turret);
	});
	loader.load('missile.glb', function (gltf) {
		missile = gltf.scene;
		// play spinning animation
		let missileAnimation = gltf.animations[0];
		missileAnimationGroup = new THREE.AnimationObjectGroup();
		missileAnimationGroup.add(missile);
		mixer = new THREE.AnimationMixer(missileAnimationGroup);
		mixer.clipAction(missileAnimation).play();
	});
	// Arrow showing the velocity vector of the player
	velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,4,0), 100, 0xbbffbb);
	velocityArrow.traverse(function(node) {
		// set the arrow and it's children to layer 1 so it is only seen by the top camera
		node.layers.set(1);
	});
	scene.add(velocityArrow);

	// Audio
	// Add AudioListener to cameras
	const listener = new THREE.AudioListener();
	topCamera.add(listener);
	weaponCamera.add(listener);
	// Create global audio source
	bgm = new THREE.Audio(listener);
	// Load audio
	const audioLoader = new THREE.AudioLoader();
	audioLoader.load('../Assets/audio/bgm.wav', function(buffer) {
		bgm.setBuffer(buffer);
		bgm.setLoop(true);
		bgm.setVolume(0.5);
	});
	shootSound = new THREE.Audio(listener);
	audioLoader.load('../Assets/audio/shot.wav', function(buffer) {
		shootSound.setBuffer(buffer);
		shootSound.setVolume(0.5);
	});
	explosionSound = new THREE.Audio(listener);
	audioLoader.load('../Assets/audio/explosion.wav', function(buffer) {
		explosionSound.setBuffer(buffer);
	});
	impactSound = new THREE.Audio(listener);
	audioLoader.load('../Assets/audio/impact.wav', function(buffer) {
		impactSound.setBuffer(buffer);
	});

	loadLevel1();
}

// Load the first level
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
	levelObjects.push(star1, star2, star1Light, star2Light);

	// Create enemy ships
	const loader = new GLTFLoader(manager).setPath('../Assets/models/');
	loader.load('enemy.glb', function (gltf) {
		let enemy = gltf.scene;
		const transparent = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
		for (let i = 0; i < 10; i++) {
			// Add 10 enemy ships at random positions
			let enemyClone = enemy.clone();
			let position = new THREE.Vector3(
				Math.random() * 600 - 300,
				Math.random() * 5 + 10,
				Math.random() * 600 - 300
			);
			enemyClone.position.set(position.x, position.y, position.z);
			// Bounding box for the ship. Invisible rect used for collision detection
			const colliderGeometry = new THREE.BoxGeometry(9, 7, 10);
			const enemyBoundingBox = new THREE.Mesh(colliderGeometry, transparent);
			enemyBoundingBox.translateZ(-5);
			enemyBoundingBox.translateY(2);
			enemyBoundingBox.userData = { health: 5 };
			enemyClone.add(enemyBoundingBox);
			enemyClone.userData = { shootCooldown: Math.random() * 10 + 4 };
			enemies.push(enemyClone);
			scene.add(enemyClone);
		}
	});
}

// Unload the first level then load the second level
function loadLevel2() {
	isLevel1 = false;

	// Unload level 1 elements
	document.getElementById('loading').style.display = 'block';
	let canvas = document.getElementsByTagName('canvas')[0];
	canvas.parentNode.removeChild(canvas);
	for (const o of levelObjects) {
		removeObjectFromScene(o);
	}
	console.log(projectiles);
	for (let i = 0; i < projectiles.length; i++) {
		removeObjectFromScene(projectiles[i].object);
	}
	projectiles = [];

	// Reset state variables
	loaded = false;
	switchView();
	inGame = false;
	health = 10;
	controls.unlock();
	ship.position.set(0,0,0);
	weaponCamera.position.set(0,3.5,0);
	topCamera.position.set(0,200,0);
	velocityArrow.position.set(0,0,0);
	velocity.set(0,0,0);

	// Set level description
	document.getElementById('description').innerHTML = 'In this final stage enemy missiles now travel faster.<br>The enemies are also smarter. They will now fire at where you will be rather than where you currently are.';

	// Create skybox
	let skyboxTextures = [
		'../Assets/skyboxes/red/bkg_right.png',
		'../Assets/skyboxes/red/bkg_left.png',
		'../Assets/skyboxes/red/bkg_top.png',
		'../Assets/skyboxes/red/bkg_bottom.png',
		'../Assets/skyboxes/red/bkg_front.png',
		'../Assets/skyboxes/red/bkg_back.png'
	];

	let cubeLoader = new THREE.CubeTextureLoader(manager);
	let cubeTexture = cubeLoader.load(skyboxTextures);
	scene.background = cubeTexture;
	scene.environment = cubeTexture;

	// Create Stars
	let starGeometry = new THREE.SphereGeometry(100, 50, 50);
	const textureLoader = new THREE.TextureLoader(manager);
	let starMaterial = new THREE.MeshBasicMaterial({ map: textureLoader.load('../Assets/sun2.jpg') });
	let star1 = new THREE.Mesh(starGeometry, starMaterial);
	star1.position.set(20, -120, -5);
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
	levelObjects.push(star1, star2, star1Light, star2Light);

	// Create enemy ships
	const loader = new GLTFLoader(manager).setPath('../Assets/models/');
	loader.load('enemy.glb', function (gltf) {
		let enemy = gltf.scene;
		const transparent = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
		for (let i = 0; i < 10; i++) {
			// Add 10 enemy ships at random positions
			let enemyClone = enemy.clone();
			let position = new THREE.Vector3(
				Math.random() * 600 - 300,
				Math.random() * 5 + 10,
				Math.random() * 600 - 300
			);
			enemyClone.position.set(position.x, position.y, position.z);
			// Bounding box for the ship. Invisible rect used for collision detection
			const colliderGeometry = new THREE.BoxGeometry(9, 7, 10);
			const enemyBoundingBox = new THREE.Mesh(colliderGeometry, transparent);
			enemyBoundingBox.translateZ(-5);
			enemyBoundingBox.translateY(2);
			enemyBoundingBox.userData = { health: 5 };
			enemyClone.add(enemyBoundingBox);
			enemyClone.userData = { shootCooldown: Math.random() * 10 + 4 };
			enemies.push(enemyClone);
			scene.add(enemyClone);
		}
	});
}

// Properly dispose of object and remove from scene
function removeObjectFromScene(o) {
	if (o.geometry) {
		o.geometry.dispose();
	}
	if (o.material) {
		o.material.dispose();
	}
	scene.remove(o);
}

// Updates the aspect ratio when the screen is resized
function onWindowResize() {
	let aspect = window.innerWidth / window.innerHeight;
	topCamera.aspect = aspect;
	weaponCamera.aspect = aspect;
	topCamera.updateProjectionMatrix();
	weaponCamera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	topCameraComposer.setSize(window.innerWidth, window.innerHeight);
	weaponCameraComposer.setSize(window.innerWidth, window.innerHeight);
}

// Switch active camera
function switchView() {
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

// Shoots a ray from the weapon and checks for collisions with enemy ships
function shoot() {
	if (weaponView && shootCooldown <= 0) {
		// Reset timer
		shootCooldown = 0.3;

		// Play sound effect
		shootSound.play();

		// Create flash
		const flashTexture = new THREE.TextureLoader(manager).load( '../Assets/flash.png' );
		const flashMaterial = new THREE.SpriteMaterial( { map: flashTexture } );
		const flash = new THREE.Sprite(flashMaterial);
		flash.translateZ(-5);
		flash.translateY(-0.8);
		let flashLight = new THREE.PointLight(0xFF7777, 0.7, 10, 2);
		flashLight.translateZ(-5);
		flashLight.translateY(-0.8);
		flash.userData = { destructionTimer: 0.1 };
		flashLight.userData = { destructionTimer: 0.1 };
		toDestroy.push(flash);
		toDestroy.push(flashLight);
		weaponCamera.add(flash);
		weaponCamera.add(flashLight);

		// We want to cast a ray in the direction the camera is facing
		let direction = new THREE.Vector3();
		camera.getWorldDirection(direction);
		// Check for collision with enemy ships by casting a ray
		const raycaster = new THREE.Raycaster(camera.position, direction.normalize());
		let collisions = raycaster.intersectObjects(enemies, true);
		for (const c of collisions) {
			c.object.userData.health -= 1;
			if (c.object.userData.health <= 0) {
				// Enemy health is 0 -> destroy the ship
				scene.remove(c.object.parent);
				enemies.splice(enemies.indexOf(c.object.parent), 1);
				explosionSound.play();

				// Check if level has been completed
				if (enemies.length == 0) {
					if (isLevel1) {
						loadLevel2();
					} else {
						gameWon();
					}
				}
			}
		}
	}
}

// When the player runs out of health: end the game
function gameOver() {
	inGame = false;
	gameIsOver = true;
	renderer.domElement.style.display = 'none';
	document.getElementById('gameover').style.display = 'block';
	controls.unlock();
	document.getElementById('blocker').style.display = 'none';
}

// When the player defeats all enemy ships: end the game
function gameWon() {
	// Unload all objects
	inGame = false;
	gameIsOver = true;
	let canvas = document.getElementsByTagName('canvas')[0];
	canvas.parentNode.removeChild(canvas);
	for (const o of levelObjects) {
		removeObjectFromScene(o);
	}
	for (const o of projectiles) {
		removeObjectFromScene(o);
	}
	removeObjectFromScene(ship);
	controls.unlock();
	document.getElementById('gamewon').style.display = 'block';
	document.getElementById('health-container').style.display = 'none';
	document.getElementById('instructions').style.display = 'none';
	document.getElementById('blocker').style.display = 'none';
}

// This function is run every frame
function animate() {
	requestAnimationFrame(animate);

	// reset acceleration
	acceleration.set(0.0, 0.0, 0.0);

	// Figure out how much time has passed since last frame
	const time = performance.now();
	const delta = (time - prevTime) / 1000;
	prevTime = time;

	if (inGame) {
		// Controls
		if (turnLeft) {
			ship.rotateY(0.01 * TURNRATE * delta);
		}
		if (turnRight) {
			ship.rotateY(-0.01 * TURNRATE * delta);
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

		// update shoot timer
		shootCooldown -= delta;

		// update animations
		if (mixer) mixer.update(delta);

		// update enemy ships 
		for (const e of enemies) {
			let target;
			if (isLevel1) {
				// look at player
				target = ship.position;
			} else {
				// look in front of player
				target = ship.position.clone();
				target.add(velocity.clone().multiplyScalar(2));
			}
			e.lookAt(target);
			// if enough time has passed: shoot
			e.userData.shootCooldown -= delta;
			if (e.userData.shootCooldown <= 0) {
				// reset cooldown
				e.userData.shootCooldown += 8;
				// create projectile
				let projectile = missile.clone();
				missileAnimationGroup.add(projectile);
				projectile.position.set(
					e.position.x,
					e.position.y,
					e.position.z
				);
				projectile.lookAt(target);
				projectile.rotateOnAxis(new THREE.Vector3(1,0,0), 1.5708);
				projectile.scale.set(0.8, 0.8, 0.8);
				// get the direction vector of the enemy ship
				let matrix = new THREE.Matrix4();
				matrix.extractRotation(e.matrix);
				let direction = new THREE.Vector3(0, 0, 1);
				direction = direction.applyMatrix4(matrix).multiplyScalar(isLevel1 ? PROJECTILE_SPEED_1 : PROJECTILE_SPEED_2);
				// add projectile to scene
				projectiles.push({
					object: projectile,
					velocity: direction,
					timeSinceCreation: 0.0,
				});
				scene.add(projectile);
			}
		}

		// update projectiles
		for (let i=0; i< projectiles.length; i++) {
			let p = projectiles[i];

			p.timeSinceCreation += delta;
			// After 30 seconds the object is deleted for performance reasons
			if (p.timeSinceCreation > 30) {
				scene.remove(p.object);
				projectiles.splice(i, 1);
			}
			
			// update projectile positions
			p.object.position.x += p.velocity.x * delta;
			p.object.position.y += p.velocity.y * delta;
			if (p.object.position.y < 0) {
				p.object.position.y = 0;
			}
			p.object.position.z += p.velocity.z * delta;

			// check for collision with player
			const direction = p.velocity.clone();
			direction.normalize();
			const raycaster = new THREE.Raycaster(p.object.position, direction, 0, 1);
			let intersects = raycaster.intersectObject(boundingBox, false);
			if (intersects.length > 0) {
				// player has been hit by the projectile
				health -= 1;
				impactSound.play();
				document.getElementById('health').innerHTML = 'Health: ' + health;
				scene.remove(p.object);
				projectiles.splice(i, 1);
				if (health <= 0) {
					gameOver();
				}
			}
		}

		// Check for objects that need to be destroyed
		for (let i = 0; i < toDestroy.length; i++) {
			const e = toDestroy[i];
			e.userData.destructionTimer -= delta;
			if (e.userData.destructionTimer <= 0) {
				// destroy object
				if (e.geometry) {
					e.geometry.dispose();
				}
				if (e.material) {
					e.material.dispose();
				}
				weaponCamera.remove(e);
				toDestroy.splice(i, 1);
			}
		}
	}

	composer.render();
}

main();
