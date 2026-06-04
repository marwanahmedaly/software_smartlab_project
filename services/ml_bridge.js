const { spawn } = require('child_process');
const path = require('path');

const PYTHON = 'python3';
const SCRIPT = path.join(__dirname, 'ml_predictor.py');

/**
 * Runs the Python ML predictor and returns parsed JSON.
 * @param {'train'|'predict'} mode
 */
function runModel(mode = 'predict') {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT, mode], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited ${code}: ${stderr || stdout}`));
      }
      try {
        // Extract JSON from stdout (find first { to last })
        const start = stdout.indexOf('{');
        const end = stdout.lastIndexOf('}');
        const jsonStr = (start !== -1 && end !== -1 && end > start)
          ? stdout.slice(start, end + 1)
          : stdout;
        const result = JSON.parse(jsonStr);
        resolve(result);
      } catch (e) {
        reject(new Error(`Invalid JSON from Python: ${stdout}\n${stderr}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

module.exports = { runModel };
