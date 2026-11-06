@echo off
echo Starting optional model servers (weights required, none installed by this script)...
start "" /min python "%~dp0kimodo\server.py"
start "" /min python "%~dp0stable-audio\server.py"
echo Done. Servers skip gracefully if weights are missing.