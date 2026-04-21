FROM nginx:1.27-alpine

RUN apk add --no-cache wget

# Config por defecto en la imagen; en runtime suele montarse ./proxy/nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY cors_options.inc /etc/nginx/cors_options.inc

RUN mkdir -p /var/cache/nginx/metadata \
             /var/cache/nginx/dicom \
             /var/cache/nginx/studies \
             /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx \
                         /var/log/nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
