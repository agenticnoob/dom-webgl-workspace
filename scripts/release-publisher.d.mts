export type ReleaseCommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type ReleaseCommandRunner = (
  command: string,
  args: string[],
) => ReleaseCommandResult;

export type ReleaseManifest = {
  name: string;
  version: string;
  type?: string;
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
};

export type ReleasePackage = {
  name: string;
  tarballPath: string;
  integrity: string;
  manifest: ReleaseManifest;
};

export type ReleaseAction = {
  name: string;
  action: "published" | "skipped";
};

export function publishPackages(options: {
  version: string;
  packages: ReleasePackage[];
  runCommand: ReleaseCommandRunner;
  log?: (message: string) => void;
}): ReleaseAction[];

export function publishRelease(options: {
  root?: string;
  version: string;
  runCommand?: ReleaseCommandRunner;
  log?: (message: string) => void;
  createTarballs?: (root: string) => {
    packages: Array<{
      name: string;
      integrity: string;
      tarballPath: string;
      packageDirectory: string;
    }>;
    cleanup(): void;
  };
}): ReleaseAction[];
