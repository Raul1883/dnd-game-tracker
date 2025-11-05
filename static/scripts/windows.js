document.addEventListener('DOMContentLoaded', () => {
            const createForm = document.getElementById('create-window-form');
            const createMessage = document.getElementById('create-message');
            const createBtn = document.getElementById('create-btn');
            const listMessage = document.getElementById('list-message');
            const windowsListContainer = document.getElementById('windows-list-container');

            // --- УТИЛИТЫ ---

            const showMessage = (element, text, type) => {
                element.textContent = text;
                element.className = `message ${type}`;
                element.style.display = 'block';
            };

            const hideMessage = (element) => {
                element.style.display = 'none';
            };

            const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';

            // ИСПРАВЛЕНИЕ 1: Более надежный парсинг даты YYYY-MM-DD
            const formatDate = (dateStr) => {
                if (!dateStr) return '-';

                // Добавляем "T00:00:00Z" (midnight UTC), чтобы избежать
                // смещения даты из-за локальной временной зоны и предотвратить "Invalid Date"
                try {
                    const date = new Date(dateStr + 'T00:00:00Z');
                    // Проверяем на "Invalid Date"
                    if (isNaN(date.getTime())) {
                        return 'Ошибка даты';
                    }
                    return date.toLocaleDateString();
                } catch (e) {
                    return 'Ошибка даты';
                }
            };

            const apiCall = async (url, method = 'GET', data = null) => {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        // 'X-Admin-Key': 'ADMIN_KEY' // Временно убрано
                    }
                };

                if (data) {
                    options.body = JSON.stringify(data);
                }

                const response = await fetch(url, options);
                let responseBody = {};

                if (response.status === 204) return null;

                try {
                    responseBody = await response.json();
                } catch (e) {
                    throw new Error(`[${response.status}] Не удалось распарсить ответ.`);
                }

                if (!response.ok) {
                    const errorMsg = responseBody.error || `Ошибка ${response.status}`;
                    const errorDetails = responseBody.details || '';
                    throw new Error(`${errorMsg}: ${errorDetails}`);
                }

                return responseBody;
            };

            // --- ФУНКЦИИ УПРАВЛЕНИЯ ОКНАМИ ---

            // 1. ЗАГРУЗКА И ОТОБРАЖЕНИЕ СПИСКА (GET /api/windows)
            const loadWindows = async () => {
                showMessage(listMessage, 'Загрузка списка окон...', 'loading');
                windowsListContainer.innerHTML = '';

                try {
                    const windows = await apiCall('/api/windows');
                    hideMessage(listMessage);

                    if (windows.length === 0) {
                        windowsListContainer.innerHTML = '<p>Активных временных окон не найдено. Создайте первое окно выше.</p>';
                        return;
                    }

                    windows.forEach(window => {
                        const windowDiv = document.createElement('div');
                        windowDiv.className = 'windows-list-item';

                        windowDiv.innerHTML = `
                            <div class="details">
                                <h4>📅 ${formatDate(window.game_date)}</h4> <p><strong>Время:</strong> ${formatTime(window.time_start)} &mdash; ${formatTime(window.time_end)} (ID: ${window.id})</p>
                            </div>
                            <div class="actions">
                                <button class="delete-btn" data-window-id="${window.id}">Удалить</button>
                            </div>
                        `;
                        windowsListContainer.appendChild(windowDiv);
                    });

                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', handleDeleteWindow);
                    });

                } catch (error) {
                    console.error('Ошибка загрузки окон:', error);
                    showMessage(listMessage, `Ошибка: ${error.message}`, 'error');
                }
            };

            // 2. СОЗДАНИЕ ОКНА (POST /api/admin/windows)
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                hideMessage(createMessage);
                createBtn.disabled = true;
                createBtn.textContent = 'Создание...';

                const formData = new FormData(createForm);

                const data = {
                    game_date: formData.get('game_date'),
                    time_start: formData.get('time_start'),
                    time_end: formData.get('time_end'),
                };

                if (!data.game_date || !data.time_start || !data.time_end) {
                    showMessage(createMessage, 'Пожалуйста, заполните все поля.', 'error');
                    createBtn.disabled = false;
                    createBtn.textContent = 'Создать окно';
                    return;
                }

                try {
                    const newWindow = await apiCall('/api/admin/windows', 'POST', data);
                    // При выводе сообщения используем поле game_date, которое, судя по структуре API, должно присутствовать в ответе
                    showMessage(createMessage, `✅ Окно на ${formatDate(newWindow.game_date)} успешно создано! (ID: ${newWindow.id})`, 'success');
                    createForm.reset();
                    loadWindows();

                } catch (error) {
                    console.error('Ошибка создания окна:', error);
                    showMessage(createMessage, `❌ Ошибка создания: ${error.message}`, 'error');
                } finally {
                    createBtn.disabled = false;
                    createBtn.textContent = 'Создать окно';
                }
            });


            // 3. УДАЛЕНИЕ ОКНА (DELETE /api/admin/windows/<id>)
            const handleDeleteWindow = async (e) => {
                const windowId = e.target.dataset.windowId;
                if (!confirm(`Вы уверены, что хотите удалить окно ID: ${windowId}? Это окно больше не будет отображаться.`)) {
                    return;
                }

                const deleteBtn = e.target;
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Удаление...';

                try {
                    await apiCall(`/api/admin/windows/${windowId}`, 'DELETE');
                    showMessage(listMessage, `✅ Окно ID: ${windowId} успешно удалено.`, 'success');
                    loadWindows();
                } catch (error) {
                    console.error('Ошибка удаления окна:', error);
                    showMessage(listMessage, `❌ Ошибка удаления окна ID: ${windowId}. ${error.message}`, 'error');
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = 'Удалить';
                }
            };

            loadWindows();
        });