// Calibration control for task D without Viselora: one fixed R3F Canvas and a
// drei <View> per card (scissored viewports that track the DOM slots). It
// checks that the grader does not depend on Viselora. The error boundary keeps
// the DOM page when WebGL is unavailable (Canvas creation throws).
import { useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import { Color, type Mesh, type MeshStandardMaterial } from "three";

const cards = [
  {
    title: "Fast",
    text: "Pages render in a single pass.",
    color: "#e4572e",
    shape: "box",
  },
  {
    title: "Calm",
    text: "Motion respects user settings.",
    color: "#17bebb",
    shape: "sphere",
  },
  {
    title: "Open",
    text: "Built on React Three Fiber.",
    color: "#ffc914",
    shape: "torus",
  },
  {
    title: "Sharp",
    text: "Text stays semantic HTML.",
    color: "#76b041",
    shape: "cone",
  },
] as const;

function CardObject({
  index,
  active,
  reduced,
}: {
  index: number;
  active: boolean;
  reduced: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const card = cards[index];
  const rest = new Color(card.color);
  const hot = new Color("#5b2a86");
  useFrame((_, delta) => {
    const node = mesh.current;
    if (!node) return;
    const k = reduced ? 1 : 1 - Math.exp(-delta * 10);
    const scale = node.scale.x + ((active ? 1.35 : 1) - node.scale.x) * k;
    node.scale.setScalar(scale);
    node.rotation.set(0.5, 0.6 + (active ? 0.6 : 0), 0);
    (node.material as MeshStandardMaterial).color.lerp(active ? hot : rest, k);
  });
  return (
    <mesh ref={mesh}>
      {card.shape === "box" && <boxGeometry args={[1.2, 1.2, 1.2]} />}
      {card.shape === "sphere" && <sphereGeometry args={[0.8, 32, 16]} />}
      {card.shape === "torus" && <torusGeometry args={[0.6, 0.25, 16, 48]} />}
      {card.shape === "cone" && <coneGeometry args={[0.7, 1.4, 32]} />}
      <meshStandardMaterial color={card.color} />
    </mesh>
  );
}

export function App() {
  const [active, setActive] = useState(-1);
  const [reduced, setReduced] = useState(false);
  const [eventSource, setEventSource] = useState<HTMLElement | null>(null);
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setEventSource(page.current);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <div ref={page} style={{ position: "relative" }}>
      <main
        style={{
          padding: "8vh 6vw",
          fontFamily: "system-ui",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1>Features</h1>
        <p>Four reasons to try the control page.</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 24,
          }}
        >
          {cards.map((card, index) => (
            <article
              key={card.title}
              data-testid={`feature-card-${index + 1}`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() =>
                setActive((current) => (current === index ? -1 : current))
              }
              onFocus={() => setActive(index)}
              onBlur={() =>
                setActive((current) => (current === index ? -1 : current))
              }
              style={{
                border: "1px solid #ccc",
                borderRadius: 16,
                padding: 20,
              }}
            >
              <View style={{ height: 180 }}>
                <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={40} />
                <ambientLight intensity={1.1} />
                <directionalLight position={[3, 4, 6]} intensity={2.2} />
                <CardObject
                  index={index}
                  active={active === index}
                  reduced={reduced}
                />
              </View>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <a href={`#more-${index}`}>Learn more</a>
            </article>
          ))}
        </div>
      </main>
      <section
        style={{
          minHeight: "100vh",
          padding: "8vh 6vw",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h2>More</h2>
        <p>Additional content.</p>
      </section>
      {eventSource && (
        <ErrorBoundary fallback={null}>
          <Canvas
            eventSource={eventSource}
            style={{
              position: "fixed",
              inset: 0,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <View.Port />
          </Canvas>
        </ErrorBoundary>
      )}
    </div>
  );
}
