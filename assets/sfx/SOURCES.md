# Звуки: источники и лицензии

Все 22 файла в этой папке хранятся локально и загружаются игрой как обычные статические
OGG. Во время игры внешние аудиосервисы не нужны. Если файл не загрузился или браузер
не смог его декодировать, `src/audio.js` использует синтезированный WebAudio-фолбэк.

## CC0-1.0

https://creativecommons.org/publicdomain/zero/1.0/

### 20 эффектов — `Mcamento8/open-game-sfx-index`

- Индекс: https://github.com/Mcamento8/open-game-sfx-index
- Метаданные и исходные ссылки: https://raw.githubusercontent.com/Mcamento8/open-game-sfx-index/main/index.json
- В индексе для аудио указано: `license_audio: CC0-1.0`.

| Локальные файлы | Исходные файлы |
|---|---|
| `step_wood_0.ogg` … `step_wood_4.ogg` | `audio/impact-sounds/footstep_wood_000.ogg` … `footstep_wood_004.ogg` |
| `step_snow_0.ogg` … `step_snow_4.ogg` | `audio/impact-sounds/footstep_snow_000.ogg` … `footstep_snow_004.ogg` |
| `knock_0.ogg` … `knock_2.ogg` | `audio/impact-sounds/impactWood_heavy_000.ogg` … `impactWood_heavy_002.ogg` |
| `door_open.ogg` | `audio/rpg-audio/doorOpen_1.ogg` |
| `door_close.ogg` | `audio/rpg-audio/doorClose_2.ogg` |
| `creak.ogg` | `audio/rpg-audio/creak2.ogg` |
| `crouch.ogg` | `audio/rpg-audio/cloth2.ogg` |
| `coins.ogg` | `audio/rpg-audio/handleCoins.ogg` |
| `shop_bell.ogg` | `audio/impact-sounds/impactBell_heavy_001.ogg` |
| `click.ogg` | `audio/interface-sounds/click_002.ogg` |

### 2 эмбиент-петли — OpenGameArt «100 CC0 SFX #2»

- Страница: https://opengameart.org/content/100-cc0-sfx-2
- Архив: https://opengameart.org/sites/default/files/sfx_100_v2.zip
- На странице набора заявлена лицензия CC0.

| Локальный файл | Файл в архиве |
|---|---|
| `ambient_1.ogg` | `sfx100v2_loop_ambient_01.ogg` |
| `ambient_2.ogg` | `sfx100v2_loop_ambient_02.ogg` |

## Что осталось синтезированным

Криповая отдышка при беге, школьный звонок и часть атмосферных/сюжетных сигналов
собираются через WebAudio в `src/audio.js`. Это не мешает локальным записям: живые шаги,
двери, скрип, ткань, стук, монеты, звонок магазина, клики интерфейса, ветер и комнатный тон
используют файлы из этой папки, когда они доступны.
