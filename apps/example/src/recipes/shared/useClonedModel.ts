import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

/** The GLTF cache owns geometry and textures; each mounted model owns its graph. */
export function useClonedModel(src: string, dracoPath?: string) {
  const gltf = useGLTF(src, dracoPath ?? false);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  return { scene, animations: gltf.animations };
}
