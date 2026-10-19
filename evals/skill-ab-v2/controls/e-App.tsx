// Calibration control for task E (Viselora): four scroll chapters drive a
// deterministic scene; after chapter 4 the scene scrolls away with the story so
// the outro is plain DOM.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { WebGLRuntime, WebGLTarget, useDOMTarget } from "@viselora/dom-webgl/react";

// One keyframe per chapter: [x, y, rotation, scale, color] for each of 3 objects.
const keyframes = [
  [[-260, 0, 0, 1, "#e4572e"], [0, 0, 0, 1, "#17bebb"], [260, 0, 0, 1, "#ffc914"]],
  [[0, 200, 1, 1.4, "#5b2a86"], [-300, -120, 2, 0.8, "#76b041"], [300, -120, 3, 0.8, "#e4572e"]],
  [[-180, -180, 2, 0.7, "#17bebb"], [180, 180, 3, 1.6, "#ffc914"], [0, 0, 4, 1.1, "#5b2a86"]],
  [[0, 0, 3, 2.2, "#76b041"], [-380, 220, 5, 0.6, "#e4572e"], [380, -220, 6, 0.6, "#17bebb"]],
] as const;

const smooth = (t: number) => t * t * (3 - 2 * t);
const scratch = [new Color(), new Color()];

function Story() {
  const target = useDOMTarget("story");
  const group = useRef<Group>(null);
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(({ size }) => {
    const node = group.current;
    if (!node || !target) return;
    const { top, height } = target.rect;
    const chapterHeight = height / 4;
    // 0 when chapter 1 is centred, 3 when chapter 4 is centred.
    const t = Math.min(3, Math.max(0, (size.height / 2 - top) / chapterHeight - 0.5));
    const from = Math.floor(Math.min(t, 2.999));
    const mix = smooth(t - from);
    // Once the story's bottom edge passes the viewport bottom, the scene scrolls
    // up with it, so nothing is drawn over the outro.
    const bottom = top + height;
    node.position.y = Math.max(0, size.height - bottom);
    node.visible = bottom > 0;
    meshes.current.forEach((mesh, index) => {
      if (!mesh) return;
      const a = keyframes[from][index];
      const b = keyframes[from + 1][index];
      mesh.position.set(a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix, 0);
      mesh.rotation.set(0.4 + (a[2] + (b[2] - a[2]) * mix) * 0.5, a[2] + (b[2] - a[2]) * mix, 0);
      mesh.scale.setScalar(90 * (a[3] + (b[3] - a[3]) * mix));
      scratch[0].set(a[4]);
      scratch[1].set(b[4]);
      (mesh.material as MeshStandardMaterial).color.copy(scratch[0]).lerp(scratch[1], mix);
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} ref={(mesh) => void (meshes.current[index] = mesh)}>
          {index === 1 ? <sphereGeometry args={[0.8, 32, 16]} /> : <boxGeometry args={[1.2, 1.2, 1.2]} />}
          <meshStandardMaterial />
        </mesh>
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[300, 400, 600]} intensity={2.2} />
      <Story />
    </>
  );
}

const chapter = { minHeight: "100vh", padding: "30vh 8vw", boxSizing: "border-box" } as const;

export function App() {
  return (
    <WebGLRuntime
      canvas={{ orthographic: true, camera: { position: [0, 0, 1000], far: 4000 } }}
      scene={<Scene />}
    >
      <main style={{ fontFamily: "system-ui" }}>
        <section style={{ minHeight: "60vh", padding: "15vh 8vw", boxSizing: "border-box" }}>
          <h1>Control story</h1>
          <p>Scroll to begin.</p>
        </section>
        <WebGLTarget id="story">
          <div>
            {[1, 2, 3, 4].map((n) => (
              <section key={n} data-testid={`chapter-${n}`} style={chapter}>
                <h2>Chapter {n}</h2>
                <p>The scene changes with every chapter.</p>
              </section>
            ))}
          </div>
        </WebGLTarget>
        <section data-testid="outro" style={{ minHeight: "100vh", padding: "15vh 8vw", boxSizing: "border-box", background: "transparent" }}>
          <h2>After the story</h2>
          <p>This part of the page is ordinary DOM.</p>
          <a href="#top">Back to top</a>
        </section>
      </main>
    </WebGLRuntime>
  );
}
