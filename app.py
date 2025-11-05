# app.py

from flask import Flask, jsonify, request, render_template
from config import Config
from src.models import db  # Импортируем объект db из наших моделей
import os

# Импортируем Blueprints
from src.routes.public import public_bp
from src.routes.admin import admin_bp


def create_app(config_class=Config):
    """Фабрика приложений Flask."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 1. Инициализация расширений
    db.init_app(app)

    # 2. Регистрация Blueprints (маршрутов)
    # Публичные маршруты доступны по префиксу /api
    app.register_blueprint(public_bp, url_prefix='/api')
    # Приватные маршруты доступны по префиксу /api/admin
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    # 3. Маршрут для Главной страницы (отображение шаблона)
    @app.route('/')
    def index():
        # Главная страница представлена кратким описанием и списком заданий
        # В реальном приложении здесь будет рендеринг HTML
        return render_template('index.html')

    #  Маршрут для админского дашборда (отображение шаблона)
    @app.route('/admin')
    def admin_main_page():
        # Главная страница представлена кратким описанием и списком заданий
        # В реальном приложении здесь будет рендеринг HTML
        return render_template('/admin/dashboard.html')

    @app.route('/admin/tasks')
    def admin_tasks():
        # Главная страница представлена кратким описанием и списком заданий
        # В реальном приложении здесь будет рендеринг HTML
        return render_template('/admin/tasks.html')

    @app.route('/admin/applications')
    def admin_applications():
        # Главная страница представлена кратким описанием и списком заданий
        # В реальном приложении здесь будет рендеринг HTML
        return render_template('/admin/applications.html')

    @app.route('/admin/windows')
    def admin_windows():
        # Главная страница представлена кратким описанием и списком заданий
        # В реальном приложении здесь будет рендеринг HTML
        return render_template('/admin/windows.html')

    # Обработка ошибки 404 (Не найдено)
    @app.errorhandler(404)
    def not_found(error):
        # Соответствует формату обработки ошибок в вашей документации
        return jsonify({"error": "Resource not found"}), 404

    return app


def setup_database(app):
    """Создает папки и базу данных, если они не существуют."""
    with app.app_context():
        # Убедимся, что папка instance/ существует
        instance_dir = os.path.join(app.root_path, 'instance')
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)

        # Создаем таблицы, если они еще не созданы
        db.create_all()
        print("База данных и таблицы успешно созданы.")


if __name__ == '__main__':
    # Создаем приложение
    app = create_app()

    # Настраиваем базу данных
    setup_database(app)

    # Запускаем приложение
    app.run(debug=True)
