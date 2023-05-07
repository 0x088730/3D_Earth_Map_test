
import * as THREE from "https://unpkg.com/three@0.138.3/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.138.3/examples/jsm/controls/OrbitControls.js";
import { SpiralSphereGeometry } from "./SpiralSphereGeometry.js";

var canvas, camera, material, scene, renderer, controls;
var sphere, outline, examples, radius, turns, zoomSpeed;
var mouseMove,
  mouseMove0,
  mouseDown,
  idMove,
  idDown,
  isSwipe,
  tooltip,
  tooltipWaiting;

init();
animate();

function init() {
  examples = [];
  Object.keys(files).forEach((key) => {
    files[key].forEach((name) => examples.push(name));
  });

  var tileRatio = 1000 / 800;
  turns =
    Math.PI / Math.sqrt((4 * Math.PI) / examples.length / tileRatio);
  radius = 1;
  var gap = 0.01;
  var subGrid = 20;

  var texSize = Math.ceil(Math.sqrt(examples.length));
  var uvZoom = 0.01;
  var uvZoom2 = 0.065;
  zoomSpeed = 0.25;

  mouseMove = new THREE.Vector2();
  mouseMove0 = new THREE.Vector2();
  mouseDown = new THREE.Vector2();
  tooltip = document.getElementById("tooltip");

  // scene

  scene = new THREE.Scene();
  scene.background = new THREE.Color("black");

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    10
  );
  camera.position.set(5, 1.5, 1);
  camera.matrixWorldNeedsUpdate = true;
  if (camera.aspect < 1) {
    var pos = camera.position.divideScalar(camera.aspect);
    camera.position.set(pos.x, pos.y, pos.z);
  }

  sphere = new SpiralSphereGeometry(
    radius,
    turns,
    gap,
    gap,
    subGrid,
    subGrid,
    examples.length
  );
  sphere.setAttribute(
    "zoom",
    new THREE.BufferAttribute(
      new Float32Array(sphere.attributes.id.count),
      1
    )
  );
  sphere.setAttribute("uv2", sphere.attributes.uv.clone());
  sphere.computeVertexNormals();
  computeTileUVs(sphere, texSize, sphere.attributes.uv, uvZoom);
  computeTileUVs(sphere, texSize, sphere.attributes.uv2, uvZoom2);

  material = new THREE.MeshBasicMaterial({ color: 0xa1a1a1 });
  new THREE.TextureLoader().load("./all_in_one.jpg", function (map) {
    material.color = null;
    material.map = map;
    material.needsUpdate = true;
  });
  const loader = new THREE.TextureLoader();
  loader.load("./galaxy_starfield.png", function (texture) {
    scene.background = texture;
  });
  material.onBeforeCompile = function (shader) {
    shader.vertexShader = [
      "attribute float zoom;",
      "attribute vec2 uv2;",
      shader.vertexShader,
    ].join("\n");
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      ["#ifdef USE_UV", "  vUv = mix( uv, uv2, zoom );", "#endif"].join(
        "\n"
      )
    );
  };

  scene.add(new THREE.Mesh(sphere, material));
  scene.add(outline);

  var thikness = 0.12 * gap * Math.sqrt(window.devicePixelRatio || 1);
  var geometry = new THREE.RingBufferGeometry(
    1 + thikness,
    1 + 2 * thikness,
    100
  );
  var matLine = new THREE.MeshBasicMaterial({ color: 0x049ef4 });
  outline = new THREE.Mesh(geometry, matLine);


  // renderer

  canvas = document.getElementById("canvas");
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // controls

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.screenSpacePanning = false;
  controls.enablePan = false;
  controls.minDistance = 1.05;
  controls.maxDistance = 10;

  // events

  window.addEventListener("resize", onWindowResize, false);
  canvas.addEventListener("mousedown", onMouseDown, false);
  canvas.addEventListener("mousemove", onMouseMove, false);
  canvas.addEventListener("mouseup", onMouseUp, false);
  canvas.addEventListener("touchstart", onMouseDown, false);
  canvas.addEventListener("touchmove", onMouseMove, false);
  canvas.addEventListener("touchend", onMouseUp, false);
}

function computeTileUVs(sphere, texSize, aUv, uvZoom) {
  for (var i = 0; i < sphere.attributes.id.count; i++) {
    var id = sphere.attributes.id.array[i];
    var j = Math.floor(id / texSize);
    var q = (1 - 2 * uvZoom) / texSize;
    var u0 = (id + uvZoom) / texSize - j;
    var v0 = 1 - (j + 1 - uvZoom) / texSize;

    aUv.array[2 * i] *= q;
    aUv.array[2 * i] += u0;
    aUv.array[2 * i + 1] *= q;
    aUv.array[2 * i + 1] += v0;
  }
}

function analyticRaycaster(mouse) {
  var ray = new THREE.Ray();
  ray.origin.setFromMatrixPosition(camera.matrixWorld);
  var x = (2 * mouse.x) / window.innerWidth - 1;
  var y = (-2 * mouse.y) / window.innerHeight + 1;
  ray.direction
    .set(x, y, 0.5)
    .unproject(camera)
    .sub(ray.origin)
    .normalize();

  var a = ray.direction.dot(ray.direction);
  var b = 2 * ray.origin.dot(ray.direction);
  var c = ray.origin.dot(ray.origin) - radius * radius;
  var D = b * b - 4 * a * c;
  if (D < 0) return -1;
  var p = new THREE.Vector3();
  var s = (-b - Math.sqrt(D)) / (2 * a);
  ray.at(s, p);

  p = new THREE.Spherical().setFromVector3(p);
  p.phi = Math.PI / 2 - p.phi;
  p.theta = (Math.PI / 2 - p.theta) % (2 * Math.PI);

  var t =
    p.theta / 2 / turns +
    (Math.PI / turns) *
      Math.floor(
        (turns * (Math.PI - 2 * p.phi) - p.theta) / (2 * Math.PI)
      ) -
    Math.PI / 2;
  return (
    1 +
    Math.floor(
      ((examples.length - 2) *
        (Math.cos(Math.PI / 2 / turns) -
          Math.cos(t + ((turns + 1) * Math.PI) / 2 / turns))) /
        (2 * Math.cos(Math.PI / 2 / turns))
    )
  );
}

function savePosition(mouse, e, touches) {
  mouse.x = touches ? touches[0].pageX : e.clientX;
  mouse.y = touches ? touches[0].pageY : e.clientY;
}

function onMouseDown(e) {
  savePosition(mouseDown, e, e.changedTouches);
  idMove = analyticRaycaster(mouseDown);
  idDown = idMove;
  isSwipe = false;
}

function onMouseMove(e) {
  e.preventDefault();
  savePosition(mouseMove, e, e.changedTouches);

  idMove = analyticRaycaster(mouseMove);
  canvas.style.cursor = idMove < 0 ? "auto" : "pointer";
  var multitouch = e.touches && e.touches.length > 1;
  isSwipe = mouseMove.distanceTo(mouseDown) > 4 || multitouch;

  if (mouseMove0.distanceTo(mouseMove) > 4) {
    tooltip.style.display = "none";
    clearTimeout(tooltipWaiting);
    tooltipWaiting = null;
  }
  if (!tooltipWaiting) {
    tooltipWaiting = setTimeout(function () {
      if (idMove >= 0) {
        tooltip.innerHTML = examples[idMove];
        tooltip.style.display = "block";
        var dy = e.touches
          ? -2 * tooltip.clientHeight
          : tooltip.clientHeight;
        tooltip.style.left =
          mouseMove.x - (tooltip.clientWidth - 10) / 2 + "px";
        tooltip.style.top = mouseMove.y + dy + "px";
      }
      tooltipWaiting = null;
    }, 500);
  }
  mouseMove0.copy(mouseMove);
}

function onMouseUp(e) {
  savePosition(mouseMove, e, e.changedTouches);
  var modal = document.getElementById("myModal");
  var modalImg = document.getElementById("img01");
  if (idMove >= 0 && !isSwipe) {
    // window.location.href = './' + examples[ idMove ] + '.html';
    //   alert(examples[idMove]);
    modal.style.display = "block";
    modalImg.src = this.src;
    // idMove.onclick = function () {
    //     modal.style.display = "block";
    //     // modalImg.src = this.src;
    //   };
  }
  var span = document.getElementsByClassName("close")[0];
  span.onclick = function () {
    modal.style.display = "none";
  };
  tooltip.style.display = "none";
  clearTimeout(tooltipWaiting);
  tooltipWaiting = null;
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function animate(now) {
  controls.update();
  controls.rotateSpeed = 0.4 * (camera.position.length() - 0.4);

  var k = 1 / Math.sqrt(1 - 1 / camera.position.lengthSq());
  outline.scale.copy(new THREE.Vector3(k, k, 1));
  outline.lookAt(camera.position);

  for (var i = 0, attr = sphere.attributes; i < attr.id.count; i++) {
    var dz = idMove === attr.id.array[i] ? zoomSpeed : -zoomSpeed;
    attr.zoom.array[i] = Math.max(
      0,
      Math.min(1, attr.zoom.array[i] + dz)
    );
    attr.zoom.needsUpdate = true;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}