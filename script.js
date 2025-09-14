// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize progress bars
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => {
        const percentage = bar.getAttribute('data-percentage') || '75';
        setTimeout(() => {
            bar.style.width = percentage + '%';
        }, 500);
    });

    // Initialize charts (simple progress visualization)
    initializeProgressCharts();
    
    // Initialize notification system
    initializeNotifications();
    
    // Initialize scheduling system
    initializeScheduling();

    // Initialize authentication forms
    initializeAuthForms();

    // Load dashboard data if user is logged in
    if (window.currentUser) {
        loadDashboardData();
    }
});

function initializeProgressCharts() {
    // Simulate progress data
    const progressData = [
        { therapy: 'Abhyanga', progress: 75, sessions: 6, total: 8 },
        { therapy: 'Shirodhara', progress: 50, sessions: 3, total: 6 },
        { therapy: 'Basti', progress: 25, sessions: 2, total: 8 }
    ];

    // Update progress cards if they exist
    const progressCards = document.querySelectorAll('.progress-card');
    progressCards.forEach((card, index) => {
        if (progressData[index]) {
            const data = progressData[index];
            const progressBar = card.querySelector('.progress-fill');
            const sessionsText = card.querySelector('.sessions-text');
            
            if (progressBar) {
                progressBar.style.width = data.progress + '%';
                progressBar.setAttribute('data-percentage', data.progress);
            }
            
            if (sessionsText) {
                sessionsText.textContent = `${data.sessions}/${data.total} sessions completed`;
            }
        }
    });
}

function initializeNotifications() {
    // Sample notifications data
    const notifications = [
        {
            type: 'reminder',
            title: 'Therapy Session Tomorrow',
            message: 'Your Abhyanga session is scheduled for 10:00 AM. Please arrive 15 minutes early.',
            time: '2 hours ago',
            icon: 'fas fa-bell'
        },
        {
            type: 'feedback',
            title: 'Feedback Request',
            message: 'Please share your experience from yesterday\'s Shirodhara session.',
            time: '1 day ago',
            icon: 'fas fa-comment'
        },
        {
            type: 'preparation',
            title: 'Pre-Session Instructions',
            message: 'Remember to follow the dietary guidelines before your Basti session.',
            time: '2 days ago',
            icon: 'fas fa-info-circle'
        }
    ];

    // Populate notifications if container exists
    const notificationsContainer = document.querySelector('.notifications-container');
    if (notificationsContainer) {
        notificationsContainer.innerHTML = '';
        notifications.forEach(notification => {
            const notificationElement = createNotificationElement(notification);
            notificationsContainer.appendChild(notificationElement);
        });
    }
}

function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = 'notification-item';
    div.innerHTML = `
        <div class="notification-icon">
            <i class="${notification.icon}"></i>
        </div>
        <div class="notification-content">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <span class="notification-time">${notification.time}</span>
        </div>
    `;
    return div;
}

function initializeScheduling() {
    // Sample schedule data
    const scheduleData = [
        {
            time: '10:00 AM',
            therapy: 'Abhyanga',
            practitioner: 'Dr. Priya Sharma',
            status: 'confirmed'
        },
        {
            time: '2:00 PM',
            therapy: 'Shirodhara',
            practitioner: 'Dr. Raj Patel',
            status: 'pending'
        },
        {
            time: '4:30 PM',
            therapy: 'Basti',
            practitioner: 'Dr. Priya Sharma',
            status: 'confirmed'
        }
    ];

    // Populate schedule if container exists
    const scheduleContainer = document.querySelector('.schedule-container');
    if (scheduleContainer) {
        scheduleContainer.innerHTML = '';
        scheduleData.forEach(appointment => {
            const scheduleElement = createScheduleElement(appointment);
            scheduleContainer.appendChild(scheduleElement);
        });
    }
}

function createScheduleElement(appointment) {
    const div = document.createElement('div');
    div.className = 'schedule-item';
    div.innerHTML = `
        <div>
            <div class="schedule-time">${appointment.time}</div>
            <div class="schedule-details">${appointment.therapy} with ${appointment.practitioner}</div>
        </div>
        <span class="status-badge status-${appointment.status}">${appointment.status}</span>
    `;
    return div;
}

// Form handling
function handleFormSubmission(formId, successMessage) {
    const form = document.getElementById(formId);
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;
            
            // Simulate form submission
            setTimeout(() => {
                alert(successMessage);
                form.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 1500);
        });
    }
}

// Initialize form handlers
document.addEventListener('DOMContentLoaded', function() {
    handleFormSubmission('contact-form', 'Thank you for your message! We will get back to you soon.');
    handleFormSubmission('feedback-form', 'Thank you for your feedback! It helps us improve our services.');
});

// Add animation on scroll
function animateOnScroll() {
    const elements = document.querySelectorAll('.benefit-card, .feature-item, .dashboard-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
}

// Initialize scroll animations
document.addEventListener('DOMContentLoaded', animateOnScroll);

// Dashboard specific functions
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

function updateProgress(progressId, percentage) {
    const progressBar = document.getElementById(progressId);
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
}

// FAQ functionality
function initializeFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close other open items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

// Initialize FAQ on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeFAQ();
});

// Authentication functions
function initializeAuthForms() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Registration form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Feedback form
    const feedbackForm = document.getElementById('feedback-form');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleFeedbackSubmit);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        const response = await window.api.login(email, password);
        if (response.success) {
            window.api.setToken(response.data.token);
            window.currentUser = response.data.user;
            updateUIForLoggedInUser();
            
            // Redirect to appropriate dashboard
            const redirectUrl = response.data.user.role === 'patient' 
                ? 'patient-dashboard.html' 
                : 'practitioner-dashboard.html';
            window.location.href = redirectUrl;
        }
    } catch (error) {
        window.api.handleError(error);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userData = {
        email: formData.get('email'),
        password: formData.get('password'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        role: formData.get('role'),
        phone: formData.get('phone')
    };

    // Add role-specific data
    if (userData.role === 'patient') {
        userData.dateOfBirth = formData.get('dateOfBirth');
        userData.gender = formData.get('gender');
    } else if (userData.role === 'practitioner') {
        userData.licenseNumber = formData.get('licenseNumber');
        userData.experience = parseInt(formData.get('experience')) || 0;
        userData.consultationFee = parseFloat(formData.get('consultationFee')) || 0;
    }

    try {
        const response = await window.api.register(userData);
        if (response.success) {
            window.api.setToken(response.data.token);
            window.currentUser = response.data.user;
            updateUIForLoggedInUser();
            
            // Redirect to appropriate dashboard
            const redirectUrl = response.data.user.role === 'patient' 
                ? 'patient-dashboard.html' 
                : 'practitioner-dashboard.html';
            window.location.href = redirectUrl;
        }
    } catch (error) {
        window.api.handleError(error);
    }
}

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Get the selected appointment (you might need to implement appointment selection)
    const appointmentId = formData.get('appointmentId') || 'sample-appointment-id';
    
    const feedbackData = {
        appointmentId: appointmentId,
        therapyType: formData.get('session-type'),
        rating: {
            overall: parseInt(formData.get('rating')),
            practitioner: parseInt(formData.get('rating')),
            facility: parseInt(formData.get('rating')),
            cleanliness: parseInt(formData.get('rating')),
            value: parseInt(formData.get('rating'))
        },
        comments: formData.get('feedback-text'),
        symptoms: {
            before: formData.get('symptoms-before') ? formData.get('symptoms-before').split(',') : [],
            after: formData.get('symptoms-after') ? formData.get('symptoms-after').split(',') : [],
            improvement: formData.get('improvement') || 'moderate'
        },
        sideEffects: formData.get('symptoms') ? formData.get('symptoms').split(',') : [],
        recommendations: formData.get('recommendations') || '',
        wouldRecommend: formData.get('wouldRecommend') === 'on'
    };

    try {
        const response = await window.api.submitFeedback(feedbackData);
        if (response.success) {
            alert('Thank you for your feedback!');
            e.target.reset();
        }
    } catch (error) {
        window.api.handleError(error);
    }
}

// Load dashboard data from API
async function loadDashboardData() {
    if (!window.currentUser) return;

    try {
        if (window.currentUser.role === 'patient') {
            await loadPatientDashboardData();
        } else if (window.currentUser.role === 'practitioner') {
            await loadPractitionerDashboardData();
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadPatientDashboardData() {
    try {
        // Load patient profile
        const profileResponse = await window.api.getPatientProfile();
        if (profileResponse.success) {
            updatePatientProfile(profileResponse.data);
        }

        // Load appointments
        const appointmentsResponse = await window.api.getPatientAppointments({ limit: 5 });
        if (appointmentsResponse.success) {
            updateAppointmentsList(appointmentsResponse.data.appointments);
        }

        // Load progress
        const progressResponse = await window.api.getPatientProgress();
        if (progressResponse.success) {
            updateProgressDisplay(progressResponse.data);
        }

        // Load notifications
        const notificationsResponse = await window.api.getNotifications({ limit: 5 });
        if (notificationsResponse.success) {
            updateNotificationsList(notificationsResponse.data.notifications);
        }
    } catch (error) {
        console.error('Error loading patient dashboard data:', error);
    }
}

async function loadPractitionerDashboardData() {
    try {
        // Load practitioner profile
        const profileResponse = await window.api.getPractitionerProfile();
        if (profileResponse.success) {
            updatePractitionerProfile(profileResponse.data);
        }

        // Load patients
        const patientsResponse = await window.api.getPractitionerPatients({ limit: 5 });
        if (patientsResponse.success) {
            updatePatientsList(patientsResponse.data.patients);
        }

        // Load appointments
        const appointmentsResponse = await window.api.getPractitionerAppointments({ limit: 5 });
        if (appointmentsResponse.success) {
            updateAppointmentsList(appointmentsResponse.data.appointments);
        }

        // Load analytics
        const analyticsResponse = await window.api.getPractitionerAnalytics();
        if (analyticsResponse.success) {
            updateAnalyticsDisplay(analyticsResponse.data);
        }
    } catch (error) {
        console.error('Error loading practitioner dashboard data:', error);
    }
}

function updatePatientProfile(profile) {
    // Update patient-specific UI elements
    const progressData = profile.panchakarmaHistory?.currentTherapy;
    if (progressData) {
        const progressElement = document.querySelector('.therapy-progress');
        if (progressElement) {
            progressElement.innerHTML = `
                <div class="therapy-item">
                    <div class="therapy-info">
                        <h4>${progressData.type}</h4>
                        <p class="sessions-text">${progressData.sessionsCompleted}/${progressData.totalSessions} sessions completed</p>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" data-percentage="${Math.round((progressData.sessionsCompleted / progressData.totalSessions) * 100)}"></div>
                        </div>
                        <span class="progress-percentage">${Math.round((progressData.sessionsCompleted / progressData.totalSessions) * 100)}%</span>
                    </div>
                </div>
            `;
        }
    }
}

function updatePractitionerProfile(profile) {
    // Update practitioner-specific UI elements
    const statsCards = document.querySelectorAll('.stat-card');
    if (statsCards.length >= 4) {
        statsCards[0].querySelector('.stat-number').textContent = profile.patients?.length || 0;
        statsCards[1].querySelector('.stat-number').textContent = '8'; // Today's sessions - would come from appointments
        statsCards[2].querySelector('.stat-number').textContent = '156'; // Total sessions - would come from appointments
        statsCards[3].querySelector('.stat-number').textContent = profile.rating?.average || '4.8';
    }
}

function updateAppointmentsList(appointments) {
    const scheduleContainer = document.querySelector('.schedule-container');
    if (scheduleContainer && appointments) {
        scheduleContainer.innerHTML = '';
        appointments.forEach(appointment => {
            const appointmentElement = createAppointmentElement(appointment);
            scheduleContainer.appendChild(appointmentElement);
        });
    }
}

function createAppointmentElement(appointment) {
    const div = document.createElement('div');
    div.className = 'schedule-item';
    div.innerHTML = `
        <div>
            <div class="schedule-time">${appointment.startTime}</div>
            <div class="schedule-details">${appointment.therapyType} ${appointment.patient ? `- ${appointment.patient.userId?.firstName} ${appointment.patient.userId?.lastName}` : ''}</div>
        </div>
        <span class="status-badge status-${appointment.status}">${appointment.status}</span>
    `;
    return div;
}

function updatePatientsList(patients) {
    const patientList = document.querySelector('.patient-list');
    if (patientList && patients) {
        const patientItems = patientList.querySelectorAll('.patient-item');
        patientItems.forEach((item, index) => {
            if (patients[index]) {
                const patient = patients[index];
                item.querySelector('h4').textContent = `${patient.userId.firstName} ${patient.userId.lastName}`;
                item.querySelector('p').textContent = `${patient.panchakarmaHistory?.currentTherapy?.type || 'General'} Therapy - Session ${patient.panchakarmaHistory?.currentTherapy?.sessionsCompleted || 0}/${patient.panchakarmaHistory?.currentTherapy?.totalSessions || 0}`;
            }
        });
    }
}

function updateProgressDisplay(progressData) {
    // Update progress visualization
    const progressCards = document.querySelectorAll('.progress-card');
    progressCards.forEach((card, index) => {
        if (progressData.therapyProgress) {
            const therapies = Object.keys(progressData.therapyProgress);
            if (therapies[index]) {
                const therapy = progressData.therapyProgress[therapies[index]];
                const progressBar = card.querySelector('.progress-fill');
                if (progressBar) {
                    progressBar.style.width = `${therapy.averageRating * 20}%`; // Convert 1-5 rating to percentage
                    progressBar.setAttribute('data-percentage', Math.round(therapy.averageRating * 20));
                }
            }
        }
    });
}

function updateAnalyticsDisplay(analyticsData) {
    // Update analytics charts and statistics
    console.log('Analytics data:', analyticsData);
    // Implement analytics visualization here
}

function updateNotificationsList(notifications) {
    const notificationsContainer = document.querySelector('.notifications-container');
    if (notificationsContainer && notifications) {
        notificationsContainer.innerHTML = '';
        notifications.forEach(notification => {
            const notificationElement = createNotificationElement(notification);
            notificationsContainer.appendChild(notificationElement);
        });
    }
}

function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = 'notification-item';
    div.innerHTML = `
        <div class="notification-icon">
            <i class="${getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="notification-content">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <span class="notification-time">${formatTimeAgo(notification.createdAt)}</span>
        </div>
    `;
    return div;
}

function getNotificationIcon(type) {
    const icons = {
        'appointment_reminder': 'fas fa-bell',
        'appointment_confirmation': 'fas fa-check-circle',
        'appointment_cancellation': 'fas fa-times-circle',
        'therapy_instructions': 'fas fa-info-circle',
        'feedback_request': 'fas fa-comment',
        'payment_reminder': 'fas fa-credit-card',
        'system_update': 'fas fa-cog',
        'general': 'fas fa-bell'
    };
    return icons[type] || 'fas fa-bell';
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
}

// Export functions for global use
window.PanchakarmaPro = {
    toggleSidebar,
    updateProgress,
    initializeProgressCharts,
    initializeNotifications,
    initializeScheduling,
    initializeFAQ,
    initializeAuthForms,
    handleLogin,
    handleRegister,
    handleFeedbackSubmit,
    loadDashboardData
};
