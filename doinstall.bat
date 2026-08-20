@echo off
cd /d "C:\Users\wpdro\AppData\Local\Temp\nina-manifest-pr"
npm install --no-audit --no-fund > npm.log 2>&1
echo %ERRORLEVEL% > npm.exit
