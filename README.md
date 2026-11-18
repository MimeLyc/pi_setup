# pi_setup

A package for the [Pi coding agent](https://pi.dev). It includes `copy-mode-ime`, a macOS extension that switches to an English input source for copy-mode shortcuts and restores your writing input source for comments and after you exit copy mode.

## Included resources

| Resource | Path | Description |
| --- | --- | --- |
| [`copy-mode-ime`](./extensions/copy-mode-ime/README.md) | `extensions/copy-mode-ime/index.ts` | macOS input source companion for [`@luan.sh/pi-copy-mode`](https://www.npmjs.com/package/@luan.sh/pi-copy-mode) that switches to an English input source for copy-mode navigation and restores your writing input source for comments and exit. |
| [Copy-mode hook example](./config/copy-mode-ime.example.json) | `config/copy-mode-ime.example.json` | Optional JSON hook configuration example for customizing `copy-mode-ime` transition policies. |

## Install and quick start

Use Pi's interactive fullscreen TUI on macOS. The companion was developed against Pi `1.5.2` and `@luan.sh/pi-copy-mode` `0.3.4`. Install [macism](https://github.com/laishulu/macism) or [im-select](https://github.com/daipeihust/im-select) on the `PATH` used by Pi. Enable the macOS ABC input source (`com.apple.keylayout.ABC`) or set `PI_COPY_MODE_IME_NAV_SOURCE` to another enabled English source ID.

Install both extensions from npm.

```sh
pi install npm:@luan.sh/pi-copy-mode@0.3.4
pi install npm:pi-copy-mode-ime
```

You can also install the companion from GitHub with `pi install git:github.com/MimeLyc/pi_setup` or from a local clone with `pi install /path/to/pi_setup`. Use one installation source for the companion. If you switch sources, remove its old package entry and keep the separate `@luan.sh/pi-copy-mode` entry. Use `pi config` to enable or disable either extension.

For a one-off session without registering this package, run the following from a local clone with `@luan.sh/pi-copy-mode@0.3.4` already installed.

```sh
pi -e ./extensions/copy-mode-ime/index.ts
```

Start Pi in fullscreen TUI mode, or use `/reload` if Pi is already running. With the default settings, entering copy mode selects the navigation source. Opening a comment restores the writing source, and closing the comment returns to the navigation source if copy mode is still active. Leaving copy mode restores the most recently remembered writing source.

To disable switching for a session, start Pi with `PI_COPY_MODE_IME_ENABLED=0`.

## Configuration and troubleshooting

To customize when sources switch, copy the [example configuration](./config/copy-mode-ime.example.json) to a local file, edit the hooks, and set `PI_COPY_MODE_IME_CONFIG_FILE` in the shell that starts Pi. Restart Pi after changing environment variables. See the [configuration reference](./extensions/copy-mode-ime/README.md#configuration) for available policies and settings.

If switching fails, check the enabled input sources and the CLI from the same terminal that launches Pi. See [troubleshooting and manual verification](./extensions/copy-mode-ime/README.md#troubleshooting-and-manual-verification).

## Contributing

From a local clone, use a Node.js version supported by Pi and run the development checks.

```sh
npm install
npm run typecheck
npm run check:hygiene
```

`npm run check:hygiene` also runs without `npm install`. See the [extension development guide](https://github.com/MimeLyc/pi_setup/blob/main/extensions/README.md) and [configuration template guide](https://github.com/MimeLyc/pi_setup/blob/main/config/README.md).

## License

Released under the [MIT License](./LICENSE).
