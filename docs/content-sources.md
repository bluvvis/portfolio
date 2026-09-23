# Основания содержания

Проверено 10 сентября 2026 года. Источники: публичный GitHub API (16 собственных репозиториев, 248 найденных авторских коммитов на трёх страницах, 15 pull request), README и отдельные файлы исходного кода. Поиск GitHub отражает публично индексируемый вклад, а не гарантированно всю историю пользователя. Проекты в этом аудите не запускались; заявляем наличие кода и артефактов, а не независимо измеренную эксплуатационную надёжность.

## Подтверждено автором

- Цель — портфолио для работодателей, позиционирование full-stack + ML.
- Студент Иннополиса; опыт SMM, преподавания и работы старшим куратором, личные интересы взяты из исходного портфолио.
- Java и C# использовались в учебных задачах и небольших приложениях; оба языка отмечены на сайте как базовый практический уровень.
- NEBERI разработан самостоятельно. История про МТС Защитник, признание лучшим проектом курса и приглашение в команду подтверждена автором в разговоре. Причина отказа исправлена: не было подходящей позиции, а не желание доучиться.
- Фото автора и коллаж NEBERI предоставлены пользователем. Файлы скопированы без изменения изображения.

## Отобранные кейсы

### NEBERI — главный самостоятельный full-stack / ML кейс

- [README и состав продукта](https://github.com/bluvvis/NEBERI).
- [API requirements](https://github.com/bluvvis/NEBERI/blob/main/apps/api/requirements.txt): FastAPI, SQLAlchemy, PostgreSQL driver, pytest, scikit-learn.
- [Frontend package.json](https://github.com/bluvvis/NEBERI/blob/main/apps/web/package.json): React, TypeScript, Vite, Tailwind CSS, Vitest.
- [Обучение и экспорт](https://github.com/bluvvis/NEBERI/blob/main/research/train_export.py): pandas, TF-IDF, LogisticRegression, оценка и экспорт pipeline.
- [Комбинация оценок](https://github.com/bluvvis/NEBERI/blob/main/apps/api/app/services/score_combine.py) и [уровни риска](https://github.com/bluvvis/NEBERI/blob/main/apps/api/app/services/risk_levels.py).
- [Helm](https://github.com/bluvvis/NEBERI/tree/main/deploy/helm/neberi), Docker Compose, workflow сборки образов в репозитории.

Публичный HTTP-стенд из README не ответил за 15 секунд при проверке. Это не доказывает постоянную недоступность, но не позволяет поставить на сайт проверенную кнопку «живое приложение». Вместо старого неподтверждённого статуса deployment in progress показаны код, локальный запуск, реальный коллаж и демонстрация логики.

### OptiTrade — сильный командный full-stack кейс

- [Репозиторий](https://github.com/FaritSharafutdinov/OptiTrade).
- [PostgreSQL и frontend fixes](https://github.com/FaritSharafutdinov/OptiTrade/commit/65792574f2369dac64b7b0c2afdd6d18dd4e6a82).
- [Мемоизация и lazy routes](https://github.com/FaritSharafutdinov/OptiTrade/commit/ee6e19d8dc1ca3125741a7a36b37f0d6ff3a5aaf).
- [Авторские коммиты](https://github.com/FaritSharafutdinov/OptiTrade/commits?author=bluvvis): Zustand (`d0edd05b34`), React Hook Form / Zod (`4e61e2968e`), Vitest (`31ecf7bc69`), backend integration (`971ca1457e`).

Торговые результаты и авторство ML/RL-моделей не заявляются.

### OCRFix-RU — самостоятельный NLP-кейс

- [README и протокол](https://github.com/bluvvis/OCRFix-RU).
- [Опубликованный report.json](https://github.com/bluvvis/OCRFix-RU/blob/main/artifacts/report.json): WER baseline 0.3510416667, hybrid 0.214375; округление на сайте 35,1% → 21,4%.
- Условия main report: 80 примеров, synthetic noise 0.30, seed 42, alpha 0.90.
- Абляции в том же файле показывают нестабильное преимущество; ограничение указано рядом с цифрами. Эксперимент повторно не запускался.

scikit-learn перенесён из привязки к OCR на NEBERI: OCRFix-RU реализует count-based n-граммы и не является основанием приписывать ему нейросеть.

### LLM Evaluation — конкретный исследовательский вклад

- [Recovering-Cyber-Security-Domain-Knowledge](https://github.com/FaritSharafutdinov/Recovering-Cyber-Security-Domain-Knowledge): README перечисляет Григория как автора baseline evaluation, inference scripts, report; обучение и эксперименты выделены в роль другого участника.
- [Коммит с evaluation / RAG / MCQ utilities](https://github.com/FaritSharafutdinov/Recovering-Cyber-Security-Domain-Knowledge/commit/a2810149f6).
- [Авторская история](https://github.com/FaritSharafutdinov/Recovering-Cyber-Security-Domain-Knowledge/commits?author=bluvvis).

Не заявляются доказанное «восстановление знаний», производственные результаты, собственное обучение всех моделей или зрелый production RAG.

### DariaBrusnika — опубликованный интерактивный веб-кейс

- [Работающий сайт](https://bluvvis.github.io/DariaBrusnika/) — получен HTTP 200.
- [Исходники](https://github.com/bluvvis/DariaBrusnika): HTML, CSS, JS; React/Vite не используются.
- [PR 1](https://github.com/bluvvis/DariaBrusnika/pull/1), [PR 2](https://github.com/bluvvis/DariaBrusnika/pull/2), [PR 3](https://github.com/bluvvis/DariaBrusnika/pull/3) имеют merged_at.

Исправлено содержание: это история опыта Дарьи Щербаковой в маркетинге территорий, а не подтверждённое портфолио дизайнера.

### Big Data Search — дополнительный data engineering кейс

- [BigData_2](https://github.com/bluvvis/BigData_2): учебное задание на основе шаблона, PySpark → Hadoop streaming → Cassandra → BM25.
- Не заявляются собственная разработка инфраструктурных технологий, производственный масштаб или производительность без измерений.

### Book Discovery — подтверждённая работа в большой команде

- [Recommendation-System](https://github.com/IU-Capstone-Project-2025/Recommendation-System): Григорий указан в README как frontend developer.
- [Мобильная адаптация, merged PR 22](https://github.com/IU-Capstone-Project-2025/Recommendation-System/pull/22).
- [Open Library parser, merged PR 44](https://github.com/IU-Capstone-Project-2025/Recommendation-System/pull/44).

Стек всей команды (Airflow, ClickHouse, Keycloak и т. п.) не добавлен в личные навыки только на основании наличия в репозитории.

## Дополнительно рассмотрено

- `WorriedSeat/big_data_project`: авторские коммиты Stage IV, SQL/Hive, Superset assets, проверки. PR 3 закрыт, но `merged: false`; не назван принятым результатом. На основной странице оставлен более ясный личный BigData_2.
- `FaritSharafutdinov/Cryptify`: frontend/deployment и исправления реального API; уступает OptiTrade по ясности подтверждённого вклада.
- `FaritSharafutdinov/Real-Time-Virtual-Try-On-using-Face-Landmark-Analysis`: рефакторинг и поддержка аксессуаров; не использован как доказательство авторства всего CV-алгоритма.
- `haiid-digit-recognizer`, `chat-kafka`, CV- и другие задания не включены в основную подборку; доступны через ссылку на все репозитории. Это редакционный отбор, файлы проектов не менялись.

## Данные для будущих обновлений

Навыки и привязки находятся в семантическом HTML, а сфера читает тот же список. Не добавлять технологии только потому, что они типичны для вакансии. Для нового навыка нужен личный проект либо конкретный авторский diff. Публичный домен портфолио пока не задан, поэтому абсолютные canonical/OG URL не выдуманы.
