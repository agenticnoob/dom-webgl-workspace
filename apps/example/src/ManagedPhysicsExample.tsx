import { PerspectiveCamera, View } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { MeshStandardMaterial } from "three";
import { useClonedModel } from "./recipes/shared/useClonedModel";
import { readKinematicSweep, useHoverPulse } from "./interactionEffects";
import { usePhysicsDrag } from "./physicsDrag";

export const inertiaBody = {
  position: [-2.36, -0.7, 0.24] as [number, number, number],
  mass: 1.2,
  linearDamping: 0.006,
  restitution: 0.86,
  friction: 0.08,
};

function DraggableCrate({ inertia = false }: { readonly inertia?: boolean }) {
  const body = useRef<RapierRigidBody>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const drag = usePhysicsDrag(body);
  const hover = useHoverPulse(
    (opacity) => {
      if (material.current) material.current.opacity = opacity;
    },
    inertia ? 0.88 : 1,
    1,
  );
  return (
    <RigidBody
      ref={body}
      name={inertia ? "example.physics.inertia" : "example.physics.crate"}
      colliders={false}
      position={inertia ? inertiaBody.position : [0.4, -1.18, -0.7]}
      linearDamping={inertia ? inertiaBody.linearDamping : 0.02}
      restitution={inertia ? inertiaBody.restitution : 0.42}
      friction={inertia ? inertiaBody.friction : 0.62}
      ccd
    >
      {inertia ? (
        <BallCollider args={[0.34]} mass={inertiaBody.mass} />
      ) : (
        <CuboidCollider args={[0.36, 0.36, 0.36]} mass={1.6} />
      )}
      <mesh {...hover} {...drag}>
        <boxGeometry args={inertia ? [0.56, 0.56, 0.56] : [0.72, 0.72, 0.72]} />
        <meshStandardMaterial
          ref={material}
          color={inertia ? "#d95f42" : "#c87f47"}
          roughness={inertia ? 0.34 : 0.56}
          transparent={inertia}
        />
      </mesh>
    </RigidBody>
  );
}

function SpringBody({ anchored = false }: { readonly anchored?: boolean }) {
  const origin = useRef<RapierRigidBody>(null);
  const body = useRef<RapierRigidBody>(null);
  const { world, rapier } = useRapier();
  useEffect(() => {
    if (!origin.current || !body.current) return;
    const joint = world.createImpulseJoint(
      rapier.JointData.spring(
        anchored ? 0 : 0.92,
        anchored ? 95 : 72,
        0,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ),
      origin.current,
      body.current,
      true,
    );
    return () => {
      if (world.getImpulseJoint(joint.handle))
        world.removeImpulseJoint(joint, true);
    };
  }, [anchored, rapier, world]);
  return (
    <>
      <RigidBody
        ref={origin}
        type="fixed"
        colliders={false}
        position={anchored ? [-1.76, -1.22, -0.7] : [1.46, -1.18, -0.7]}
      />
      <RigidBody
        ref={body}
        name={anchored ? "example.physics.anchor" : "example.physics.spring"}
        colliders={false}
        position={anchored ? [-2.36, -1.22, -0.7] : [2.16, -1.18, -0.7]}
        linearVelocity={anchored ? [5.2, 0, 0] : [-4.8, 0, 0]}
        gravityScale={0}
        linearDamping={0}
        restitution={0.18}
        enabledRotations={[false, false, false]}
      >
        {anchored ? (
          <CuboidCollider args={[0.22, 0.22, 0.22]} mass={0.9} />
        ) : (
          <BallCollider args={[0.32]} mass={1.1} />
        )}
        <mesh>
          <boxGeometry
            args={anchored ? [0.44, 0.44, 0.44] : [0.54, 0.54, 0.54]}
          />
          <meshStandardMaterial
            color={anchored ? "#7dd3fc" : "#f6c453"}
            roughness={anchored ? 0.42 : 0.38}
          />
        </mesh>
      </RigidBody>
    </>
  );
}

function KinematicModel() {
  const { scene } = useClonedModel("/models/hero.glb");
  const body = useRef<RapierRigidBody>(null);
  const elapsed = useRef(0);
  useBeforePhysicsStep((world) => {
    elapsed.current += world.timestep;
    body.current?.setNextKinematicTranslation(
      readKinematicSweep(elapsed.current),
    );
  });
  return (
    <RigidBody
      ref={body}
      name="example.physics.model"
      type="kinematicPosition"
      colliders="cuboid"
      position={[2.52, -1.32, -0.7]}
      rotation={[0, -0.42, 0]}
    >
      <primitive object={scene} scale={0.08} dispose={null} />
    </RigidBody>
  );
}

export function PhysicsStage() {
  return (
    <>
      <RigidBody
        type="fixed"
        name="example.physics.floor"
        colliders={false}
        position={[0.4, -1.82, -0.7]}
      >
        <CuboidCollider args={[3.8, 0.025, 2.1]} position={[0, -0.025, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.6, 4.2]} />
          <meshStandardMaterial color="#1f3531" roughness={0.74} />
        </mesh>
      </RigidBody>
      <DraggableCrate />
      <DraggableCrate inertia />
      <SpringBody anchored />
      <SpringBody />
      <RigidBody
        type="fixed"
        name="example.physics.bumper"
        position={[-0.84, -1.12, -0.7]}
      >
        <mesh>
          <boxGeometry args={[0.58, 1.5, 0.72]} />
          <meshStandardMaterial color="#94663f" roughness={0.66} />
        </mesh>
      </RigidBody>
      {[-3.3, -0.4].map((x, index) => (
        <RigidBody
          key={x}
          type="fixed"
          name={`example.physics.${index === 0 ? "left" : "right"}Wall`}
          position={[x, -1.16, 0.24]}
        >
          <mesh>
            <boxGeometry args={[0.32, 1.4, 0.8]} />
            <meshStandardMaterial color="#4f5f5b" roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <KinematicModel />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export function ManagedPhysicsExample() {
  const viewport = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="example-row example-physics-dogfood">
      <div className="example-physics-copy">
        <p className="example-kicker">Rapier dynamics</p>
        <h2>Scene-native physics</h2>
        <p>
          Rapier
          模拟固定、动态和运动学刚体。蓝色和黄色方块通过弹簧约束持续运动，模型往复扫动。拖动并释放橙色箱子或红色方块，检查重力、墙面与地面碰撞和释放惯性。
        </p>
        <ul className="example-physics-coverage" aria-label="Physics coverage">
          {[
            "static/dynamic/kinematic",
            "plane/box/sphere/bounds",
            "anchor + spring",
            "pointerDrag",
            "collision + inertia",
            "stage + model physics",
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
      <View
        ref={viewport}
        className="example-physics-viewport"
        aria-hidden="true"
        style={{ touchAction: "none" }}
      >
        <PerspectiveCamera
          makeDefault
          position={[0.4, 1.18, 5.6]}
          fov={40}
          near={0.01}
          far={100}
          onUpdate={(camera) => camera.lookAt(0.4, -1.04, -0.7)}
        />
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Physics
              gravity={[0, -9.81, 0]}
              timeStep={1 / 60}
              paused={!visible}
            >
              <PhysicsStage />
            </Physics>
          </Suspense>
        </ErrorBoundary>
        <ambientLight intensity={0.81} />
        <directionalLight intensity={1} position={[1, 1.5, 2]} />
        <pointLight
          color="#f6c453"
          // World positions are scaled by 1/100; inverse-square power scales by 1/10000.
          intensity={2.2 / 100 ** 2}
          position={[-1.2, 1.7, 1.9]}
        />
      </View>
    </section>
  );
}
