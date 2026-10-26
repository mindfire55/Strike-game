"""
STRIKE ZONE - server.py
Tiny local web server so you can play at http://localhost:8000

Run it from any folder:   python server.py
(Keep this file inside the folder named "strikezone", next to index.html)
"""
import http.server
import os
import socketserver
import webbrowser

PORT = 8000
FOLDER = os.path.dirname(os.path.abspath(__file__))
# serve the PARENT folder, so the files are reachable as /strikezone/style.css etc.
os.chdir(os.path.dirname(FOLDER))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # no caching, so your edits show up when you refresh the page
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}/strikezone/index.html"
    print(f"Strike Zone is running!  Open  {url}")
    print("Press Ctrl+C to stop.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
