import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh, type MeshStandardMaterial } from "three";
import { WebGLRuntime } from "@viselora/dom-webgl/react";

const palette = [new Color("#ff6b6b"), new Color("#4dabf7"), new Color("#51cf66")];
const scratch = new Color();

function Story() {
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const node = mesh.current;
    if (!node) return;
    node.rotation.set(progress * Math.PI, progress * Math.PI * 2, 0);
    node.position.x = Math.sin(progress * Math.PI) * 2;
    const segment = Math.min(1.999, progress * 2);
    const index = Math.floor(segment);
    scratch.copy(palette[index]).lerp(palette[index + 1], segment - index);
    (node.material as MeshStandardMaterial).color.copy(scratch);
    camera.position.set(0, 0, 6 - progress * 2);
    camera.lookAt(0, 0, 0);
  });
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <mesh ref={mesh}>
        <torusKnotGeometry args={[1, 0.35, 160, 24]} />
        <meshStandardMaterial />
      </mesh>
    </>
  );
}

const chapter = { minHeight: "100vh", padding: "20vh 8vw", boxSizing: "border-box" } as const;

export function App() {
  return (
    <WebGLRuntime canvas={{ camera: { position: [0, 0, 6] } }} scene={<Story />}>
      <main>
        {[1, 2, 3].map((n) => (
          <section key={n} data-testid={`chapter-${n}`} style={chapter}>
            <h2>Chapter {n}</h2>
            <p>The scene follows the reader.</p>
          </section>
        ))}
      </main>
    </WebGLRuntime>
  );
}
