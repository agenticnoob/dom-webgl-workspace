import { OrthographicCamera, View } from "@react-three/drei";
import React, { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  WebGLSection,
  WebGLTarget,
  useWebGLRuntime,
  type WebGLTargetProps,
} from "@viselora/dom-webgl/react";

/**
 * App composition: semantic DOM plus a Drei viewport in the shared Canvas. The
 * visual is a section of its own target, so it pauses while far offscreen.
 */
export function ExampleVisual({
  id,
  children,
  visual,
  retainText = false,
  perspective = false,
}: {
  readonly id: string;
  readonly children: WebGLTargetProps["children"];
  readonly visual: ReactNode;
  readonly retainText?: boolean;
  readonly perspective?: boolean;
}) {
  const runtime = useWebGLRuntime();
  return (
    <div className="example-dom-visual">
      <WebGLTarget id={id} hideWhenReady={!retainText} offscreen="park">
        {children}
      </WebGLTarget>
      <View className="example-dom-view">
        {!perspective && (
          <OrthographicCamera
            makeDefault
            manual
            position={[0, 0, 1]}
            left={-1}
            right={1}
            top={1}
            bottom={-1}
            near={0.01}
            far={10}
          />
        )}
        <ErrorBoundary
          fallback={null}
          onError={() => runtime.setTargetReady(id, false)}
        >
          <WebGLSection target={id}>
            <Suspense fallback={null}>{visual}</Suspense>
          </WebGLSection>
        </ErrorBoundary>
      </View>
    </div>
  );
}
