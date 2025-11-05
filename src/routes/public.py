# src/routes/public.py

from flask import Blueprint, jsonify, request, abort
from sqlalchemy import func
from src.models import db, Task, Application, Window
from datetime import datetime, date, time, timedelta

public_bp = Blueprint('public', __name__)


# --- Вспомогательные функции для парсинга и форматирования ---

def parse_time_string(time_str):
    """Парсит строку времени (HH:MM или HH:MM:SS) в объект datetime.time."""
    if not time_str:
        return None
    try:
        t = datetime.strptime(time_str, '%H:%M:%S').time()
    except ValueError:
        try:
            t = datetime.strptime(time_str, '%H:%M').time()
        except ValueError:
            return None
    return t


def parse_date_string(date_str):
    """Парсит строку даты (YYYY-MM-DD) в объект datetime.date."""
    if not date_str:
        return None
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None
    return d


def task_to_short_json(task):
    """Преобразует объект Task в краткий формат для списка заданий."""
    tags_list = task.tags.split(',') if task.tags else []

    # Подсчет количества заявок
    application_count = db.session.query(func.count(Application.id)).filter(
        Application.task_id == task.id
    ).scalar()

    return {
        "id": task.id,
        "name": task.name,
        "short_description": task.short_description,
        "min_lvl": task.min_lvl,
        "max_lvl": task.max_lvl,
        "tags": tags_list,
        "application_count": application_count
    }


def task_to_detailed_json(task):
    """Преобразует объект Task в детальный формат."""
    tags_list = task.tags.split(',') if task.tags else []

    return {
        "id": task.id,
        "name": task.name,
        "short_description": task.short_description,
        "description": task.description,
        "min_lvl": task.min_lvl,
        "max_lvl": task.max_lvl,
        "tags": tags_list,
        "created_at": task.created_at.isoformat() + 'Z'
    }


def application_to_json(application):
    """Преобразует объект Application в JSON формат ответа."""
    return {
        "id": application.id,
        "task_id": application.task_id,
        "created_at": application.created_at.isoformat() + 'Z',
        "name": application.name,
        "info": application.info,
        "game_date": application.game_date.isoformat(),
        "time_start": application.time_start.isoformat() if application.time_start else None,
        "time_end": application.time_end.isoformat() if application.time_end else None,
        "status": application.status
    }


def window_to_json(window):
    """Преобразует объект Window в JSON формат ответа."""
    return {
        "id": window.id,
        "game_date": window.game_date.isoformat(),
        "time_start": window.time_start.isoformat() if window.time_start else None,
        "time_end": window.time_end.isoformat() if window.time_end else None,
    }


# --- ЭНДПОИНТЫ (Blueprints) ---

## 1. GET /api/tasks: Получить список всех активных заданий
@public_bp.route('/tasks', methods=['GET'])
def list_tasks():
    tasks = Task.query.all()
    tasks_json = [task_to_short_json(task) for task in tasks]
    return jsonify(tasks_json), 200


## 2. GET /api/tasks/<id>: Получить детальную информацию о конкретном задании
@public_bp.route('/tasks/<int:task_id>', methods=['GET'])
def get_task_details(task_id):
    task = db.session.get(Task, task_id)
    if task is None:
        abort(404, description="Task not found")
    return jsonify(task_to_detailed_json(task)), 200


## 3. POST /api/applications: Создать новую заявку на участие в игре
@public_bp.route('/applications', methods=['POST'])
def create_application():
    data = request.get_json()

    if not data:
        abort(400, description="Invalid JSON data or missing fields")

    # Валидация обязательных полей
    required_fields = ['task_id', 'name', 'game_date', 'time_start']
    for field in required_fields:
        if field not in data:
            abort(400, description=f"Validation failed: Field '{field}' is required.")

    # Проверка существования Задания
    task_id = data['task_id']
    if not db.session.get(Task, task_id):
        abort(404, description="Task not found")

    # Парсинг даты и времени
    game_date_obj = parse_date_string(data['game_date'])
    time_start_obj = parse_time_string(data['time_start'])

    if not game_date_obj:
        abort(400, description="Validation failed: Field 'game_date' must be in YYYY-MM-DD format.")
    if not time_start_obj:
        abort(400, description="Validation failed: Field 'time_start' must be in HH:MM or HH:MM:SS format.")

    # Обработка time_end (логика +5 часов)
    time_end_obj = None

    if 'time_end' in data and data['time_end']:
        # Пользователь указал time_end вручную
        time_end_obj = parse_time_string(data['time_end'])
        if not time_end_obj:
            abort(400, description="Validation failed: Field 'time_end' must be in HH:MM or HH:MM:SS format.")
    else:
        # Автоматическое заполнение: time_end = time_start + 5 часов
        DUMMY_DATE = date(2000, 1, 1)
        dt_start = datetime.combine(DUMMY_DATE, time_start_obj)
        dt_end = dt_start + timedelta(hours=5)
        time_end_obj = dt_end.time()

    # Создание и сохранение объекта Application
    new_application = Application(
        task_id=task_id,
        name=data['name'],
        info=data.get('info'),
        game_date=game_date_obj,
        time_start=time_start_obj,
        time_end=time_end_obj,
        status='default'
    )

    try:
        db.session.add(new_application)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not save application. Details: {str(e)}")

    # Ответ: 201 Created
    return jsonify(application_to_json(new_application)), 201


## 4. GET /api/windows: Получить список доступных свободных временных окон
@public_bp.route('/windows', methods=['GET'])
def list_windows():
    windows = db.session.execute(
        db.select(Window).order_by(Window.game_date, Window.time_start)
    ).scalars().all()

    windows_json = [window_to_json(window) for window in windows]

    return jsonify(windows_json), 200
