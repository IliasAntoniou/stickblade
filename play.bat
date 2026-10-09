@echo off
rem Starts the local server and opens the game. Close this window to stop the server.
title Stickblade server
cd /d "%~dp0"
start "" http://localhost:8000/
python -m http.server 8000 --bind 127.0.0.1
