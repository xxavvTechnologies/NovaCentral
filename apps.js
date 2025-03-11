document.addEventListener('DOMContentLoaded', function() {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyAeNLHp2EO50B0PrZuBchOJvxhxHlVuVu4",
        authDomain: "novasuite-e4257.firebaseapp.com",
        projectId: "novasuite-e4257",
        storageBucket: "novasuite-e4257.firebasestorage.app",
        messagingSenderId: "349176160657",
        appId: "1:349176160657:web:ebe15f4a9d197b27f63a30",
        measurementId: "G-S4TN3QEV0Q"
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();

    // Auth state observer
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        // Initialize UI elements now that we're authenticated
        const userEmailEl = document.getElementById('userEmail');
        if(userEmailEl) {
            userEmailEl.textContent = user.email;
        }
        initializeSharedFunctionality();
    });

    // Initialize shared functionality
    function initializeSharedFunctionality() {
        const navSidebar = document.querySelector('.nav-sidebar');
        const collapseBtn = document.getElementById('collapseBtn');
        const userInfo = document.getElementById('userInfo');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        // Collapse sidebar
        if(collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                navSidebar.classList.toggle('collapsed');
                const icon = collapseBtn.querySelector('i');
                if (navSidebar.classList.contains('collapsed')) {
                    icon.className = 'ri-menu-unfold-line';
                } else {
                    icon.className = 'ri-menu-fold-line';
                }
            });
        }

        // User dropdown functionality
        if(userInfo) {
            document.addEventListener('click', (e) => {
                if (userInfo.contains(e.target)) {
                    userInfo.classList.toggle('active');
                } else {
                    userInfo.classList.remove('active');
                }
            });

            // Sign out functionality
            const signOutBtn = document.getElementById('signOutBtn');
            if(signOutBtn) {
                signOutBtn.addEventListener('click', () => {
                    auth.signOut().then(() => {
                        window.location.href = '/login.html';
                    });
                });
            }
        }

        // Mobile menu functionality
        if(mobileMenuBtn && navSidebar) {
            if (isMobile) {
                navSidebar.classList.add('collapsed');
            }

            mobileMenuBtn.addEventListener('click', () => {
                navSidebar.classList.toggle('active');
                const icon = mobileMenuBtn.querySelector('i');
                icon.className = navSidebar.classList.contains('active') ? 
                    'ri-close-line' : 'ri-menu-line';
            });
        }

        // Window resize handler
        window.addEventListener('resize', () => {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (isMobile && navSidebar) {
                navSidebar.classList.add('collapsed');
            }
        });
    }
});
