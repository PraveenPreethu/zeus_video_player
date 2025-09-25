const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const METADATA_FILE = path.join(DATA_DIR, 'videos.json');

function ensureEnvironment() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, '[]', 'utf8');
  }
}

function readMetadata() {
  try {
    const raw = fs.readFileSync(METADATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read metadata file:', error);
    return [];
  }
}

function writeMetadata(data) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.connection.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function handleUpload(body) {
  const { title, description, originalName, folder, data } = body;

  if (!title || !description || !originalName || !data) {
    const missing = ['title', 'description', 'originalName', 'data'].filter((key) => !body[key]);
    return {
      error: true,
      status: 400,
      message: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  const extension = path.extname(originalName) || '.mp4';
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  try {
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buffer);
  } catch (error) {
    console.error('Failed to save uploaded file:', error);
    return {
      error: true,
      status: 500,
      message: 'Failed to save uploaded file.',
    };
  }

  const metadata = readMetadata();
  const entry = {
    id: randomUUID(),
    title,
    description,
    folder: folder || 'Unsorted',
    originalName,
    fileName,
    url: `/uploads/${fileName}`,
    createdAt: new Date().toISOString(),
  };

  metadata.push(entry);
  writeMetadata(metadata);

  return {
    error: false,
    status: 201,
    payload: entry,
  };
}

ensureEnvironment();

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = req.url || '/';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (method === 'GET' && url === '/api/videos') {
    const metadata = readMetadata();
    sendJson(res, 200, metadata);
    return;
  }

  if (method === 'POST' && url === '/api/videos') {
    try {
      const body = await parseRequestBody(req);
      const result = handleUpload(body);
      if (result.error) {
        sendJson(res, result.status, { message: result.message });
        return;
      }

      const entry = result.payload;
      sendJson(res, result.status, entry);
    } catch (error) {
      console.error('Upload request failed:', error);
      sendJson(res, 400, { message: 'Invalid request payload.' });
    }
    return;
  }

  if (method === 'GET' && url.startsWith('/uploads/')) {
    const relativePath = path.normalize(url.replace('/uploads/', ''));
    const filePath = path.resolve(UPLOAD_DIR, relativePath);
    const uploadRootWithSeparator = `${UPLOAD_DIR}${path.sep}`;
    if (!(filePath === UPLOAD_DIR || filePath.startsWith(uploadRootWithSeparator))) {
      sendJson(res, 400, { message: 'Invalid file path.' });
      return;
    }

    serveFile(res, filePath);
    return;
  }

  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Video upload server listening on http://${HOST}:${PORT}`);
});
