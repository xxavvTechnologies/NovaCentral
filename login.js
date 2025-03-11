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

    // Login function
    async function loginUser(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            window.location.href = '/index.html';
        } catch (error) {
            document.getElementById('errorMessage').textContent = error.message;
        }
    }

    // Event listeners
    document.getElementById('loginButton').addEventListener('click', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        loginUser(email, password);
    });

    // Check if user is already logged in
    auth.onAuthStateChanged(user => {
        if (user) {
            window.location.href = '/index.html';
        }
    });
});
