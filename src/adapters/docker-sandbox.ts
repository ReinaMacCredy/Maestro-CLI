/**
 * Docker sandbox adapter for maestroCLI.
 * Forked from hive-core/src/services/dockerSandboxService.ts -- direct copy.
 * SandboxConfig type moved to types.ts.
 */

import { existsSync } from 'fs';
import { join, sep } from 'path';
import { execSync } from 'child_process';
import type { SandboxConfig } from '../types.ts';

/** POSIX single-quote escaping: wraps in single quotes, escapes embedded quotes. */
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export class DockerSandboxAdapter {
  static detectImage(projectPath: string): string | null {
    if (existsSync(join(projectPath, 'Dockerfile'))) {
      return null;
    }
    if (existsSync(join(projectPath, 'package.json'))) {
      return 'node:22-slim';
    }
    if (existsSync(join(projectPath, 'requirements.txt')) ||
        existsSync(join(projectPath, 'pyproject.toml'))) {
      return 'python:3.12-slim';
    }
    if (existsSync(join(projectPath, 'go.mod'))) {
      return 'golang:1.22-slim';
    }
    if (existsSync(join(projectPath, 'Cargo.toml'))) {
      return 'rust:1.77-slim';
    }
    return 'ubuntu:24.04';
  }

  static buildRunCommand(projectPath: string, command: string, image: string): string {
    return `docker run --rm -v ${shellQuote(projectPath)}:/app -w /app ${shellQuote(image)} sh -c ${shellQuote(command)}`;
  }

  static containerName(projectPath: string): string {
    const parts = projectPath.split(sep);
    const projectDir = parts[parts.length - 1] || 'project';
    const name = `maestro-sandbox-${projectDir}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return name.slice(0, 63);
  }

  static ensureContainer(projectPath: string, image: string): string {
    const name = this.containerName(projectPath);

    try {
      execSync(`docker inspect --format='{{.State.Running}}' ${shellQuote(name)}`, { stdio: 'pipe' });
      return name;
    } catch {
      execSync(
        `docker run -d --name ${shellQuote(name)} -v ${shellQuote(projectPath)}:/app -w /app ${shellQuote(image)} tail -f /dev/null`,
        { stdio: 'pipe' }
      );
      return name;
    }
  }

  static buildExecCommand(containerName: string, command: string): string {
    return `docker exec ${shellQuote(containerName)} sh -c ${shellQuote(command)}`;
  }

  static stopContainer(projectPath: string): void {
    const name = this.containerName(projectPath);
    try {
      execSync(`docker rm -f ${shellQuote(name)}`, { stdio: 'ignore' });
    } catch {
      // Container may not exist
    }
  }

  static isDockerAvailable(): boolean {
    try {
      execSync('docker info', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  static wrapCommand(projectPath: string, command: string, config: SandboxConfig): string {
    if (command.startsWith('HOST: ')) {
      return command.substring(6);
    }

    if (config.mode === 'none') {
      return command;
    }

    let image: string | null;

    if (config.image) {
      image = config.image;
    } else {
      image = this.detectImage(projectPath);
      if (image === null) {
        return command;
      }
    }

    if (config.persistent) {
      const containerName = this.ensureContainer(projectPath, image);
      return this.buildExecCommand(containerName, command);
    } else {
      return this.buildRunCommand(projectPath, command, image);
    }
  }
}
