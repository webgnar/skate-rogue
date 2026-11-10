#!/bin/sh
# Xcode Cloud (docs/APP_STORE.md): runs after the repo is cloned, before Xcode builds ios/App. The game's web build
# isn't in git (ios/App/App/public and capacitor.config.json are made by npm run build:ios), so make it here.
set -e
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci
npm run build:ios
