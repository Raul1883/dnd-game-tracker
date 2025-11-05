document.addEventListener('DOMContentLoaded', () => {
            const adminMessage = document.getElementById('admin-message');
            const dashboardContent = document.getElementById('dashboard-content');

            const totalTasksCount = document.getElementById('total-tasks-count');
            const statusMetrics = document.getElementById('status-metrics');
            const topTasksList = document.getElementById('top-tasks-list');
            const topDatesList = document.getElementById('top-dates-list');

            const API_URL = '/api/admin/dashboard';

            const showMessage = (text, type) => {
                adminMessage.textContent = text;
                adminMessage.className = `loading ${type}`;
                adminMessage.style.display = 'block';
                dashboardContent.style.display = 'none';
            };

            const hideMessage = () => {
                adminMessage.style.display = 'none';
                dashboardContent.style.display = 'block';
            };

            const loadDashboardData = () => {
                showMessage('Загрузка данных...', 'loading');

                // Временно убран заголовок 'X-Admin-Key'
                fetch(API_URL)
                .then(async response => {
                    const responseBody = await response.json();
                    if (!response.ok) {
                        const errorMsg = responseBody.error || `Ошибка ${response.status}`;
                        throw new Error(`[${response.status}] ${errorMsg}`);
                    }
                    return responseBody;
                })
                .then(data => {
                    hideMessage();

                    // 1. Общее количество заданий
                    totalTasksCount.textContent = data.total_active_tasks;

                    // 2. Количество заявок по статусам
                    statusMetrics.innerHTML = '';
                    const statusNames = { 'default': 'В ожидании', 'confirmed': 'Подтверждено', 'outdated': 'Устарело' };

                    Object.keys(data.applications_by_status).forEach(status => {
                        const statusDiv = document.createElement('div');
                        statusDiv.className = 'list-item';
                        statusDiv.innerHTML = `<span>${statusNames[status] || status}:</span> <strong>${data.applications_by_status[status]}</strong>`;
                        statusMetrics.appendChild(statusDiv);
                    });

                    // 3. Топ-5 заданий
                    topTasksList.innerHTML = '';
                    data.top_5_tasks.forEach(item => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'list-item';
                        itemDiv.innerHTML = `<span>${item.name}</span> <strong>${item.count}</strong>`;
                        topTasksList.appendChild(itemDiv);
                    });
                    if (data.top_5_tasks.length === 0) topTasksList.innerHTML = '<p>Нет данных по заявкам.</p>';

                    // 4. Топ-5 дат
                    topDatesList.innerHTML = '';
                    data.top_5_dates.forEach(item => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'list-item';
                        const formattedDate = new Date(item.date).toLocaleDateString();
                        itemDiv.innerHTML = `<span>${formattedDate}</span> <strong>${item.count}</strong>`;
                        topDatesList.appendChild(itemDiv);
                    });
                    if (data.top_5_dates.length === 0) topDatesList.innerHTML = '<p>Нет данных по заявкам.</p>';

                })
                .catch(error => {
                    console.error('Ошибка загрузки панели:', error);
                    showMessage(`❌ Ошибка загрузки: ${error.message}`, 'error');
                });
            };

            loadDashboardData(); // Автоматический вызов при загрузке страницы
        });