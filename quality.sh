#!/bin/bash
set -e

rm -f ./deno.lock
deno lint --fix src
deno check
deno fmt src test ./*.ts

deno test --allow-all --trace-leaks --v8-flags=--max-old-space-size=8192 --parallel test/*