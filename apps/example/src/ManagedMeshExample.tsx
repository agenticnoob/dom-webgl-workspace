import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  HalfFloatType,
  PerspectiveCamera as ThreePerspectiveCamera,
  Vector2,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FilmShader } from "three/addons/shaders/FilmShader.js";
import { HorizontalBlurShader } from "three/addons/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/addons/shaders/VerticalBlurShader.js";

export function ManagedMeshExample() {
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <section className="example-row example-stage-dogfood">
      <div className="example-stage-copy">
        <p className="example-kicker">R3F stage</p>
        <h2>声明式灯光和舞台几何</h2>
        <p>
          同一张 runtime canvas 里，Drei View 按 DOM rect 裁剪；Three.js
          EffectComposer 为这个舞台添加 grain、blur 和 bloom。
        </p>
      </div>
      {/* The composer renders this view; skip Drei's unprocessed scene pass. */}
      <View
        visible={false}
        ref={viewport}
        className="example-stage-viewport"
        aria-hidden="true"
      >
        <PerspectiveCamera
          makeDefault
          position={[0, 120, 520]}
          fov={45}
          near={0.1}
          far={5000}
          onUpdate={(camera) => camera.lookAt(0, -80, 0)}
        />
        <ManagedMeshScene />
        <StagePostprocessing viewport={viewport} />
      </View>
    </section>
  );
}

export function ManagedMeshScene() {
  return (
    <>
      <mesh
        name="example.stage.floor"
        position={[0, -180, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[900, 520]} />
        <meshStandardMaterial color="#0f172a" roughness={0.64} />
      </mesh>
      <mesh name="example.stage.backdrop" position={[0, 20, -260]}>
        <planeGeometry args={[900, 420]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.48} />
      </mesh>
      <mesh name="example.stage.plinth" position={[0, -128, -40]}>
        <boxGeometry args={[180, 96, 180]} />
        <meshStandardMaterial color="#f6c453" roughness={0.38} />
      </mesh>
      <mesh name="example.stage.bloomRail" position={[0, -34, -236]}>
        <boxGeometry args={[520, 18, 22]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh name="example.stage.tetrahedron" position={[180, -82, -40]}>
        <tetrahedronGeometry args={[72]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.28} />
      </mesh>
      <ambientLight intensity={0.83} />
      <directionalLight intensity={1} position={[1, 1.5, 2]} />
      <pointLight color="#7dd3fc" intensity={2.6} position={[120, 80, 160]} />
      <pointLight color="#fef3c7" intensity={1.9} position={[-220, -12, 120]} />
    </>
  );
}

function StagePostprocessing({
  viewport,
}: {
  readonly viewport: RefObject<HTMLDivElement | null>;
}) {
  const { gl, scene, camera } = useThree();
  const state = useMemo(() => {
    const composer = new EffectComposer(
      gl,
      new WebGLRenderTarget(1, 1, { type: HalfFloatType }),
    );
    const render = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.88, 0.58, 0.18);
    const horizontal = new ShaderPass(HorizontalBlurShader);
    const vertical = new ShaderPass(VerticalBlurShader);
    const grain = new ShaderPass(FilmShader);
    grain.uniforms.intensity.value = 0.2;
    const output = new OutputPass();
    const passes = [render, bloom, horizontal, vertical, grain, output];
    passes.forEach((pass) => composer.addPass(pass));
    return {
      composer,
      passes,
      horizontal,
      vertical,
      grain,
      size: new Vector2(),
      viewport: new Vector4(),
      scissor: new Vector4(),
    };
  }, [gl, scene, camera]);
  useEffect(
    () => () => {
      state.passes.forEach((pass) => pass.dispose());
      state.composer.dispose();
    },
    [state],
  );
  useFrame((_, delta) => {
    const rect = viewport.current?.getBoundingClientRect();
    const canvas = gl.domElement.getBoundingClientRect();
    if (
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom < canvas.top ||
      rect.top > canvas.bottom
    )
      return;
    if (
      camera instanceof ThreePerspectiveCamera &&
      camera.aspect !== rect.width / rect.height
    ) {
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }
    if (state.size.x !== rect.width || state.size.y !== rect.height) {
      state.size.set(rect.width, rect.height);
      state.composer.setSize(rect.width, rect.height);
      state.horizontal.uniforms.h.value = 0.12 / rect.width;
      state.vertical.uniforms.v.value = 0.12 / rect.height;
    }
    const target = gl.getRenderTarget();
    const scissorTest = gl.getScissorTest();
    gl.getViewport(state.viewport);
    gl.getScissor(state.scissor);
    gl.setViewport(
      rect.left - canvas.left,
      canvas.bottom - rect.bottom,
      rect.width,
      rect.height,
    );
    gl.setScissor(
      rect.left - canvas.left,
      canvas.bottom - rect.bottom,
      rect.width,
      rect.height,
    );
    gl.setScissorTest(true);
    state.grain.uniforms.time.value += delta;
    state.composer.render(delta);
    gl.setRenderTarget(target);
    gl.setViewport(state.viewport);
    gl.setScissor(state.scissor);
    gl.setScissorTest(scissorTest);
  }, 2);
  return null;
}
