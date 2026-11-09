# Работа с проектом

- `backend/` — Java/Spring Boot; `frontend/` — React/Vite; `contracts/` — TypeSpec.
- Окружение: mise в PATH; требуемая версия задана в `mise.toml`. Установка: `mise trust`, `mise install`, `mise run setup`.
- Запуск: `mise run dev`; остановка: `mise daemons stop backend frontend`.
- Все проверки: `mise run check`; тесты: `mise run test`; линтеры: `mise run lint`.
- Pre-commit: `mise run lint:commit` (Maven offline после setup); аудит зависимостей: `mise run audit`.
- После очистки `~/.m2` или обновления Maven-плагинов выполните `mise run lint` с доступом к сети, затем `mise run lint:commit`.
- Сборка: `mise run build`; генерация контракта и SDK: `mise run generate`.
- Не редактируйте генерируемые OpenAPI, SDK и Java-интерфейсы вручную; меняйте TypeSpec и запускайте генерацию.
- В коммит включайте `contracts/openapi.yaml` и `frontend/src/api/`; `backend/target/` не коммитится.
- Коммиты — Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:` и другие стандартные типы.
- Не изменяйте `.github/workflows/hexlet-check.yml`: это проверка Хекслета.

## Agent skills

Скиллы Matt Pocock установлены для Codex в `.agents/skills/`.
Вызывайте скилл по имени или ссылкой на `.agents/skills/<name>/SKILL.md`.
Основной цикл: `wayfinder` → `to-spec` → `to-tickets` → `implement-spec`.
Перед работой читайте этот файл, спецификацию, связанные тикеты и их зависимости.

### Issue tracker

GitHub Issues: https://github.com/AlekseiGerasimov/ai-for-developers-project-386/issues.
Настройки и команды: `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные метки: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
Назначение меток: `docs/agents/triage-labels.md`.

### Domain docs

Single-context: словарь `GLOSSARY.md` в корне, решения в `docs/adr/`.
Правила чтения и обновления: `docs/agents/domain.md`.
