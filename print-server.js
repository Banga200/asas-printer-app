function startExpressServer() {
  require('dotenv').config();
  const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, execFile, execSync } = require('child_process');

const server = express();
const cors = require('cors');
server.use(cors());
const { app } = require('electron');
const UPLOAD_DIR = path.join(app.getPath('userData'), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR });
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'p9$Xv!2qLr@8Zc#4TgF7^mWbEoJk1sHn'; //
const MAX_FILE_AGE_MS = 5 * 60 * 1000; // 5 minutes

// Middleware: Token verification
server.use((req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

// 🖨 GET /printers
server.get('/printers', (req, res) => {
  const platform = process.platform;
  if (platform === 'win32') {
    exec('wmic printer get Name,Default,Status', (err, stdout) => {
       if (err) return res.status(500).json({ error: err.message });

  const lines = stdout.trim().split('\n').slice(1);
  const printers = lines.map(line => {
    const parts = line.trim().split(/\s{2,}/); // split by 2+ spaces

    if (parts.length < 3) return null;

    return {
      name: parts[1],
      isDefault: parts[0] === 'TRUE',
      status: parts[2] || 'Unknown'
    };
  }).filter(Boolean);

  res.json({ printers });
    });

  } else if (platform === 'darwin' || platform === 'linux') {
    exec('lpstat -a', (err, listOutput) => {
      console.log('linux',err)
      if (err) return res.status(500).json({ error: err.message });

      exec('lpstat -d', (err2, defaultOutput) => {
        const defaultMatch = defaultOutput.match(/system default destination: (.+)/);
        const defaultPrinter = defaultMatch ? defaultMatch[1].trim() : null;

        const printers = listOutput.split('\n')
          .map(line => {
            const name = line.split(' ')[0];
            if (!name) return null;

            return {
              name,
              isDefault: name === defaultPrinter,
              status: 'Available'
            };
          }).filter(Boolean);

        res.json({ printers });
      });
    });

  } else {
    res.status(500).json({ error: 'Unsupported platform' });
  }
});

// 📥 POST /print
server.post('/print', upload.single('file'), (req, res) => {
  const filePath = req.file?.path;
  let {
    printer = null,
    copies = 1,
    duplex = false,
    pageRange = null,
  } = req.query;

  if (!filePath) return res.status(400).json({ error: 'No file uploaded' });

  copies = parseInt(copies);
  duplex = duplex === 'true' || duplex === true;

  const platform = process.platform;

  function done(message) {
    fs.unlink(filePath, () => {});
    res.json({ message });
  }

  if (platform === 'win32') {
    const isDev = !server.isPackaged;
    const basePath = isDev ? __dirname : path.join(process.resourcesPath);
    const sumatraPath = path.join(basePath, 'SumatraPDF.exe');
    if (!fs.existsSync(sumatraPath)) {
      return res.status(500).json({ error: 'SumatraPDF.exe not found' });
    }

    const args = [];

    if (!printer) {
      try {
        const result = execSync('wmic printer where Default="TRUE" get Name').toString();
        const lines = result.split('\n').map(l => l.trim()).filter(Boolean);
        printer = lines[1]; // skip header
      } catch {
        // fallback to default
      }
    }

    if (printer) {
      args.push('-print-to', printer);
    } else {
      args.push('-print-to-default');
    }

    if (pageRange) {
      args.push('-print-settings', `pages=${pageRange}`);
    }

    args.push(filePath);

    execFile(sumatraPath, args, (error) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      } else {
        done('Printed successfully on Windows');
      }
    });

  } else if (platform === 'darwin' || platform === 'linux') {
    const lpArgs = [];

    if (!printer) {
      try {
        const output = execSync('lpstat -d').toString();
        const match = output.match(/system default destination: (.+)/);
        if (match) printer = match[1].trim();
      } catch {
        // fallback
      }
    }

    if (printer) lpArgs.push(`-d "${printer}"`);
    if (copies > 1) lpArgs.push(`-n ${copies}`);
    if (duplex) lpArgs.push(`-o sides=two-sided-long-edge`);
    if (pageRange) lpArgs.push(`-P ${pageRange}`);
    lpArgs.push(`"${filePath}"`);

    const lpCommand = `lp ${lpArgs.join(' ')}`;

    exec(lpCommand, (error) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      } else {
        done('Printed successfully on Unix system');
      }
    });

  } else {
    res.status(500).json({ error: `Unsupported platform: ${platform}` });
  }
});

// 🧹 Auto-delete old files
setInterval(() => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;

    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.ctimeMs > MAX_FILE_AGE_MS) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 60 * 1000); // every 1 minute

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Print server running on http://localhost:${PORT}`);
});

}

module.exports = { startExpressServer };