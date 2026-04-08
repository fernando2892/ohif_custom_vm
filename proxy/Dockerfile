FROM nginx:1.27-alpine

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Crear directorio para cache
RUN mkdir -p /var/cache/nginx/dicom && \
    chown -R nginx:nginx /var/cache/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
