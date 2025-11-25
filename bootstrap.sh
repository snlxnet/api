#!/bin/sh

echo -e "c\n1" | setup-apkrepos
apk add erlang gleam rebar3 git
apk add neovim zellij mprocs

git clone https://github.com/snlxnet/api
cd api

gleam export erlang-shipment
mprocs
