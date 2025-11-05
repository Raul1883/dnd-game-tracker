document.addEventListener('DOMContentLoaded', () => {
            // DOM-элементы для списка заданий
            const tasksContainer = document.getElementById('tasks-container');
            const loadingMessage = document.getElementById('loading-message');
            const errorMessage = document.getElementById('error-message');

            // DOM-элементы для модального окна
            const modal = document.getElementById('task-modal');
            const closeBtn = document.querySelector('.close-btn');
            const taskDetails = document.getElementById('task-details');
            const modalLoading = document.getElementById('modal-loading');
            const applicationForm = document.getElementById('application-form');
            const formTaskId = document.getElementById('form-task-id');
            const appMessage = document.getElementById('app-message');
            const submitBtn = document.getElementById('submit-app-btn');


            // --- ФУНКЦИИ МОДАЛЬНОГО ОКНА ---

            const showMessage = (element, text, isSuccess) => {
                element.textContent = text;
                element.style.display = 'block';
                element.style.backgroundColor = isSuccess ? '#d4edda' : '#f8d7da';
                element.style.color = isSuccess ? '#155724' : '#721c24';
            };

            const clearForm = () => {
                applicationForm.reset();
                applicationForm.style.display = 'block';
                appMessage.style.display = 'none';
            };


            // Функция для открытия модального окна и загрузки деталей
            const showTaskDetails = (taskId) => {
                clearForm(); // Очищаем форму перед открытием
                modal.style.display = 'block';
                modalLoading.style.display = 'block';
                taskDetails.innerHTML = '';
                formTaskId.value = taskId; // Устанавливаем ID задания в скрытое поле формы

                fetch(`/api/tasks/${taskId}`)
                    .then(response => response.json())
                    .then(task => {
                        modalLoading.style.display = 'none';

                        const tagsHtml = task.tags.map(tag => `<span>${tag}</span>`).join(' ');

                        taskDetails.innerHTML = `
                            <p><strong>Задание ID:</strong> ${task.id}</p>
                            <h3>${task.name}</h3>
                            <p><strong>Описание:</strong> ${task.description}</p>
                            <p><strong>Уровень:</strong> ${task.min_lvl} - ${task.max_lvl}</p>
                            <p><strong>Тэги:</strong> <span class="tags">${tagsHtml}</span></p>
                        `;
                    })
                    .catch(error => {
                        console.error('Ошибка загрузки деталей задания:', error);
                        modalLoading.style.display = 'none';
                        taskDetails.innerHTML = '<p style="color: red;">Не удалось загрузить детали задания.</p>';
                    });
            };

            // Обработчики закрытия модального окна
            closeBtn.onclick = () => { modal.style.display = 'none'; };
            window.onclick = (event) => {
                if (event.target == modal) { modal.style.display = 'none'; }
            }


            // --- ЛОГИКА ОТПРАВКИ ЗАЯВКИ (API) ---

            applicationForm.addEventListener('submit', (event) => {
                event.preventDefault(); // Предотвращаем стандартную отправку формы
                appMessage.style.display = 'none';
                submitBtn.disabled = true;
                submitBtn.textContent = 'Отправка...';

                // 1. Сбор данных
                const data = {
                    task_id: parseInt(formTaskId.value),
                    name: document.getElementById('name').value,
                    game_date: document.getElementById('game_date').value,
                    time_start: document.getElementById('time_start').value,
                    time_end: document.getElementById('time_end').value || undefined, // Не отправляем пустую строку
                    info: document.getElementById('info').value || undefined
                };

                // 2. Базовая клиентская валидация
                if (!data.name || !data.game_date || !data.time_start) {
                    showMessage(appMessage, 'Пожалуйста, заполните все обязательные поля (*)', false);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Отправить заявку';
                    return;
                }

                // 3. Отправка POST-запроса
                fetch('/api/applications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(async response => {
                    const responseBody = await response.json();
                    if (!response.ok) {
                        // Обработка ошибок 400, 404, 500 из API
                        const errorMsg = responseBody.error || 'Произошла ошибка при обработке заявки.';
                        const errorDetails = responseBody.details || '';
                        throw new Error(`${errorMsg}: ${errorDetails}`);
                    }
                    return responseBody;
                })
                .then(application => {
                    // Успешная отправка
                    showMessage(appMessage, `✅ Заявка на задание ${application.task_id} успешно создана! Статус: ${application.status}.`, true);
                    applicationForm.style.display = 'none'; // Скрываем форму после успеха

                    // Обновляем список заданий на главной странице (для изменения application_count)
                    // (Можно реализовать вызов функции listTasks для обновления всего списка)
                })
                .catch(error => {
                    // Обработка ошибок
                    console.error('Ошибка API при отправке заявки:', error);
                    showMessage(appMessage, `❌ Ошибка: ${error.message}`, false);
                })
                .finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Отправить заявку';
                });
            });


            // --- ЛОГИКА ЗАГРУЗКИ СПИСКА ЗАДАНИЙ ---

            const loadTasks = () => {
                fetch('/api/tasks')
                    .then(response => response.json())
                    .then(tasks => {
                        loadingMessage.style.display = 'none';
                        tasksContainer.innerHTML = '';

                        if (tasks.length === 0) {
                            tasksContainer.innerHTML = '<p>Активных заданий пока нет.</p>';
                            return;
                        }

                        tasks.forEach(task => {
                            const taskDiv = document.createElement('div');
                            taskDiv.className = 'task-item';

                            const tagsHtml = task.tags.map(tag => `<span>${tag}</span>`).join(' ');

                            taskDiv.innerHTML = `
                                <h3>${task.name}</h3>
                                <p><strong>Уровень:</strong> ${task.min_lvl} - ${task.max_lvl}</p>
                                <p>${task.short_description}</p>
                                <p>
                                    <strong>Тэги:</strong> <span class="tags">${tagsHtml}</span>
                                </p>
                                <p><strong>Откликов:</strong> ${task.application_count}</p>
                                <button class="details-btn" data-task-id="${task.id}">Подробнее и записаться</button>
                            `;
                            tasksContainer.appendChild(taskDiv);
                        });

                        // Добавляем слушатель событий к кнопкам "Подробнее"
                        document.querySelectorAll('.details-btn').forEach(button => {
                            button.addEventListener('click', (event) => {
                                const taskId = event.target.dataset.taskId;
                                showTaskDetails(taskId);
                            });
                        });
                    })
                    .catch(error => {
                        console.error('Ошибка при получении заданий:', error);
                        loadingMessage.style.display = 'none';
                        errorMessage.style.display = 'block';
                    });
            };

            loadTasks(); // Вызываем загрузку заданий при старте
        });