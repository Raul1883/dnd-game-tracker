 document.addEventListener('DOMContentLoaded', () => {
            const createForm = document.getElementById('create-task-form');
            const createMessage = document.getElementById('create-message');
            const createBtn = document.getElementById('create-btn');
            const listMessage = document.getElementById('list-message');
            const tasksListContainer = document.getElementById('tasks-list-container');

            // --- Новые элементы для импорта JSON ---
            const importForm = document.getElementById('import-task-form'); // <--- ДОБАВИТЬ
            const importMessage = document.getElementById('import-message'); // <--- ДОБАВИТЬ
            const importBtn = document.getElementById('import-btn'); // <--- ДОБАВИТЬ

            // --- УТИЛИТЫ ---
            const ADMIN_KEY = ''; // Здесь бы передавался реальный ключ в продакшене

            const showMessage = (element, text, type) => {
                element.textContent = text;
                element.className = `message ${type}`;
                element.style.display = 'block';
            };

            const hideMessage = (element) => {
                element.style.display = 'none';
            };

            const apiCall = async (url, method = 'GET', data = null) => {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        // 'X-Admin-Key': ADMIN_KEY // Временно закомментировано
                    }
                };

                if (data) {
                    options.body = JSON.stringify(data);
                }

                const response = await fetch(url, options);
                let responseBody = {};

                try {
                    responseBody = await response.json();
                } catch (e) {
                    // Обработка 204 No Content
                    if (response.status === 204) return null;
                    throw new Error(`[${response.status}] Не удалось распарсить ответ.`);
                }

                if (!response.ok) {
                    const errorMsg = responseBody.error || `Ошибка ${response.status}`;
                    const errorDetails = responseBody.details || '';
                    throw new Error(`${errorMsg}: ${errorDetails}`);
                }

                return responseBody;
            };

            // --- ФУНКЦИИ УПРАВЛЕНИЯ ЗАДАНИЯМИ ---

            // 1. ЗАГРУЗКА И ОТОБРАЖЕНИЕ СПИСКА (GET /api/tasks)
            const loadTasks = async () => {
                showMessage(listMessage, 'Загрузка списка заданий...', 'loading');
                tasksListContainer.innerHTML = '';

                try {
                    const tasks = await apiCall('/api/tasks');
                    hideMessage(listMessage);

                    if (tasks.length === 0) {
                        tasksListContainer.innerHTML = '<p>Заданий не найдено. Создайте первое задание выше.</p>';
                        return;
                    }

                    tasks.forEach(task => {
                        const taskDiv = document.createElement('div');
                        taskDiv.className = 'task-list-item';

                        // Преобразование тэгов из массива в строку для отображения
                        const tagsDisplay = Array.isArray(task.tags) ? task.tags.join(', ') : (task.tags || '');

                        taskDiv.innerHTML = `
                            <h4>${task.name} (ID: ${task.id})</h4>
                            <p><strong>Уровень:</strong> ${task.min_lvl || '-'} - ${task.max_lvl || '-'}</p>
                            <p><strong>Краткое описание:</strong> ${task.short_description}</p>
                            <p><strong>Тэги:</strong> ${tagsDisplay}</p>
                            <p><strong>Откликов:</strong> ${task.application_count}</p>
                            <div class="actions">
                                <button class="delete-btn" data-task-id="${task.id}">Удалить</button>
                            </div>
                        `;
                        tasksListContainer.appendChild(taskDiv);
                    });

                    // Добавление обработчиков удаления
                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', handleDeleteTask);
                    });

                } catch (error) {
                    console.error('Ошибка загрузки заданий:', error);
                    showMessage(listMessage, `Ошибка: ${error.message}`, 'error');
                }
            };

            // 2. СОЗДАНИЕ ЗАДАНИЯ (POST /api/admin/tasks)
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                hideMessage(createMessage);
                createBtn.disabled = true;
                createBtn.textContent = 'Создание...';

                const formData = new FormData(createForm);

                // Обработка тэгов: строка -> массив строк
                const tagsInput = formData.get('tags');
                const tagsArray = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];

                const data = {
                    name: formData.get('name'),
                    short_description: formData.get('short_description'),
                    description: formData.get('description'),
                    min_lvl: formData.get('min_lvl') ? parseInt(formData.get('min_lvl')) : null,
                    max_lvl: formData.get('max_lvl') ? parseInt(formData.get('max_lvl')) : null,
                    tags: tagsArray
                };

                try {
                    const newTask = await apiCall('/api/admin/tasks', 'POST', data);
                    showMessage(createMessage, `✅ Задание "${newTask.name}" успешно создано (ID: ${newTask.id})!`, 'success');
                    createForm.reset(); // Очистка формы
                    loadTasks(); // Обновление списка

                } catch (error) {
                    console.error('Ошибка создания задания:', error);
                    showMessage(createMessage, `❌ Ошибка создания: ${error.message}`, 'error');
                } finally {
                    createBtn.disabled = false;
                    createBtn.textContent = 'Создать задание';
                }
            });


            // 3. УДАЛЕНИЕ ЗАДАНИЯ (DELETE /api/admin/tasks/<id>)
            const handleDeleteTask = async (e) => {
                const taskId = e.target.dataset.taskId;
                if (!confirm(`Вы уверены, что хотите удалить задание ID: ${taskId}? Это также удалит все связанные заявки!`)) {
                    return;
                }

                const deleteBtn = e.target;
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Удаление...';

                try {
                    // 204 No Content возвращает null, это нормально
                    await apiCall(`/api/admin/tasks/${taskId}`, 'DELETE');
                    showMessage(listMessage, `✅ Задание ID: ${taskId} успешно удалено.`, 'success');
                    loadTasks(); // Обновление списка
                } catch (error) {
                    console.error('Ошибка удаления задания:', error);
                    showMessage(listMessage, `❌ Ошибка удаления задания ID: ${taskId}. ${error.message}`, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = 'Удалить';
                }
            };

            // 4. ИМПОРТ ОДНОГО ЗАДАНИЯ (POST /api/admin/tasks)
            importForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                hideMessage(importMessage);
                importBtn.disabled = true;
                importBtn.textContent = 'Импорт...';

                const jsonDataTextarea = document.getElementById('json_data');
                const jsonString = jsonDataTextarea.value.trim();

                if (!jsonString) {
                    showMessage(importMessage, '❌ Пожалуйста, вставьте JSON данные.', 'error');
                    importBtn.disabled = false;
                    importBtn.textContent = 'Импортировать JSON';
                    return;
                }

                let taskData;
                try {
                    // Попытка парсинга строки в JS объект
                    taskData = JSON.parse(jsonString);
                } catch (error) {
                    console.error('Ошибка парсинга JSON:', error);
                    showMessage(importMessage, `❌ Ошибка парсинга JSON: Неверный формат. ${error.message}`, 'error');
                    importBtn.disabled = false;
                    importBtn.textContent = 'Импортировать JSON';
                    return;
                }

                // *** КОРРЕКТИРОВКА: Проверка на то, что это именно объект, а не массив ***
                if (Array.isArray(taskData) || typeof taskData !== 'object' || taskData === null) {
                    showMessage(importMessage, '❌ Ошибка: Ожидается JSON-объект одного задания, а не массив.', 'error');
                    importBtn.disabled = false;
                    importBtn.textContent = 'Импортировать JSON';
                    return;
                }
                // ************************************************************************

                try {
                    // Отправка распарсенного объекта
                    const newTask = await apiCall('/api/admin/tasks', 'POST', taskData);

                    // Ожидаем один объект задания в ответ
                    const name = newTask.name || 'Название не указано';
                    const id = newTask.id || 'ID не указан';

                    showMessage(importMessage, `✅ Задание "${name}" успешно импортировано (ID: ${id})!`, 'success');
                    importForm.reset(); // Очистка формы
                    loadTasks(); // Обновление списка

                } catch (error) {
                    console.error('Ошибка импорта задания:', error);
                    showMessage(importMessage, `❌ Ошибка импорта: ${error.message}`, 'error');
                } finally {
                    importBtn.disabled = false;
                    importBtn.textContent = 'Импортировать JSON';
                }
            });

            // Запуск загрузки при старте
            loadTasks();
        });