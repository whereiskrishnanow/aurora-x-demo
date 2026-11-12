#!/bin/sh
# Builds the GitHub Pages version (served from /rent-chat/, AI on Netlify)
# and publishes it to the gh-pages branch.
set -e
cd "$(dirname "$0")/.."
npm run build:pages
touch dist/.nojekyll
cp dist/index.html dist/404.html
out=$(mktemp -d)
cp -R dist/. "$out"
cd "$out"
git init -q -b gh-pages
git add -A
git -c user.name=whereiskrishnanow -c user.email=whereiskrishnanow@users.noreply.github.com commit -q -m "Publish to GitHub Pages"
git push -q -f https://github.com/whereiskrishnanow/rent-chat.git gh-pages
echo "Published to gh-pages"
