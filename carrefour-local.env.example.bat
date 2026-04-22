@echo off
REM Copy this file to carrefour-local.env.bat and replace the values.
REM CARREFOUR_COOKIE can be either:
REM 1. a raw Cookie header: name=value; other=value
REM 2. a JSON export of browser cookies: [{"name":"...","value":"..."}]
set CARREFOUR_COOKIE=PASTE_FULL_COOKIE_STRING_HERE
set CARREFOUR_ACCEPT_LANGUAGE=tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7
set CARREFOUR_REFERER=https://www.carrefoursa.com/search/?q=sut
set CARREFOUR_TIMEOUT_MS=45000
