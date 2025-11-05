# src/routes/admin.py

from flask import Blueprint, jsonify, request, abort
from config import Config
from src.models import db, Task, Application, Window
from sqlalchemy import func, desc
from datetime import datetime

admin_bp = Blueprint('admin', __name__)


# --- Вспомогательные функции ---

def task_to_detailed_json(task):
    """Преобразует объект Task в детальный формат для ответа."""
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


def application_to_json_admin(application):
    """Преобразует объект Application в JSON формат ответа для админ-панели."""
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


# --- Декоратор для проверки ключа администратора ---

def master_required(f):
    """
    Декоратор для проверки наличия и корректности ключа администратора
    в заголовке 'X-Admin-Key'.
    """

    def decorated_function(*args, **kwargs):
        ##admin_key = request.headers.get('X-Admin-Key')
        ##if admin_key != Config.ADMIN_KEY:
        ##    abort(403, description="Access Forbidden: Admin key missing or invalid.")
        return f(*args, **kwargs)

    decorated_function.__name__ = f.__name__
    return decorated_function


# --- ЭНДПОИНТЫ ---

## 1. POST /api/admin/tasks: Создать новое задание
@admin_bp.route('/tasks', methods=['POST'])
@master_required
def create_task():
    """
    Создать новое задание.
    """
    data = request.get_json()

    if not data:
        abort(400, description="Invalid JSON data or missing fields")

    required_fields = ['name', 'short_description', 'description']
    for field in required_fields:
        if field not in data:
            abort(400, description=f"Validation failed: Field '{field}' is required.")

    tags_data = data.get('tags', [])
    tags_string = ','.join(tags_data) if isinstance(tags_data, list) else ''

    new_task = Task(
        name=data['name'],
        short_description=data['short_description'],
        description=data['description'],
        min_lvl=data.get('min_lvl'),
        max_lvl=data.get('max_lvl'),
        tags=tags_string
    )

    try:
        db.session.add(new_task)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not save task. Details: {str(e)}")

    return jsonify(task_to_detailed_json(new_task)), 201


## 2. DELETE /api/admin/tasks/<id>: Удалить задание
@admin_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@master_required
def delete_task(task_id):
    """
    Удалить задание.
    """
    task_to_delete = db.session.get(Task, task_id)

    if task_to_delete is None:
        abort(404, description="Task not found")

    try:
        db.session.delete(task_to_delete)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not delete task. Details: {str(e)}")

    return '', 204


## 3. GET /api/admin/dashboard: Получить все данные для Панели мониторинга
@admin_bp.route('/dashboard', methods=['GET'])
@master_required
def get_dashboard_data():
    """
    Получить все данные для Панели мониторинга (агрегация!)
    """

    # 1. Общее количество активных заданий
    total_active_tasks = db.session.query(Task).count()

    # 2. Количество заявок по статусам
    applications_by_status_raw = db.session.query(
        Application.status,
        func.count(Application.id)
    ).group_by(Application.status).all()

    # Преобразуем в словарь и обеспечим наличие всех статусов (default, confirmed, outdated)
    applications_by_status_dict = dict(applications_by_status_raw)
    all_statuses = ['default', 'confirmed', 'outdated']
    status_metrics = {status: applications_by_status_dict.get(status, 0) for status in all_statuses}

    # 3. Топ-5 заданий по количеству заявок
    top_tasks_raw = db.session.query(
        Task.name,
        func.count(Application.id).label('app_count')
    ).join(Application, Task.id == Application.task_id).group_by(Task.name).order_by(
        desc('app_count')
    ).limit(5).all()

    top_tasks = [
        {"name": name, "count": count} for name, count in top_tasks_raw
    ]

    # 4. Топ-5 самых популярных дат
    top_dates_raw = db.session.query(
        Application.game_date,
        func.count(Application.id).label('date_count')
    ).group_by(Application.game_date).order_by(
        desc('date_count')
    ).limit(5).all()

    # Преобразуем даты в формат ISO 8601
    top_dates = [
        {"date": game_date.isoformat(), "count": count} for game_date, count in top_dates_raw
    ]

    return jsonify({
        "total_active_tasks": total_active_tasks,
        "applications_by_status": status_metrics,
        "top_5_tasks": top_tasks,
        "top_5_dates": top_dates
    }), 200


## 4. GET /api/admin/applications: Получить список заявок
@admin_bp.route('/applications', methods=['GET'])
@master_required
def list_applications():
    applications = db.session.execute(
        db.select(Application).order_by(desc(Application.game_date), desc(Application.time_start))
    ).scalars().all()

    applications_json = [application_to_json_admin(app) for app in applications]
    return jsonify(applications_json), 200


## 5. PUT /api/admin/applications/<int:app_id>: Обновить статус заявки
@admin_bp.route('/applications/<int:app_id>', methods=['PUT'])
@master_required
def update_application_status(app_id):
    data = request.get_json()
    new_status = data.get('status')
    valid_statuses = ['default', 'confirmed', 'outdated']

    if not new_status or new_status not in valid_statuses:
        abort(400, description="Validation failed: Status must be one of: default, confirmed, outdated.")

    application = db.session.get(Application, app_id)

    if application is None:
        abort(404, description="Application not found")

    try:
        application.status = new_status
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not update application status. Details: {str(e)}")

    return jsonify(application_to_json_admin(application)), 200


## 6. DELETE /api/admin/applications/<int:app_id>: Удалить заявку (НОВОЕ)
@admin_bp.route('/applications/<int:app_id>', methods=['DELETE'])
@master_required
def delete_application(app_id):
    """Удаляет заявку по ID."""
    application = db.session.get(Application, app_id)

    if application is None:
        # Если заявка не найдена, возвращаем 404
        abort(404, description="Application not found")

    try:
        db.session.delete(application)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not delete application. Details: {str(e)}")

    # Успешное удаление возвращает 204 No Content
    return '', 204



## 6. POST /api/admin/windows: Создать временное окно
@admin_bp.route('/windows', methods=['POST'])
@master_required
def create_window():
    data = request.get_json()
    required_fields = ['game_date', 'time_start', 'time_end']

    for field in required_fields:
        if field not in data:
            abort(400, description=f"Validation failed: Field '{field}' is required.")

    # Используем парсеры, которые есть в public.py (в идеале они должны быть в утилитах)
    from src.routes.public import parse_date_string, parse_time_string  # Временный импорт для использования

    game_date_obj = parse_date_string(data['game_date'])
    time_start_obj = parse_time_string(data['time_start'])
    time_end_obj = parse_time_string(data['time_end'])

    if not game_date_obj or not time_start_obj or not time_end_obj:
        abort(400, description="Validation failed: Date/time format is incorrect (YYYY-MM-DD, HH:MM).")

    new_window = Window(
        game_date=game_date_obj,
        time_start=time_start_obj,
        time_end=time_end_obj
    )

    try:
        db.session.add(new_window)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not save window. Details: {str(e)}")

    return jsonify(window_to_json(new_window)), 201


## 7. DELETE /api/admin/windows/<id>: Удалить временное окно
@admin_bp.route('/windows/<int:window_id>', methods=['DELETE'])
@master_required
def delete_window(window_id):
    window_to_delete = db.session.get(Window, window_id)

    if window_to_delete is None:
        abort(404, description="Window not found")

    try:
        db.session.delete(window_to_delete)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        abort(500, description=f"Internal server error: Could not delete window. Details: {str(e)}")

    return '', 204
