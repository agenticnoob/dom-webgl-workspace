import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, type RefObject } from "react";
import { Plane, Vector3 } from "three";

export function dragReleaseVelocity(
  previous: Vector3,
  next: Vector3,
  milliseconds: number,
  target = new Vector3(),
): Vector3 {
  target
    .copy(next)
    .sub(previous)
    .divideScalar(Math.max(8, milliseconds) / 1000);
  return target.clampLength(0, 12);
}

export function usePhysicsDrag(body: RefObject<RapierRigidBody | null>) {
  const { rapier } = useRapier();
  const camera = useThree((state) => state.camera);
  const state = useMemo(
    () => ({
      pointer: -1,
      plane: new Plane(),
      normal: new Vector3(),
      offset: new Vector3(),
      point: new Vector3(),
      previous: new Vector3(),
      velocity: new Vector3(),
      time: 0,
    }),
    [],
  );
  const release = (time: number, cancelled = false) => {
    if (state.pointer < 0) return;
    state.pointer = -1;
    const current = body.current;
    if (!current) return;
    current.setBodyType(rapier.RigidBodyType.Dynamic, true);
    if (cancelled || time - state.time > 100) state.velocity.set(0, 0, 0);
    current.setLinvel(state.velocity, true);
  };
  useEffect(() => {
    const up = (event: PointerEvent) => {
      if (event.pointerId === state.pointer) release(event.timeStamp);
    };
    const cancel = () => release(Infinity, true);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, [body, rapier, state]);
  return {
    onPointerDown(event: ThreeEvent<PointerEvent>) {
      if (event.button !== 0 || state.pointer >= 0 || !body.current) return;
      event.stopPropagation();
      state.pointer = event.pointerId;
      state.time = event.timeStamp;
      camera.getWorldDirection(state.normal);
      state.plane.setFromNormalAndCoplanarPoint(state.normal, event.point);
      state.previous.copy(body.current.translation());
      state.offset.copy(state.previous).sub(event.point);
      state.velocity.set(0, 0, 0);
      body.current.setBodyType(
        rapier.RigidBodyType.KinematicPositionBased,
        true,
      );
      const target = event.target;
      if (
        target &&
        "setPointerCapture" in target &&
        typeof target.setPointerCapture === "function"
      )
        target.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ThreeEvent<PointerEvent>) {
      if (
        event.pointerId !== state.pointer ||
        !body.current ||
        !event.ray.intersectPlane(state.plane, state.point)
      )
        return;
      event.stopPropagation();
      state.point.add(state.offset);
      dragReleaseVelocity(
        state.previous,
        state.point,
        event.timeStamp - state.time,
        state.velocity,
      );
      body.current.setNextKinematicTranslation(state.point);
      state.previous.copy(state.point);
      state.time = event.timeStamp;
    },
    onPointerUp(event: ThreeEvent<PointerEvent>) {
      if (event.pointerId !== state.pointer) return;
      event.stopPropagation();
      release(event.timeStamp);
      const target = event.target;
      if (
        target &&
        "releasePointerCapture" in target &&
        typeof target.releasePointerCapture === "function"
      )
        target.releasePointerCapture(event.pointerId);
    },
  };
}
