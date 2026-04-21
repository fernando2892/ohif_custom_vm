# Preflight CORS: add_header dentro de if solo es válido en contexto location
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, DELETE' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Accept,Accept-Encoding,Authorization' always;
    add_header 'Access-Control-Max-Age' 86400 always;
    add_header 'Content-Length' 0 always;
    add_header 'Content-Type' 'text/plain' always;
    return 204;
}
