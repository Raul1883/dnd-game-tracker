document.addEventListener('DOMContentLoaded', () => {
            const mainMessage = document.getElementById('main-message');
            const tableBody = document.getElementById('applications-table-body');

            // --- УТИЛИТЫ ---
            const STATUSES = ['default', 'confirmed', 'outdated'];
            const STATUS_NAMES = {
                'default': 'В ожидании',
                'confirmed': 'Подтверждено',
                'outdated': 'Устарело'
            };

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

            // --- ФУНКЦИИ УПРАВЛЕНИЯ ЗАЯВКАМИ ---

            // 1. ЗАГРУЗКА И ОТОБРАЖЕНИЕ СПИСКА (GET /api/admin/applications)
            const loadApplications = async () => {
                showMessage(mainMessage, 'Загрузка списка заявок...', 'loading');
                tableBody.innerHTML = '';

                try {
                    const applications = await apiCall('/api/admin/applications');
                    hideMessage(mainMessage);

                    if (applications.length === 0) {
                        showMessage(mainMessage, 'Активных заявок не найдено.', 'success');
                        return;
                    }

                    applications.forEach(app => {
                        const row = tableBody.insertRow();
                        row.dataset.appId = app.id;

                        // Форматирование времени
                        const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';
                        const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();
                        const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) {
        return '-';
    }

    try {
        // 1. Разделяем строку по 'T'
        const parts = dateTimeStr.split('T');
        if (parts.length < 2) {
            return dateTimeStr.replace(/-/g, '.').substring(0, 10); // Возвращаем только дату, если нет времени
        }

        const datePart = parts[0]; // "2025-11-05"
        const timePart = parts[1]; // "14:46:53.888455Z"

        // 2. Форматируем дату: заменяем дефисы на точки
        const formattedDate = datePart.replace(/-/g, '.'); // "2025.11.05"

        // 3. Форматируем время: берем только часы и минуты (первые 5 символов)
        const formattedTime = timePart.substring(0, 5); // "14:46"

        return `${formattedDate} ${formattedTime}`; // "2025.11.05 14:46"
    } catch (e) {
        console.error("Ошибка форматирования даты-времени:", e);
        return '-';
    }
};

                        row.innerHTML = `
                            <td>${app.id}</td>
                            <td>
                                <div class="status-controls">
                                    ${createStatusSelectHTML(app.id, app.status)}
                                    <button class="save-status-btn" data-app-id="${app.id}">Сохранить</button>
                                    <button class="delete-app-btn" data-app-id="${app.id}">Удалить</button>
                                </div>
                            </td>
                            <td>${app.task_id}</td>
                            <td>${app.name}</td>
                            <td>${formatDate(app.game_date)}</td>
                            <td>${formatTime(app.time_start)}</td>
                            <td>${formatTime(app.time_end)}</td>
                            <td title="${app.info || ''}">${(app.info && app.info.length > 50) ? app.info.substring(0, 47) + '...' : (app.info || '-')}</td>
                            <td>${formatDateTime(app.created_at)}</td>
                        `;
                    });

                    // 2. Добавление обработчиков клика к кнопкам сохранения
                    document.querySelectorAll('.save-status-btn').forEach(btn => {
                        btn.addEventListener('click', handleSaveStatus);
                    });

                    document.querySelectorAll('.delete-app-btn').forEach(btn => {
                        btn.addEventListener('click', handleDeleteApplication);
                    });

                } catch (error) {
                    console.error('Ошибка загрузки заявок:', error);
                    showMessage(mainMessage, `Ошибка загрузки: ${error.message}`, 'error');
                }
            };

            // --- ИСПРАВЛЕННАЯ ФУНКЦИЯ: ГЕНЕРИРУЕТ SELECT КАК HTML-СТРОКУ ---
            const createStatusSelectHTML = (appId, currentStatus) => {
                let optionsHtml = '';

                STATUSES.forEach(status => {
                    // Явно добавляем атрибут 'selected' в HTML-строку для нужной опции
                    const selected = (status === currentStatus) ? ' selected' : '';
                    optionsHtml += `<option value="${status}"${selected}>${STATUS_NAMES[status]}</option>`;
                });

                // Возвращаем полную строку SELECT
                return `<select class="status-select ${currentStatus}" data-app-id="${appId}">${optionsHtml}</select>`;
            };


            // 3. ОБНОВЛЕНИЕ СТАТУСА ПО КЛИКУ КНОПКИ (PUT /api/admin/applications/<id>)
            const handleSaveStatus = async (e) => {
                const button = e.target;
                const appId = button.dataset.appId;

                const statusControls = button.closest('.status-controls');
                const selectElement = statusControls.querySelector('.status-select');

                const newStatus = selectElement.value;
                const originalText = button.textContent;

                // Блокируем элементы управления
                button.disabled = true;
                selectElement.disabled = true;
                button.textContent = '...';

                try {
                    const updatedApp = await apiCall(`/api/admin/applications/${appId}`, 'PUT', { status: newStatus });

                    // Обновление класса
                    selectElement.className = `status-select ${updatedApp.status}`;

                    // Краткое сообщение об успехе
                    showMessage(mainMessage, `✅ Статус заявки ${appId} обновлен до: ${STATUS_NAMES[updatedApp.status]}.`, 'success');
                    setTimeout(() => hideMessage(mainMessage), 3000);

                } catch (error) {
                    console.error('Ошибка обновления статуса:', error);

                    // Восстанавливаем предыдущее значение селектора
                    const previousStatus = selectElement.className.replace('status-select ', '');
                    selectElement.value = previousStatus;

                    showMessage(mainMessage, `❌ Ошибка обновления статуса заявки ${appId}: ${error.message}`, 'error');
                } finally {
                    button.disabled = false;
                    selectElement.disabled = false;
                    button.textContent = originalText;
                }
            };

            const handleDeleteApplication = async (e) => {
                const button = e.target;
                const appId = button.dataset.appId;
                const row = button.closest('tr');

                if (!confirm(`Вы уверены, что хотите удалить заявку ID: ${appId}?`)) {
                    return;
                }

                const originalText = button.textContent;
                button.disabled = true;
                button.textContent = '...';

                try {
                    // Используем DELETE /api/admin/applications/<id>
                    await apiCall(`/api/admin/applications/${appId}`, 'DELETE');

                    // Удаляем строку из таблицы после успешного удаления
                    row.remove();

                    showMessage(mainMessage, `✅ Заявка ID: ${appId} успешно удалена.`, 'success');
                    setTimeout(() => hideMessage(mainMessage), 3000);

                } catch (error) {
                    console.error('Ошибка удаления заявки:', error);
                    showMessage(mainMessage, `❌ Ошибка удаления заявки ID: ${appId}. ${error.message}`, 'error');

                    button.disabled = false;
                    button.textContent = originalText;
                }
            };


            // Запуск загрузки при старте
            loadApplications();
        });