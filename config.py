# config.py

import os


class Config:
    # Базовая директория приложения
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

    # Конфигурация базы данных SQLite
    # SQLAlchemy будет искать файл site.db в папке instance/
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'site.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False  # Рекомендуется для экономии ресурсов

    # Секретный ключ для сессий и безопасности (нужен для Flask)
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'вы_должны_сгенерировать_сложный_ключ'

    # Настройки для Админ-панели (для первой версии без авторизации)
    # Это может быть простой пароль или ключ, который нужно передавать
    ADMIN_KEY = 'master_access_only'
