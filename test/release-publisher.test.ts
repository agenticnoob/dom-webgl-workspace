import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { publishPackages } from "../scripts/release-publisher.mjs";

const version = "0.1.0-alpha.0";

describe("idempotent release publisher", () => {
  test("publishes missing packages in core then adapters order", () => {
    const fixture = createRegistryFixture();

    const result = publishPackages({
      version,
      packages: releasePackages(),
      runCommand: fixture.runCommand,
    });

    expect(result).toEqual([
      { name: "@viselora/dom-webgl", action: "published" },
      { name: "@viselora/scroll-adapters", action: "published" },
    ]);
    expect(fixture.publishNames()).toEqual([
      "@viselora/dom-webgl",
      "@viselora/scroll-adapters",
    ]);
  });

  test("skips packages whose published metadata and integrity match", () => {
    const fixture = createRegistryFixture(registryPackages());

    const result = publishPackages({
      version,
      packages: releasePackages(),
      runCommand: fixture.runCommand,
    });

    expect(result.every(({ action }) => action === "skipped")).toBe(true);
    expect(fixture.publishNames()).toEqual([]);
  });

  test("rejects an existing version with different integrity before publishing", () => {
    const existing = registryPackages();
    existing["@viselora/dom-webgl"].dist.integrity = "sha512-other";
    const fixture = createRegistryFixture(existing);

    expect(() =>
      publishPackages({
        version,
        packages: releasePackages(),
        runCommand: fixture.runCommand,
      }),
    ).toThrow(/integrity mismatch/i);
    expect(fixture.publishNames()).toEqual([]);
  });

  test("rejects invalid local ESM exports before querying or publishing", () => {
    const packages = releasePackages();
    packages[0].manifest.exports["."].import = "./src/index.ts";
    const fixture = createRegistryFixture();

    expect(() =>
      publishPackages({ version, packages, runCommand: fixture.runCommand }),
    ).toThrow(/local package exports mismatch/i);
    expect(fixture.commands).toEqual([]);
  });

  test("validates the second local package before any registry query", () => {
    const packages = releasePackages();
    packages[1].manifest.exports["."].import = "./src/index.ts";
    const fixture = createRegistryFixture();

    expect(() =>
      publishPackages({ version, packages, runCommand: fixture.runCommand }),
    ).toThrow(/local package exports mismatch/i);
    expect(fixture.commands).toEqual([]);
  });

  test("does not publish missing core when existing adapters conflict", () => {
    const existing = registryPackages();
    existing["@viselora/scroll-adapters"].dist.integrity = "sha512-other";
    const fixture = createRegistryFixture({
      "@viselora/scroll-adapters": existing["@viselora/scroll-adapters"],
    });

    expect(() =>
      publishPackages({
        version,
        packages: releasePackages(),
        runCommand: fixture.runCommand,
      }),
    ).toThrow(/integrity mismatch/i);
    expect(fixture.publishNames()).toEqual([]);
  });

  test("retry skips matching core and publishes only missing adapters", () => {
    const all = registryPackages();
    const fixture = createRegistryFixture({
      "@viselora/dom-webgl": all["@viselora/dom-webgl"],
    });

    const result = publishPackages({
      version,
      packages: releasePackages(),
      runCommand: fixture.runCommand,
    });

    expect(result).toEqual([
      { name: "@viselora/dom-webgl", action: "skipped" },
      { name: "@viselora/scroll-adapters", action: "published" },
    ]);
    expect(fixture.publishNames()).toEqual(["@viselora/scroll-adapters"]);
  });

  test.each([
    ["exports", (state: RegistryState) => {
      state["@viselora/dom-webgl"].exports["."].import = "./src/index.ts";
    }],
    ["dependency", (state: RegistryState) => {
      state["@viselora/scroll-adapters"].dependencies!["@viselora/dom-webgl"] = "*";
    }],
    ["alpha dist-tag", (_state: RegistryState, tags: TagsState) => {
      tags["@viselora/scroll-adapters"].alpha = "0.1.0-alpha.9";
    }],
  ])("rejects final registry %s mismatch", (_name, mutate) => {
    const existing = registryPackages();
    const tags = registryTags();
    mutate(existing, tags);
    const fixture = createRegistryFixture(existing, tags);

    expect(() =>
      publishPackages({
        version,
        packages: releasePackages(),
        runCommand: fixture.runCommand,
      }),
    ).toThrow(/mismatch/i);
  });

  test("never constructs unpublish, force, or overwrite commands", () => {
    const fixture = createRegistryFixture();

    publishPackages({
      version,
      packages: releasePackages(),
      runCommand: fixture.runCommand,
    });

    const commands = fixture.commands.join("\n");
    expect(commands).not.toMatch(/unpublish|--force|overwrite/i);
    expect(commands).toContain("--access public --tag alpha --provenance");
  });

  test("rejects status-zero publish output that does not confirm the package", () => {
    const fixture = createRegistryFixture();
    const logs: string[] = [];
    const runCommand = (command: string, args: string[]) => {
      if (command === "npm" && args[0] === "publish") {
        return {
          status: 0,
          stdout: "npm notice package archive prepared",
          stderr: "npm notice Publishing to registry",
        };
      }
      return fixture.runCommand(command, args);
    };

    expect(() =>
      publishPackages({
        version,
        packages: releasePackages(),
        runCommand,
        log: (message) => logs.push(message),
      }),
    ).toThrow(/publish output did not confirm @viselora\/dom-webgl@0\.1\.0-alpha\.0/i);
    expect(logs.join("\n")).toContain("npm notice package archive prepared");
    expect(logs.join("\n")).toContain("npm notice Publishing to registry");
  });
});

type RegistryPackage = {
  name: string;
  version: string;
  exports: Record<string, { types: string; import: string }>;
  dependencies?: Record<string, string>;
  dist: { integrity: string };
};

type RegistryState = Record<string, RegistryPackage>;
type TagsState = Record<string, { alpha: string }>;

function releasePackages() {
  return [
    {
      name: "@viselora/dom-webgl",
      tarballPath: resolve("/tmp/viselora-dom-webgl.tgz"),
      integrity: "sha512-core",
      manifest: manifest("@viselora/dom-webgl"),
    },
    {
      name: "@viselora/scroll-adapters",
      tarballPath: resolve("/tmp/viselora-scroll-adapters.tgz"),
      integrity: "sha512-adapters",
      manifest: manifest("@viselora/scroll-adapters", {
        "@viselora/dom-webgl": version,
      }),
    },
  ];
}

function manifest(name: string, dependencies?: Record<string, string>) {
  return {
    name,
    version,
    type: "module",
    exports: {
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./react": { types: "./dist/react.d.ts", import: "./dist/react.js" },
    },
    ...(dependencies ? { dependencies } : {}),
  };
}

function registryPackages(): RegistryState {
  return Object.fromEntries(
    releasePackages().map((entry) => [
      entry.name,
      {
        ...entry.manifest,
        exports: structuredClone(entry.manifest.exports),
        dependencies: structuredClone(entry.manifest.dependencies ?? {}),
        dist: { integrity: entry.integrity },
      },
    ]),
  );
}

function registryTags(): TagsState {
  return {
    "@viselora/dom-webgl": { alpha: version },
    "@viselora/scroll-adapters": { alpha: version },
  };
}

function createRegistryFixture(
  initial: RegistryState = {},
  initialTags: TagsState = registryTags(),
) {
  const state = structuredClone(initial);
  const tags = structuredClone(initialTags);
  const packages = releasePackages();
  const commands: string[] = [];

  return {
    commands,
    publishNames: () =>
      commands
        .filter((command) => command.startsWith("npm publish "))
        .map((command) =>
          packages.find(({ tarballPath }) => command.includes(tarballPath))!.name,
        ),
    runCommand(command: string, args: string[]) {
      commands.push([command, ...args].join(" "));
      if (command !== "npm") return { status: 1, stdout: "", stderr: "unexpected" };

      if (args[0] === "publish") {
        const entry = packages.find(({ tarballPath }) => tarballPath === args[1])!;
        state[entry.name] = {
          ...structuredClone(entry.manifest),
          dependencies: structuredClone(entry.manifest.dependencies ?? {}),
          dist: { integrity: entry.integrity },
        };
        tags[entry.name] = { alpha: version };
        return {
          status: 0,
          stdout: `+ ${entry.name}@${version}`,
          stderr: "",
        };
      }

      if (args[0] === "view" && args[2] === "dist-tags") {
        return result(tags[args[1]]);
      }

      const entry = packages.find(({ name }) => `${name}@${version}` === args[1]);
      if (args[0] === "view" && entry) {
        const current = state[entry.name];
        return current
          ? result(current)
          : { status: 1, stdout: "", stderr: "npm ERR! code E404" };
      }

      return { status: 1, stdout: "", stderr: "unexpected npm command" };
    },
  };
}

function result(value: unknown) {
  return { status: 0, stdout: JSON.stringify(value), stderr: "" };
}
