import http from 'http';
import { mochiProxy } from './index.js';

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    const mockReq = Object.assign(req, {
        path: req.url.split('?')[0],
        query: Object.fromEntries(new URL(req.url, `http://localhost`).searchParams),
        body: {},
        headers: req.headers,
    });

    const mockRes = {
        _headers: {},
        _status: 200,
        set: (key, val) => { mockRes._headers[key] = val; },
        status: (code) => { mockRes._status = code; return mockRes; },
        json: (data) => {
            res.writeHead(mockRes._status, { 'Content-Type': 'application/json', ...mockRes._headers });
            res.end(JSON.stringify(data));
        },
        send: (data) => {
            res.writeHead(mockRes._status, mockRes._headers);
            res.end(data);
        }
    };

    if (req.method === 'OPTIONS') {
        mochiProxy(mockReq, mockRes);
        return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try { mockReq.body = body ? JSON.parse(body) : {}; } catch { mockReq.body = {}; }
        mochiProxy(mockReq, mockRes);
    });
});

server.listen(port, () => {
    console.log(`mochi-proxy listening on port ${port}`);
});
