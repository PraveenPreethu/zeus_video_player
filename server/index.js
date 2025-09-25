const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const METADATA_FILE = path.join(DATA_DIR, 'videos.json');

const DEFAULT_AZURE_CONTAINER_SAS_URL =
  'https://zeusvideos.blob.core.windows.net/zeusvideos?sp=racwdl&st=2025-09-25T04:14:06Z&se=2026-09-25T12:29:06Z&spr=https&sv=2024-11-04&sr=c&sig=94DrfYtVMAA1VWmR8nkuCK%2FAvv1kxcJRjRNwZdv8mGY%3D';

const azureConfig = initializeAzureConfig(
  process.env.AZURE_CONTAINER_SAS_URL || DEFAULT_AZURE_CONTAINER_SAS_URL,
);

function initializeAzureConfig(sasUrl) {
  if (!sasUrl) {
    console.warn('Azure Blob Storage SAS URL is not configured.');
    return null;
  }

  try {
    const parsed = new URL(sasUrl);
    if (!parsed.search) {
      console.warn('Azure Blob Storage SAS URL is missing the SAS query string.');
    }

    const basePath = parsed.pathname.replace(/\/$/, '');
    return {
      baseUrl: `${parsed.origin}${basePath}`,
      query: parsed.search,
    };
  } catch (error) {
    console.error('Invalid Azure Blob Storage SAS URL provided:', error);
    return null;
  }
}

function buildAzureBlobUrl(blobName) {
  if (!azureConfig) {
    throw new Error('Azure Blob Storage is not configured.');
  }

  const encodedName = encodeURIComponent(blobName);
  return `${azureConfig.baseUrl}/${encodedName}${azureConfig.query}`;
}

async function uploadToAzureBlob(blobName, buffer, mimeType) {
  const blobUrl = buildAzureBlobUrl(blobName);
  const response = await fetch(blobUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-version': '2022-11-02',
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
    },
    body: buffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure Blob upload failed with status ${response.status}: ${text}`);
  }

  return blobUrl;
}

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

const VIDEO_MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
};

function resolveMimeType(extension, providedMime) {
  if (providedMime && typeof providedMime === 'string' && providedMime.trim()) {
    return providedMime;
  }

  const normalized = extension.toLowerCase();
  return VIDEO_MIME_TYPES[normalized] || 'application/octet-stream';
}

async function handleUpload(body) {
  const { title, description, originalName, folder, data, mimeType } = body;

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
  const mime = resolveMimeType(extension, mimeType);

  if (!azureConfig) {
    console.error('Azure Blob Storage is not configured. Unable to upload file.');
    return {
      error: true,
      status: 500,
      message: 'File storage service is not configured.',
    };
  }

  let blobUrl;
  try {
    const buffer = Buffer.from(data, 'base64');
    blobUrl = await uploadToAzureBlob(fileName, buffer, mime);
  } catch (error) {
    console.error('Failed to upload file to Azure Blob Storage:', error);
    return {
      error: true,
      status: 502,
      message: 'Failed to store uploaded file.',
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
    url: blobUrl,
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
      const result = await handleUpload(body);
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
    const rawPath = url.slice('/uploads/'.length);
    let decodedPath = '';
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch (error) {
      console.warn('Failed to decode upload path:', error);
      sendJson(res, 400, { message: 'Invalid file path.' });
      return;
    }

    const normalizedPath = decodedPath.replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalizedPath || normalizedPath.includes('..')) {
      sendJson(res, 400, { message: 'Invalid file path.' });
      return;
    }

    if (azureConfig) {
      try {
        const redirectUrl = buildAzureBlobUrl(normalizedPath);
        res.writeHead(302, {
          Location: redirectUrl,
          'Access-Control-Allow-Origin': '*',
        });
        res.end();
      } catch (error) {
        console.error('Failed to build Azure Blob redirect URL:', error);
        sendJson(res, 500, { message: 'Unable to resolve stored file location.' });
      }
      return;
    }

    const filePath = path.resolve(UPLOAD_DIR, normalizedPath);
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
