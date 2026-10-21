// Calibration control for task D (Viselora): four DOM cards, each with a
// WebGL object that follows its card and reacts to hover or keyboard focus.
import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh, type MeshStandardMaterial } from "three";
import { WebGLRuntime, WebGLTarget, useDOMTarget, useWebGLRuntime } from "@viselora/dom-webgl/react";

const cards = [
  { title: "Fast", text: "Pages render in a single pass.", color: "#e4572e", shape: "box" },
  { title: "Calm", text: "Motion respects user settings.", color: "#17bebb", shape: "sphere" },
  { title: "Open", text: "Built on React Three Fiber.", color: "#ffc914", shape: "torus" },
  { title: "Sharp", text: "Text stays semantic HTML.", color: "#76b041", shape: "cone" },
] as const;

type Active = MutableRefObject<number>;

function CardObject({ index, active, reduced }: { index: number; active: Active; reduced: Active }) {
  const id = `card-object-${index}`;
  const target = useDOMTarget(id);
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  const card = cards[index];
  const rest = new Color(card.color);
  const hot = new Color("#5b2a86");
  useEffect(() => {
    if (!target) return;
    runtime.setTargetReady(id, true, target);
    return () => runtime.setTargetReady(id, false, target);
  }, [runtime, target, id]);
  useFrame(({ size }, delta) => {
    const node = mesh.current;
    if (!node || !target) return;
    node.visible = target.visible;
    const { left, top, width, height } = target.rect;
    node.position.set(left + width / 2 - size.width / 2, size.height / 2 - top - height / 2, 0);
    const on = active.current === index ? 1 : 0;
    const k = reduced.current ? 1 : 1 - Math.exp(-delta * 10);
    const base = Math.min(width, height) * 0.32;
    const scale = node.scale.x + (base * (1 + 0.35 * on) - node.scale.x) * k;
    node.scale.setScalar(scale);
    node.rotation.set(0.5, 0.6 + on * 0.6, 0);
    (node.material as MeshStandardMaterial).color.lerp(on ? hot : rest, k);
  });
  return (
    <mesh ref={mesh} scale={1}>
      {card.shape === "box" && <boxGeometry args={[1.2, 1.2, 1.2]} />}
      {card.shape === "sphere" && <sphereGeometry args={[0.8, 32, 16]} />}
      {card.shape === "torus" && <torusGeometry args={[0.6, 0.25, 16, 48]} />}
      {card.shape === "cone" && <coneGeometry args={[0.7, 1.4, 32]} />}
      <meshStandardMaterial color={card.color} />
    </mesh>
  );
}

function Scene({ active, reduced }: { active: Active; reduced: Active }) {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[300, 400, 600]} intensity={2.2} />
      {cards.map((_, index) => (
        <CardObject key={index} index={index} active={active} reduced={reduced} />
      ))}
    </>
  );
}

export function App() {
  const active = useRef(-1);
  const reduced = useRef(0);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduced.current = query.matches ? 1 : 0;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const set = (index: number) => () => {
    active.current = index;
  };
  const clear = (index: number) => () => {
    if (active.current === index) active.current = -1;
  };
  return (
    <WebGLRuntime
      canvas={{ orthographic: true, camera: { position: [0, 0, 1000], far: 4000 } }}
      scene={<Scene active={active} reduced={reduced} />}
    >
      <main style={{ padding: "8vh 6vw", fontFamily: "system-ui" }}>
        <h1>Features</h1>
        <p>Four reasons to try the control page.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
          {cards.map((card, index) => (
            <article
              key={card.title}
              data-testid={`feature-card-${index + 1}`}
              onPointerEnter={set(index)}
              onPointerLeave={clear(index)}
              onFocus={set(index)}
              onBlur={clear(index)}
              style={{ border: "1px solid #ccc", borderRadius: 16, padding: 20 }}
            >
              <WebGLTarget id={`card-object-${index}`} hideWhenReady>
                <div aria-hidden="true" style={{ height: 180, borderRadius: 12, background: "#eee" }} />
              </WebGLTarget>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <a href={`#more-${index}`}>Learn more</a>
            </article>
          ))}
        </div>
      </main>
      <section style={{ minHeight: "100vh", padding: "8vh 6vw" }}>
        <h2>More</h2>
        <p>Additional content.</p>
      </section>
    </WebGLRuntime>
  );
}
