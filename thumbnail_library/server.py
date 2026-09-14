"""Read-only loopback server exposing only the gallery and imported images."""
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


def serve(project, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
                self.send_error(403)
                return
            path = urlsplit(self.path).path
            mime = 'application/octet-stream'
            if path == '/api/library':
                manifest = project / 'data' / 'manifest.json'
                content = manifest.read_bytes() if manifest.exists() else json.dumps({'images': [], 'sources': []}).encode()
                mime = 'application/json'
            else:
                routes = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
                if path in routes:
                    name, mime = routes[path]
                    file = project / 'web' / name
                elif re.fullmatch(r'/media/(images|previews)/[a-f0-9]{64}\.(jpg|png|webp|gif|avif)', path):
                    file = project / 'data' / path.removeprefix('/media/')
                    mime = {'jpg': 'image/jpeg', 'png':'image/png', 'webp':'image/webp', 'gif':'image/gif', 'avif':'image/avif'}[file.suffix[1:]]
                else:
                    self.send_error(404)
                    return
                if not file.is_file():
                    self.send_error(404)
                    return
                content = file.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, format, *args):
            if len(args) > 1 and str(args[1]) != '200':
                super().log_message(format, *args)

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Thumbnail Library: http://127.0.0.1:{port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
