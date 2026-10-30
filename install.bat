@echo off
echo === Cai dat Backend ===
echo.

REM Tat kiem tra SSL (bypass Zscaler)
set NODE_TLS_REJECT_UNAUTHORIZED=0
set NODE_EXTRA_CA_CERTS=

REM Cau hinh npm bypass SSL
call npm config set strict-ssl false
call npm config set legacy-peer-deps true

echo Xoa node_modules cu (neu co)...
if exist node_modules rmdir /s /q node_modules

echo.
echo Cai dat packages...
call npm install

echo.
if %errorlevel% neq 0 (
    echo [LOI] npm install that bai!
    echo.
    echo Thu cach khac: cai sqlite3 voi prebuilt binary...
    call npm install --ignore-scripts
    cd node_modules\sqlite3
    call npx node-pre-gyp install --fallback-to-build=false 2>nul
    cd ..\..
)

echo.
echo Tao thu muc uploads...
if not exist uploads mkdir uploads

echo.
if not exist database.sqlite (
    echo Tao du lieu mau...
    call npm run seed
) else (
    echo [SKIP] Database da ton tai.
)

echo.
echo === Cai dat xong! Chay: npm run dev ===
pause
