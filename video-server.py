#!/usr/bin/env python3
"""
Ultrasound Tongue DB — Local Video Server
Serves video files from a local directory, providing unlimited storage capacity.

Usage:
  python3 video-server.py [--port 8765] [--dir /path/to/videos]

Endpoints:
  GET  /api/status        - Server status + disk info
  POST /api/upload        - Upload a video file
  POST /api/delete        - Delete a video file
  GET  /videos/<filename> - Serve a video file

The server enables truly unlimited video storage — limited only by disk space.
Run this on the same machine as the web app for full functionality.
"""

import http.server
import json
import os
import shutil
import cgi
import argparse
import signal
import sys
from urllib.parse import unquote, quote

VIDEO_DIR = None  # Set at startup


def get_disk_free(path):
    """Get free disk space in human-readable format."""
    try:
        stat = os.statvfs(path)
        free_bytes = stat.f_frsize * stat.f_bavail
        if free_bytes < 1024 * 1024:
            return f"{free_bytes / 1024:.1f} KB"
        elif free_bytes < 1024 * 1024 * 1024:
            return f"{free_bytes / (1024 * 1024):.0f} MB"
        else:
            return f"{free_bytes / (1024 * 1024 * 1024):.1f} GB"
    except Exception:
        return "unknown"


def send_json(handler, data, status=200):
    """Send JSON response with CORS headers."""
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.end_headers()
    handler.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))


class VideoServer(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = unquote(self.path)

        # API: status
        if path == '/api/status':
            disk_free = get_disk_free(VIDEO_DIR)
            file_count = len([f for f in os.listdir(VIDEO_DIR) if os.path.isfile(os.path.join(VIDEO_DIR, f))])
            send_json(self, {
                'status': 'ok',
                'server': 'ultrasound-tongue-db-video-server',
                'disk_free': disk_free,
                'file_count': file_count,
                'video_dir': VIDEO_DIR,
                'unlimited': True
            })
            return

        # Serve video files from /videos/
        if path.startswith('/videos/'):
            filename = path[len('/videos/'):]
            filepath = os.path.join(VIDEO_DIR, filename)
            # Security: prevent path traversal
            real_path = os.path.realpath(filepath)
            if not real_path.startswith(os.path.realpath(VIDEO_DIR)):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b'Forbidden')
                return
            if not os.path.isfile(filepath):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'File not found')
                return

            # Determine content type
            ext = os.path.splitext(filename)[1].lower()
            content_types = {
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.avi': 'video/x-msvideo',
                '.mov': 'video/quicktime',
                '.mkv': 'video/x-matroska',
                '.m4v': 'video/mp4',
                '.flv': 'video/x-flv',
                '.wmv': 'video/x-ms-wmv',
                '.mpg': 'video/mpeg',
                '.mpeg': 'video/mpeg',
                '.ogv': 'video/ogg',
                '.3gp': 'video/3gpp',
                '.ts': 'video/mp2t',
            }
            content_type = content_types.get(ext, 'application/octet-stream')

            file_size = os.path.getsize(filepath)
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(file_size))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            with open(filepath, 'rb') as f:
                shutil.copyfileobj(f, self.wfile)
            return

        # 404 for everything else
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b'Not found')

    def do_POST(self):
        path = unquote(self.path)

        # API: upload
        if path == '/api/upload':
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                send_json(self, {'error': 'Expected multipart/form-data'}, 400)
                return

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type}
            )

            if 'file' not in form:
                send_json(self, {'error': 'No file field'}, 400)
                return

            file_item = form['file']
            filename = os.path.basename(file_item.filename)
            if not filename:
                send_json(self, {'error': 'No filename'}, 400)
                return

            # Delete old file if editing
            old_path = form.getvalue('oldPath', '')
            if old_path:
                old_filepath = os.path.join(VIDEO_DIR, os.path.basename(old_path))
                if os.path.isfile(old_filepath):
                    os.remove(old_filepath)

            # Save new file
            filepath = os.path.join(VIDEO_DIR, filename)
            # Handle duplicates
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(filepath):
                filepath = os.path.join(VIDEO_DIR, f"{base}_{counter}{ext}")
                counter += 1

            with open(filepath, 'wb') as f:
                f.write(file_item.file.read())

            saved_name = os.path.basename(filepath)
            file_size = os.path.getsize(filepath)
            send_json(self, {
                'status': 'ok',
                'path': saved_name,
                'size': file_size,
                'url': f'/videos/{quote(saved_name)}'
            })
            return

        # API: delete
        if path == '/api/delete':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                data = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError:
                send_json(self, {'error': 'Invalid JSON'}, 400)
                return

            video_path = data.get('path', '')
            if not video_path:
                send_json(self, {'error': 'No path provided'}, 400)
                return

            filename = os.path.basename(video_path)
            filepath = os.path.join(VIDEO_DIR, filename)
            if os.path.isfile(filepath):
                os.remove(filepath)
                send_json(self, {'status': 'ok', 'deleted': filename})
            else:
                send_json(self, {'status': 'not_found', 'path': filename})
            return

        # 404
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b'Not found')


def main():
    parser = argparse.ArgumentParser(description='Ultrasound Tongue DB Video Server')
    parser.add_argument('--port', type=int, default=8765, help='Server port (default: 8765)')
    parser.add_argument('--dir', type=str, default=None, help='Video directory path')
    args = parser.parse_args()

    global VIDEO_DIR

    if args.dir:
        VIDEO_DIR = os.path.abspath(args.dir)
    else:
        # Default: ~/ultrasound-videos/
        VIDEO_DIR = os.path.expanduser('~/ultrasound-videos')

    os.makedirs(VIDEO_DIR, exist_ok=True)

    server = http.server.HTTPServer(('0.0.0.0', args.port), VideoServer)

    print(f"""
╔══════════════════════════════════════════════╗
║  Ultrasound Tongue DB — Video Server        ║
╠══════════════════════════════════════════════╣
║  Port:     {args.port:<5}                          ║
║  Directory:{VIDEO_DIR}
║  Mode:     Unlimited (disk space only)       ║
║  Free:     {get_disk_free(VIDEO_DIR):<30}     ║
╚══════════════════════════════════════════════╝
Press Ctrl+C to stop.
""")

    def signal_handler(sig, frame):
        print('\nShutting down...')
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
