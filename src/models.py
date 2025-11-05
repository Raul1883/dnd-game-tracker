# src/models.py
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import ARRAY, Integer, String, Date, Time, Enum
from datetime import datetime, timedelta

# Инициализация SQLAlchemy (объект db должен быть инициализирован в app.py)
db = SQLAlchemy()


# Вспомогательная функция для обработки тэгов (массива строк в SQLite)
# В SQLite нет встроенной поддержки массивов, поэтому мы будем хранить их как JSON/текст.
# Для простоты в этом примере tags будет храниться как строка (текст) с разделителем,
# но мы будем обрабатывать это как массив в коде.

class Task(db.Model):
    """
    Модель Задания (Квеста)
    Структура: id, name, short_description, description, min_lvl, max_lvl, tags, created_at
    """
    __tablename__ = 'tasks'

    # Служебные поля
    id = db.Column(db.Integer, primary_key=True)  # Уникальный идентификатор
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)  # Время создания задания

    # Основные поля
    name = db.Column(db.String(100), nullable=False)  # Имя задания
    short_description = db.Column(db.String(255), nullable=False)  # Короткое описание задания
    description = db.Column(db.Text, nullable=False)  # Полное описание задания

    # Уровни
    min_lvl = db.Column(db.Integer, nullable=True)  # Минимальный уровень для выполнения задания
    max_lvl = db.Column(db.Integer, nullable=True)  # Максимальный уровень для выполнения задания

    # Тэги. Храним как строку, разделенную запятыми.
    # Дополнительная обработка для string[] будет в бизнес-логике.
    tags = db.Column(db.String(255), nullable=True)  # Тэги для задания

    # Связь с заявками
    applications = db.relationship('Application', backref='task', lazy=True, cascade="all, delete-orphan")


class Application(db.Model):
    """
    Модель Заявки на участие в игре
    Структура: id, created_at, name, info, game_date, time_start, time_end, status
    """
    __tablename__ = 'applications'

    # Связь с заданием
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)  # ID задания (для связи)

    # Служебные поля
    id = db.Column(db.Integer, primary_key=True)  # Уникальный идентификатор
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)  # Время создания заявки

    # Информация об игроке и времени
    name = db.Column(db.String(100), nullable=False)  # Имя инициатора заявки
    info = db.Column(db.Text, nullable=True)  # Комментарий оставленный пользователем
    game_date = db.Column(db.Date, nullable=False)  # Дата указанная пользователем
    time_start = db.Column(db.Time, nullable=True)  # Время начала "окна"
    time_end = db.Column(db.Time, nullable=True)  # Время конца "окна"

    # Статус заявки. Используем строковый enum.
    # Допустимые статусы: "outdated", "confirmed", "default"
    status_choices = ['default', 'confirmed', 'outdated']
    status = db.Column(db.String(20), default='default', nullable=False)

    # Мы добавим логику автозаполнения time_end во Flask-роуте, но на уровне БД
    # модель готова хранить эти данные.


class Window(db.Model):
    """
    Модель Свободного Временного Окна, настроенного мастером
    Структура: id, game_date, time_start, time_end
    """
    __tablename__ = 'windows'

    id = db.Column(db.Integer, primary_key=True)  # Уникальный идентификатор
    game_date = db.Column(db.Date, nullable=False)  # Дата указанная пользователем
    time_start = db.Column(db.Time, nullable=True)  # Время начала "окна"
    time_end = db.Column(db.Time, nullable=True)  # Время конца "окна"
