#!/bin/bash
yarn config set workspaces-experimental true

yarn install

yarn run cli link-extension ./my-extensions/dicom-seg
yarn run cli link-extension ./my-extensions/monai-label

yarn run cli link-mode ./my-modes/monai-label

yarn --cwd ./my-extensions/dicom-seg install
yarn --cwd ./my-extensions/monai-label install
yarn --cwd ./my-modes/monai-label install

yarn build
