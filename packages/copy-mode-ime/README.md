# pi-copy-mode-ime

A macOS companion for `@luan.sh/pi-copy-mode`. It switches to an English input source for copy-mode shortcuts and restores the writing input source for comments and on exit.

## Install

Use the fullscreen TUI on macOS and install [macism](https://github.com/laishulu/macism) (`4.0.0+` recommended for third-party CJKV input methods such as Squirrel/Rime) or [im-select](https://github.com/daipeihust/im-select) on Pi's `PATH`. The default navigation source is macOS ABC. Set `PI_COPY_MODE_IME_NAV_SOURCE` if you use a different English input source.

```sh
pi install npm:@luan.sh/pi-copy-mode@0.3.4
pi install npm:pi-copy-mode-ime
```

The [extension guide](https://github.com/MimeLyc/pi_setup/tree/main/extensions/copy-mode-ime) covers input source policies, compatibility, and troubleshooting. Start with the [example configuration](https://github.com/MimeLyc/pi_setup/blob/main/config/copy-mode-ime.example.json) to customize how each transition switches sources.

## License

MIT
