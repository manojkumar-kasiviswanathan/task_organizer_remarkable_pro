import os
import sys
import time
import socket
import threading
import urllib.request
import webview

# Import your Flask app
from app import app

APP_NAME = "TaskOrganizer"

def find_free_port(start=5000, end=5999):
    for p in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError("No free port found")

def wait_for_server(url, timeout=12):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url) as _:
                return True
        except Exception:
            time.sleep(0.2)
    return False

def start_flask(host, port):
    # No reloader, no debug, or you’ll get double servers under PyInstaller
    app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)

if __name__ == "__main__":
    # 1) Pick a free local port – avoids “Address already in use” loops
    PORT = find_free_port()
    URL = f"http://127.0.0.1:{PORT}"

    # 2) Start Flask in a daemon thread
    t = threading.Thread(target=start_flask, args=("127.0.0.1", PORT), daemon=True)
    t.start()

    # 3) Wait until the server is actually reachable to avoid blank window / crash
    wait_for_server(URL, timeout=12)

    # 4) Create the desktop window (must run on main thread on macOS)
    webview.create_window(
        APP_NAME,
        URL,
        width=1200,
        height=800,
        resizable=True
    )
    webview.start()
