import { spawn } from 'node:child_process';

export async function hasRg(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('rg', ['--version'], { windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export async function runRg(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('rg', args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => reject(error as Error));
    child.on('close', (code) => {
      if (code === 0 || code === 1) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `rg exited with code ${code}`));
    });
  });
}

export async function runRgPathFilter(options: {
  cwd: string;
  listArgs: string[];
  filterArgs: string[];
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const listChild = spawn('rg', options.listArgs, { cwd: options.cwd, windowsHide: true });
    const filterChild = spawn('rg', options.filterArgs, { cwd: options.cwd, windowsHide: true });
    let stdout = '';
    let listStderr = '';
    let filterStderr = '';
    let settled = false;
    let listClosed = false;
    let filterClosed = false;
    let listCode: number | null = null;
    let filterCode: number | null = null;

    function settleWithError(error: Error): void {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    }

    function maybeResolve(): void {
      if (settled || !listClosed || !filterClosed) {
        return;
      }

      if (listCode !== 0) {
        settleWithError(new Error(listStderr || `rg --files exited with code ${listCode}`));
        return;
      }

      if (filterCode === 0 || filterCode === 1) {
        settled = true;
        resolve(stdout);
        return;
      }

      settleWithError(new Error(filterStderr || `rg filter exited with code ${filterCode}`));
    }

    listChild.stdout.pipe(filterChild.stdin);
    filterChild.stdin.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EPIPE') {
        settleWithError(error as Error);
      }
    });
    filterChild.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    listChild.stderr.on('data', (chunk) => {
      listStderr += String(chunk);
    });
    filterChild.stderr.on('data', (chunk) => {
      filterStderr += String(chunk);
    });
    listChild.on('error', (error) => settleWithError(error as Error));
    filterChild.on('error', (error) => settleWithError(error as Error));
    listChild.on('close', (code) => {
      listClosed = true;
      listCode = code;
      maybeResolve();
    });
    filterChild.on('close', (code) => {
      filterClosed = true;
      filterCode = code;
      maybeResolve();
    });
  });
}
