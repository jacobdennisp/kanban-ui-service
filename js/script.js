const API_BASE_URL="https://todo.api.eventslab.in/api";
//const API_BASE_URL="http://localhost:8082/api";
let currentEditingTask = null;

// Initialize application
$(document).ready(function() {
    initializeApp();
});

function initializeApp() {
    // Load tasks on page load
    loadTasks();
    
    // Initialize sortable/draggable columns
    initializeSortable();
    
    // Event listeners
    $('#addTaskBtn').on('click', openAddTaskModal);
    $('#cancelModal').on('click', closeModal);
    $('#taskForm').on('submit', handleTaskSubmit);
    $('#refreshBtn').on('click', loadTasks);
    
    // Close modal on outside click
    $('#taskModal').on('click', function(e) {
        if (e.target.id === 'taskModal') {
            closeModal();
        }
    });
    
    // Set minimum date for due date
    const today = new Date().toISOString().split('T')[0];
    $('#due_date').attr('min', today);
}

// Initialize jQuery UI Sortable
function initializeSortable() {
    $('.kanban-column').sortable({
        connectWith: '.kanban-column',
        cursor: 'move',
        opacity: 0.7,
        placeholder: 'ui-sortable-placeholder',
        start: function(event, ui) {
            ui.item.addClass('dragging');
        },
        stop: function(event, ui) {
            ui.item.removeClass('dragging');
        },
        update: function(event, ui) {
            // Only trigger if item moved to a different column
            if (this === ui.item.parent()[0]) {
                const taskId = ui.item.data('task-id');
                const newStatus = $(this).data('status');
                updateTaskStatus(taskId, newStatus);
            }
        }
    }).disableSelection();
}

// Load all tasks from API
function loadTasks() {
    showLoading();
    
    $.ajax({
        url: `${API_BASE_URL}/tasks`,
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        success: function(response) {
            hideLoading();
            displayTasks(response.data || response);
            updateStats();
        },
        error: function(xhr, status, error) {
            hideLoading();
            console.error('Error loading tasks:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load tasks. Please try again.',
                confirmButtonColor: '#4f46e5'
            });
        }
    });
}

// Display tasks in Kanban columns
function displayTasks(tasks) {
    // Clear all columns
    $('#todoColumn, #inProgressColumn, #doneColumn').empty();
    
    if (!tasks || tasks.length === 0) {
        displayEmptyState();
        return;
    }
    
    tasks.forEach(task => {
        const taskCard = createTaskCard(task);
        const columnId = getColumnId(task.status);
        $(`#${columnId}`).append(taskCard);
    });
    
    updateColumnCounts();
}

// Create task card HTML
function createTaskCard(task) {
    const priorityClass = priority-`${task.priority}`;
    const dueDateHtml = task.due_date ? 
        `<div class="task-date ${isOverdue(task.due_date) ? 'overdue' : ''}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            ${formatDate(task.due_date)}
        </div>` : '';
    
    const card = $(`
        <div class="task-card ${priorityClass} fade-in" data-task-id="${task.id}">
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-gray-800 font-semibold text-sm flex-1">${escapeHtml(task.title)}</h3>
                <span class="priority-badge ${priorityClass} ml-2">${task.priority}</span>
            </div>
            ${task.description ? `<p class="text-gray-600 text-sm mb-2">${escapeHtml(task.description)}</p>` : ''}
            ${dueDateHtml}
            <div class="task-actions">
                <button class="task-action-btn edit-btn" onclick="editTask(${task.id})">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    Edit
                </button>
                <button class="task-action-btn delete-btn" onclick="deleteTask(${task.id})">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Delete
                </button>
            </div>
        </div>
    `);
    
    return card;
}

// Get column ID based on status
function getColumnId(status) {
    const statusMap = {
        'todo': 'todoColumn',
        'wip': 'inProgressColumn',
        'done': 'doneColumn'
    };
    return statusMap[status] || 'todoColumn';
}

// Update task status when moved
function updateTaskStatus(taskId, newStatus) {
    $.ajax({
        url: `${API_BASE_URL}/tasks/${taskId}/status`,
        method: 'PUT',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        data: JSON.stringify({ status: newStatus }),
        success: function(response) {
            updateStats();
            updateColumnCounts();
            
            Swal.fire({
                icon: 'success',
                title: 'Task Updated',
                text: 'Task status has been updated successfully',
                timer: 1500,
                showConfirmButton: false
            });
        },
        error: function(xhr, status, error) {
            console.error('Error updating task status:', error);
            loadTasks(); // Reload to reset position
            
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update task status',
                confirmButtonColor: '#4f46e5'
            });
        }
    });
}

// Open modal to add new task
function openAddTaskModal() {
    currentEditingTask = null;
    $('#modalTitle').text('Add New Task');
    $('#taskForm')[0].reset();
    $('#taskId').val('');
    $('#taskModal').removeClass('hidden');
}

// Edit task
function editTask(taskId) {
    $.ajax({
        url: `${API_BASE_URL}/tasks/${taskId}`,
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        success: function(response) {
            const task = response.data || response;
            currentEditingTask = task;
            
            $('#modalTitle').text('Edit Task');
            $('#taskId').val(task.id);
            $('#title').val(task.title);
            $('#description').val(task.description || '');
            $('#priority').val(task.priority);
            $('#due_date').val(task.due_date || '');
            
            $('#taskModal').removeClass('hidden');
        },
        error: function(xhr, status, error) {
            console.error('Error loading task:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load task details',
                confirmButtonColor: '#4f46e5'
            });
        }
    });
}

// Delete task
function deleteTask(taskId) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `${API_BASE_URL}/tasks/${taskId}`,
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                },
                success: function(response) {
                    loadTasks();
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted!',
                        text: 'Task has been deleted.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                },
                error: function(xhr, status, error) {
                    console.error('Error deleting task:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Failed to delete task',
                        confirmButtonColor: '#4f46e5'
                    });
                }
            });
        }
    });
}

// Handle task form submission
function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskId = $('#taskId').val();
    const taskData = {
        title: $('#title').val(),
        description: $('#description').val(),
        priority: $('#priority').val(),
        due_date: $('#due_date').val() || null,
        status: currentEditingTask ? currentEditingTask.status : 'todo'
    };
    
    const url = taskId ? `${API_BASE_URL}/tasks/${taskId}` : `${API_BASE_URL}/tasks`;
    const method = taskId ? 'PUT' : 'POST';
    
    $.ajax({
        url: url,
        method: method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(taskData),
        success: function(response) {
            closeModal();
            loadTasks();
            
            Swal.fire({
                icon: 'success',
                title: taskId ? 'Task Updated!' : 'Task Created!',
                text: taskId ? 'Task has been updated successfully' : 'New task has been created successfully',
                timer: 1500,
                showConfirmButton: false
            });
        },
        error: function(xhr, status, error) {
            console.error('Error saving task:', error);
            const errorMessage = xhr.responseJSON?.message || 'Failed to save task';
            
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMessage,
                confirmButtonColor: '#4f46e5'
            });
        }
    });
}

// Close modal
function closeModal() {
    $('#taskModal').addClass('hidden');
    $('#taskForm')[0].reset();
    currentEditingTask = null;
}

// Update statistics
function updateStats() {
    $.ajax({
        url: `${API_BASE_URL}/tasks/stats`,
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        success: function(response) {
            const stats = response.data || response;
            $('#TotalTasks').text(stats.total || 0);
            $('#inProgressTasks').text(stats.wip || 0);
            $('#completedTasks').text(stats.completed || 0);
            $('#highPriorityTasks').text(stats.high_priority || 0);
        },
        error: function(xhr, status, error) {
            console.error('Error loading stats:', error);
        }
    });
}

// Update column counts
function updateColumnCounts() {
    $('#todoCount').text($('#todoColumn .task-card').length);
    $('#progressCount').text($('#inProgressColumn .task-card').length);
    $('#doneCount').text($('#doneColumn .task-card').length);
}

// Display empty state
function displayEmptyState() {
    const emptyHtml = `
        <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p>No tasks yet</p>
            <button onclick="openAddTaskModal()" class="mt-2 text-indigo-600 hover:text-indigo-700">Create your first task</button>
        </div>
    `;
    
    $('#todoColumn').html(emptyHtml);
}

// Utility Functions
function showLoading() {
    const spinner = '<div class="spinner"></div>';
    $('#todoColumn, #inProgressColumn, #doneColumn').html(spinner);
}

function hideLoading() {
    $('.spinner').remove();
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function isOverdue(dateString) {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

// Make functions globally available
window.editTask = editTask;
window.deleteTask = deleteTask;




window.openAddTaskModal = openAddTaskModal;