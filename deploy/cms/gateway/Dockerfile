FROM alpine:3.24@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS build
RUN apk add --no-cache build-base curl ca-certificates libevent-dev openssl-dev pkgconf
WORKDIR /build
RUN curl --fail --show-error --location https://www.pgbouncer.org/downloads/files/1.26.1/pgbouncer-1.26.1.tar.gz -o source.tar.gz \
 && echo '00886a2994b4844cd37110970df777772cfc42a74c400522c82fba509a3f42d9  source.tar.gz' | sha256sum -c - \
 && tar -xzf source.tar.gz \
 && cd pgbouncer-1.26.1 \
 && ./configure --prefix=/usr/local --with-openssl --without-pam \
 && make -j2 pgbouncer \
 && install -m 0755 pgbouncer /usr/local/bin/pgbouncer

FROM alpine:3.24@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
RUN apk add --no-cache ca-certificates libevent libssl3 libcrypto3 \
 && addgroup -g 1000 pgbouncer \
 && adduser -D -H -u 1000 -G pgbouncer pgbouncer
COPY --from=build /usr/local/bin/pgbouncer /usr/local/bin/pgbouncer
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/pgbouncer"]
CMD ["/etc/pgbouncer/pgbouncer.ini"]
