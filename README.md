Установка и запуск локально
1. Клонировать или скачать проект
git clone <URL_репозитория>
cd <имя_папки_проекта>

2. Создать и активировать виртуальное окружение

Windows:

python -m venv venv
venv\Scripts\activate


Linux / macOS:

python3 -m venv venv
source venv/bin/activate

3. Установить зависимости
pip install -r requirements.txt

4. Запуск приложения
python app.py


После запуска приложение будет доступно по адресу:

http://127.0.0.1:5000/
