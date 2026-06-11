import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { labToSrgb } from "../color/lab";
import { buildToleranceSurface } from "../tolerance/surface";
import type { DeltaEFormula, LabColor, ResolvedColor } from "../types";

type LabSceneProps = {
  colors: ResolvedColor[];
  comparisonLab: LabColor | null;
  selectedId: string | null;
  formula: DeltaEFormula;
  tolerance: number;
  onSelect: (id: string) => void;
};

type SceneState = {
  camera: THREE.PerspectiveCamera;
  comparisonMesh: THREE.Mesh;
  controls: OrbitControls;
  frameId: number;
  pointsGroup: THREE.Group;
  pointMeshes: THREE.Mesh[];
  raycaster: THREE.Raycaster;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  target: THREE.Vector3;
  toleranceMesh: THREE.Mesh | null;
};

const axisLength = 145;
const pointGeometry = new THREE.SphereGeometry(0.48, 16, 10);
const comparisonGeometry = new THREE.SphereGeometry(0.72, 18, 12);

function labToVector(lab: LabColor) {
  return new THREE.Vector3(lab.a, lab.l, lab.b);
}

function labToThreeColor(lab: LabColor) {
  const rgb = labToSrgb(lab);
  return new THREE.Color().setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace);
}

function createAxis(start: THREE.Vector3, end: THREE.Vector3, color: number) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start, end]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
}

function createAxisLabel(text: string, position: THREE.Vector3, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 30px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 5;
  context.strokeStyle = "rgba(16, 21, 18, 0.86)";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.position.copy(position);
  sprite.scale.set(18, 9, 1);
  return sprite;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => {
    if ("map" in entry && entry.map instanceof THREE.Texture) {
      entry.map.dispose();
    }
    entry.dispose();
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.GridHelper) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    } else if (child instanceof THREE.Sprite) {
      disposeMaterial(child.material);
    }
  });
}

function makeToleranceGeometry(center: LabColor, formula: DeltaEFormula, tolerance: number) {
  const surface = buildToleranceSurface({ center, formula, tolerance, rings: 18, segments: 36 });
  const positions = new Float32Array(surface.vertices.length * 3);

  surface.vertices.forEach((vertex, index) => {
    const offset = index * 3;
    positions[offset] = vertex.a;
    positions[offset + 1] = vertex.l;
    positions[offset + 2] = vertex.b;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(surface.indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function LabScene({ colors, comparisonLab, selectedId, formula, tolerance, onSelect }: LabSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SceneState | null>(null);
  const selectedColor = useMemo(() => colors.find((color) => color.id === selectedId) ?? null, [colors, selectedId]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101512);
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
    camera.position.set(155, 118, 210);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 50, 0);
    controls.minDistance = 60;
    controls.maxDistance = 420;

    const axes = new THREE.Group();
    axes.add(createAxis(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 105, 0), 0xded9ca));
    axes.add(createAxis(new THREE.Vector3(-axisLength, 50, 0), new THREE.Vector3(axisLength, 50, 0), 0xe46d4f));
    axes.add(createAxis(new THREE.Vector3(0, 50, -axisLength), new THREE.Vector3(0, 50, axisLength), 0x4d8ee5));
    axes.add(createAxisLabel("L*", new THREE.Vector3(0, 112, 0), "#f5f1e7"));
    axes.add(createAxisLabel("a*", new THREE.Vector3(axisLength + 14, 50, 0), "#ff876b"));
    axes.add(createAxisLabel("b*", new THREE.Vector3(0, 50, axisLength + 14), "#72a8ff"));
    scene.add(axes);

    const grid = new THREE.GridHelper(290, 10, 0x2e3b30, 0x263026);
    grid.position.y = 0;
    scene.add(grid);

    const pointsGroup = new THREE.Group();
    scene.add(pointsGroup);

    const comparisonMesh = new THREE.Mesh(
      comparisonGeometry.clone(),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      }),
    );
    comparisonMesh.visible = false;
    scene.add(comparisonMesh);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const target = new THREE.Vector3(0, 50, 0);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(stateRef.current?.pointMeshes ?? [], false)[0];

      if (hit?.object.userData.colorId) {
        onSelect(hit.object.userData.colorId as string);
      }
    };

    renderer.domElement.addEventListener("click", handleClick);
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const animate = () => {
      controls.target.lerp(target, 0.08);
      controls.update();
      renderer.render(scene, camera);
      const state = stateRef.current;
      if (state) {
        state.frameId = window.requestAnimationFrame(animate);
      }
    };

    stateRef.current = {
      camera,
      comparisonMesh,
      controls,
      frameId: window.requestAnimationFrame(animate),
      pointsGroup,
      pointMeshes: [],
      raycaster,
      renderer,
      scene,
      target,
      toleranceMesh: null,
    };

    return () => {
      const state = stateRef.current;
      if (state) {
        window.cancelAnimationFrame(state.frameId);
        state.controls.dispose();
        state.renderer.domElement.removeEventListener("click", handleClick);
        disposeObject(state.scene);
        state.renderer.dispose();
      }
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, [onSelect]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }

    state.pointMeshes.forEach((mesh) => {
      state.pointsGroup.remove(mesh);
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    });

    state.pointMeshes = colors.map((color) => {
      const pointColor = labToThreeColor(color.lab);
      const material = new THREE.MeshBasicMaterial({
        color: pointColor,
      });
      const mesh = new THREE.Mesh(pointGeometry.clone(), material);
      mesh.position.copy(labToVector(color.lab));
      mesh.userData.colorId = color.id;
      state.pointsGroup.add(mesh);
      return mesh;
    });
  }, [colors]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }

    state.pointMeshes.forEach((mesh) => {
      const selected = mesh.userData.colorId === selectedId;
      mesh.scale.setScalar(selected ? 2.2 : 1);
    });

    if (!selectedColor) {
      state.target.set(0, 50, 0);
      if (state.toleranceMesh) {
        state.scene.remove(state.toleranceMesh);
        disposeObject(state.toleranceMesh);
        state.toleranceMesh = null;
      }
      return;
    }

    const selectedPoint = labToVector(selectedColor.lab);
    state.target.copy(selectedPoint);

    if (state.toleranceMesh) {
      state.scene.remove(state.toleranceMesh);
      disposeObject(state.toleranceMesh);
    }

    const mesh = new THREE.Mesh(
      makeToleranceGeometry(selectedColor.lab, formula, tolerance),
      new THREE.MeshStandardMaterial({
        color: labToThreeColor(selectedColor.lab),
        opacity: 0.58,
        transparent: true,
        wireframe: true,
        roughness: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    state.toleranceMesh = mesh;
    state.scene.add(mesh);
  }, [formula, selectedColor, selectedId, tolerance]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }

    if (!comparisonLab) {
      state.comparisonMesh.visible = false;
      return;
    }

    state.comparisonMesh.visible = true;
    state.comparisonMesh.position.copy(labToVector(comparisonLab));
  }, [comparisonLab]);

  return (
    <div className="lab-scene" ref={mountRef}>
      <div className="scene-legend" aria-hidden="true">
        <span>L* up</span>
        <span>a* red</span>
        <span>b* blue</span>
      </div>
      {colors.length === 0 && (
        <div className="empty-scene">
          <span className="scene-kicker">L*a*b*</span>
          <strong>Upload a CxF file</strong>
        </div>
      )}
    </div>
  );
}
