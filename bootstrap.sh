#!/bin/sh

echo -e "c\n1" | setup-apkrepos
echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" > /etc/apk/repositories
echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories
echo "@testing http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories
apk add mprocs deno caddy git

cd
rm -rf ./api # if it already exists
git clone https://github.com/snlxnet/api

cd api
mprocs
