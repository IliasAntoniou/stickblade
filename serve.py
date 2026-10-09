"""Local web server for the game: python serve.py  (then open http://localhost:8000/)

Same as `python -m http.server 8000`, except it tells the browser never to cache files.
Without that, the browser can keep running an old copy of a file after the code has changed.
"""
import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print('Stickblade is at http://localhost:%d/  (close this window to stop)' % PORT)
        httpd.serve_forever()
