# Выпуск приложения

Frontend и backend выпускаются вместе из `main`. Единственная запись `.` в
`.release-please-manifest.json` хранит текущую версию приложения (начальная —
`0.1.0`; это исходная версия, а не заявление о опубликованном GitHub Release).
Release-please обновляет `package.json`, `frontend/package.json`, обе записи
версии приложения в `package-lock.json`, `backend/pom.xml`, манифест и
`CHANGELOG.md` в одном PR. Имя собранного JAR всегда `calendar.jar`.

Workflow `Release` запускается при push в `main` или вручную на `main`.
Conventional Commits определяют следующую версию: `fix:` — patch, `feat:` —
minor, `feat!:` / `BREAKING CHANGE:` — major. Первый выпуск собирает изменения
после `bootstrap-sha` (до первого каталога); после первого релиза release-please
использует последний опубликованный релиз. Нерелизные `docs:` / `chore:` сами
по себе не требуют выпуска.

Владелец проверяет версию и CHANGELOG и **вручную** сливает PR
`chore(main): release …`. Следующий запуск создаёт тег `v<версия>` и GitHub
Release на коммите этого PR. Workflow не сливает PR и не развёртывает приложение.

## Разрешения

Используется стандартный `GITHUB_TOKEN`, отдельный PAT не нужен. В Settings →
Actions → General → Workflow permissions включите **Allow GitHub Actions to
create and approve pull requests**. Базовые разрешения репозитория остаются
read-only; только job `release` запрашивает `contents: write` и
`pull-requests: write` для релизного PR, тега и GitHub Release.

События, созданные `GITHUB_TOKEN`, не запускают другие workflows. Поэтому у
ботовского релизного PR могут отсутствовать обычные PR checks; перед ручным
слиянием проверьте его изменения и запустите `mise run check` на ветке PR.
При обязательных проверках в branch protection согласуйте отдельный токен
GitHub App вместо обхода защиты.

## Проверка

`mise run lint` включает actionlint. Для безопасной проверки подготовки PR
на уже опубликованной ветке используйте release-please CLI:

```powershell
$env:GITHUB_TOKEN = gh auth token
mise exec -- npx --yes release-please@17.11.2 release-pr --repo-url AlekseiGerasimov/ai-for-developers-project-386 --target-branch main --dry-run
Remove-Item Env:GITHUB_TOKEN
```

Dry-run показывает будущий PR, версию и обновления файлов, но не создаёт PR,
тег или Release. Для локального dry-run CLI с `--local` используйте только
одноразовый клон: CLI переключает ветку и выполняет `reset --hard`.

После попадания workflow в `main` проверьте успешный запуск `Release` и
настоящий релизный PR: одна общая версия, CHANGELOG и обновления всех файлов
выше. После ручного слияния релизного PR проверьте, что тег `v<версия>`
указывает на его merge commit и GitHub Release содержит ту же версию и заметки.
Наличие dry-run не доказывает, что эти действия уже выполнены.

Официальные источники: [manifest configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md),
[release-please Action и разрешения токена](https://github.com/googleapis/release-please-action).
