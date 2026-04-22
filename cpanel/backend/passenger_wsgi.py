# Passenger WSGI entry point for Namecheap cPanel.
# cPanel Passenger expects a `application` callable at module level.
# We wrap the FastAPI ASGI app with a2wsgi to serve it over WSGI.

import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# Activate the virtualenv created by cPanel "Setup Python App" if present
VENV = os.path.join(os.path.dirname(HERE), "virtualenv")
ACTIVATE = os.path.join(VENV, "bin", "activate_this.py")
if os.path.isfile(ACTIVATE):
    with open(ACTIVATE) as f:
        exec(f.read(), {"__file__": ACTIVATE})

from a2wsgi import ASGIMiddleware
from server import app as fastapi_app

application = ASGIMiddleware(fastapi_app)
