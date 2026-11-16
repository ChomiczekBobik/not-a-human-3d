@echo off
cd /d "%~dp0"
echo.
echo  ДА, Я ЧЕЛОВЕК - локальный сервер: http://localhost:8080
echo  Ctrl+C - остановить
echo.
where py >nul 2>nul && (py -m http.server 8080 & goto :eof)
where python >nul 2>nul && (python -m http.server 8080 & goto :eof)
echo Python не найден. Установи Python или открой папку через любой HTTP-сервер.
pause
