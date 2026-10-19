FROM alpine:3.20
RUN apk add --no-cache openssl
COPY gen-cert.sh /gen-cert.sh
RUN chmod +x /gen-cert.sh
ENTRYPOINT ["/gen-cert.sh"]
