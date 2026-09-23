# Продажи и синхронизация МойСклад

Структура модулей следует образцу ozon: отдельные clients, mappers, types, models и сервисы. В модулях sales и synchronization нет файлов .spec.ts.

## Ответственность модулей

sales отвечает за чтение API МойСклад, преобразование ответов и запись заказов с позициями в PostgreSQL.

synchronization отвечает за запуск sales, расписание, защиту от параллельных запусков и историю выполнения. SQL журнала и блокировки находится в его repository. Обращений к API здесь нет.

## Структура

```text
src/modules/
  sales/
    clients/
      customerorder.client.ts
    mappers/
      customerorder.mapper.ts
    models/
      customerorder.model.ts
      customerorder-position.model.ts
    types/
      customerorder.types.ts
      sales.types.ts
    sales-customerorder-sync.service.ts
    sales.repository.ts
    sales.service.ts
    sales.module.ts
  synchronization/
    types/
      synchronization.types.ts
    synchronization.repository.ts
    synchronization.service.ts
    synchronization.scheduler.ts
    synchronization.module.ts
    sync.ts
```

- client: AxiosInstance, параметры запросов, проверка ответа, таймаут и повторы сетевых ошибок/HTTP 429/5xx.
- mapper: преобразование API-ответов в модели хранения; ID из ссылок, денежные суммы, дополнительные поля и связи.
- repository продаж: только операции БД. Одна транзакция обновляет заказы и полностью заменяет их позиции.
- sales-customerorder-sync.service: последовательная загрузка страниц, дочитывание позиций, вызов mapper и repository.
- sales.service: публичные методы модуля — syncAll, findOne, findPositions.
- synchronization.repository: PostgreSQL advisory lock и записи в synchronization_runs.
- synchronization.service: запуск продаж и формирование результата выполнения.
- scheduler: ежедневный вызов synchronization.service.

## Подготовка базы и запуск

Пользователь самостоятельно применяет миграции и запускает синхронизацию.

Для текущих модулей нужны migrations/002_sales_customer_orders.sql и migrations/003_synchronization_runs.sql. Существующие имена таблиц и колонок сохранены; структурный рефакторинг не требует новых миграций. TypeORM synchronize и migrationsRun выключены.

```dotenv
MOYSKLAD_SYNC_ENABLED=true
MOYSKLAD_SYNC_CRON=0 0 3 * * *
MOYSKLAD_SYNC_TIMEZONE=Europe/Moscow
MOYSKLAD_SYNC_PAGE_SIZE=100
POSTGRES_POOL_MAX=5
```

Расписание по умолчанию — ежедневно в 03:00 по Москве. Значения .env имеют приоритет. Чтобы отключить расписание, установите MOYSKLAD_SYNC_ENABLED=false. Приложение должно работать в момент запуска; пропущенные во время остановки запуски не восполняются.

Токен используется из существующей переменной MOYSKLAD. Пул PostgreSQL должен иметь минимум два соединения: одно удерживает блокировку, другое сохраняет данные.

Ручные команды:

```shell
npm run sync:moysklad
npm run sync:moysklad:sales
```

Оба режима сейчас загружают продажи: подключён только sales. Режим all оставлен для дальнейшего подключения модулей. Прежний модуль финансов отсутствует в проекте; ссылки на него и команда finance удалены. Исторические таблицы и миграции финансов этим рефакторингом не изменяются.

CLI выключает свой планировщик и использует ту же блокировку, что и ежедневный запуск. Ненулевой код выхода означает ошибку или уже выполняющийся запуск.

## Данные

Синхронизируются заказы покупателей customerorder и их позиции. Заказы не равны фактической выручке: отгрузки, приёмки, себестоимость и комиссии пока не загружаются.

- sales_customer_orders: поля заказа, дополнительные поля attributes, связи document_links и raw_json.
- sales_customer_order_positions: позиции с ключом (order_id, id).
- synchronization_runs: время, статус, счётчики и ошибки выполнения.

API загружается страницами до 100 заказов с expand=positions. Неполные коллекции позиций дочитываются отдельно страницами до 1000. Запись в БД выполняется транзакциями на страницу заказов, SQL-вставки дробятся на 100 строк.

Денежные суммы сохраняются в исходных минимальных единицах валюты, PostgreSQL numeric возвращается строками. accountId отдельно не хранится: подключён один аккаунт. Он может присутствовать в raw_json. Времена источника сохраняются строками без неявного преобразования часового пояса; synced_at — timestamptz.

Повторный запуск обновляет заказы по id и заменяет позиции, в том числе удалённые из заказа. При сбое текущая страница не сохраняется частично; ранее записанные страницы остаются. Следующий запуск проходит весь список заново.

Физически удалённые из МойСклад заказы остаются локально. Отсутствие документа в одном проходе не считается удалением: результат зависит от прав доступа и изменений списка во время чтения. Постраничный API не предоставляет транзакционный снимок всего аккаунта.

Блокировка защищает от параллельных запусков в одной БД. Незавершённая запись running после аварии отмечается interrupted при следующем получении блокировки.
