#!/bin/bash

show_help() {
  echo "Usage: ./run.sh <command>"
  echo "Commands:"
  echo "  build            build binaries, copy to qt-core/res/qtcli"
  echo "  tests            run tests (e2e)"
  echo "  gen-all          generate items from all presets for manual check"
  echo "  print-version    print current version"
  echo "  install-tools    install tools for build, license update, etc."
  echo "  update-license   update license files"
  echo "  help             print help"
}

build() {
  export GORELEASER_CURRENT_TAG=$(head -n 1 version.txt | xargs)

  goreleaser release --snapshot --clean
  if [[ $? -ne 0 ]]; then
      exit $1
  fi

  # copy to qt-core
  TARGET_DIR=../qt-core/res/qtcli

  mkdir -p $TARGET_DIR && \
  cp -r ./dist/bin/* $TARGET_DIR && \
  echo ------------------------- && \
  echo Target directory: $TARGET_DIR && \
  ls -l $TARGET_DIR
}

tests() {
  echo ">>> Building binaries..." && \
  rm -rf ./tests/qtcli ./tests/qtcli.* && \
  go build -C ./src -o ../tests && \
  echo ">>> Running end-to-end tests ..." && \
  go test -C ./tests/e2e -v
}

gen-all() {
  outdir="_new-all"

  echo ">>> Building binary..." && \
  rm -rf ./tests/qtcli ./tests/qtcli.* ./tests/${outdir} && \
  go build -C ./src -o ../tests && \

  echo ">>> Creating items with default options to ${outdir}" && \
  mkdir ./tests/${outdir} && cd $_ || exit 1

  ext=""
  if [[ "$(uname -s)" =~ MINGW|MSYS|CYGWIN ]]; then
    ext=".exe"
  fi

  presets=(
    "@projects/cpp/console"
    "@projects/cpp/qtquick"
    "@projects/cpp/qwidget"
    "@types/qml"
    "@types/qrc"
    "@types/ui"
    "@cpp/class"
  )

  for preset in "${presets[@]}"; do
    name="new_$(echo "$preset" | sed 's/^@//' | tr '/' '_')"
    subcmd="new-file"
    if [[ "$preset" == @projects/* ]]; then
      subcmd="new"
    fi

    cmd="../qtcli${ext} $subcmd $name --preset $preset"
    echo "Running: $cmd"
    $cmd
  done

  echo '-----------------------------------'
  echo Output Dir: $(pwd)
  echo '-----------------------------------'
  ls -al
}

print_version() {
  echo $(head -n 1 version.txt | xargs)
}

install_tools() {
  echo ">>> Installing goreleaser ..."
  go install github.com/goreleaser/goreleaser/v2@latest

  echo ">>> Installing go-licenses ..."
  go install github.com/google/go-licenses@latest
}

update_license() {
  TARGET_DIR=..
  TARGET_FILE=ThirdPartyNotices.txt

  pushd . > /dev/null
  echo ">>> Updating $TARGET_FILE ..."
  cd ./src
  go mod tidy
  go-licenses report . \
    --template ../others/ThirdPartyNotices.tpl \
    --ignore qtcli > $TARGET_DIR/$TARGET_FILE
  popd > /dev/null
}

case "$1" in
  build)
    build
    ;;
  tests)
    tests
    ;;
  gen-all)
    gen-all
    ;;
  print-version)
    print_version
    ;;
  install-tools)
    install_tools
    ;;
  update-license)
    update_license
    ;;
  help|*)
    show_help
    ;;
esac
