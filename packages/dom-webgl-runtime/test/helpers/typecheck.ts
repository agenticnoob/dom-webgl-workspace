import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import ts from "typescript";

const typecheckLockDir = resolve(
  tmpdir(),
  "dom-webgl-runtime-typecheck.lock",
);
const staleLockMs = 120_000;
const retryLockMs = 50;

export async function withTypecheckLock<T>(run: () => T): Promise<T> {
  const release = await acquireTypecheckLock();

  try {
    return run();
  } finally {
    release();
  }
}

export function getFixtureDiagnostics(
  program: ts.Program,
  fixturePath: string,
): readonly ts.Diagnostic[] {
  const fixture = program.getSourceFile(fixturePath);
  if (!fixture) {
    return [
      {
        category: ts.DiagnosticCategory.Error,
        code: 0,
        file: undefined,
        start: undefined,
        length: undefined,
        messageText: `Missing typecheck fixture: ${fixturePath}`,
      },
    ];
  }

  return ts.getPreEmitDiagnostics(program, fixture);
}

async function acquireTypecheckLock(): Promise<() => void> {
  while (!tryAcquireTypecheckLock()) {
    await sleep(retryLockMs);
  }

  return () => {
    rmSync(typecheckLockDir, { recursive: true, force: true });
  };
}

function tryAcquireTypecheckLock(): boolean {
  try {
    mkdirSync(typecheckLockDir);
    return true;
  } catch (error: unknown) {
    if (!isFileExistsError(error)) {
      throw error;
    }

    if (isStaleLock()) {
      rmSync(typecheckLockDir, { recursive: true, force: true });
    }

    return false;
  }
}

function isStaleLock(): boolean {
  try {
    const stat = statSync(typecheckLockDir);

    return Date.now() - stat.mtimeMs > staleLockMs;
  } catch {
    return false;
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, durationMs);
  });
}
