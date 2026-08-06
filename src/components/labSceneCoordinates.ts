import * as THREE from "three";
import type { LabColor } from "../types";

export function labToSceneVector(lab: LabColor) {
  return new THREE.Vector3(-lab.a, lab.l, lab.b);
}
