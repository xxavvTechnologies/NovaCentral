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
    const db = firebase.firestore();
    const auth = firebase.auth();

    async function fetchTrashedItems() {
        const items = [];
        const trashQuery = db.collection('documents')
            .where('userId', '==', auth.currentUser.uid)
            .where('isDeleted', '==', true);

        const snapshot = await trashQuery.get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const daysLeft = Math.ceil((data.deletedAt.toDate().getTime() + (30 * 24 * 60 * 60 * 1000) - Date.now()) / (1000 * 60 * 60 * 24));
            
            items.push({
                id: doc.id,
                daysLeft,
                ...data
            });
        });

        displayTrashedItems(items);
    }

    function displayTrashedItems(items) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        items.forEach(item => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item trash-item';
            fileItem.dataset.id = item.id;
            
            fileItem.innerHTML = `
                <div class="trash-badge">
                    <i class="ri-time-line"></i>
                    ${item.daysLeft} days left
                </div>
                <h3>${item.title || 'Untitled'}</h3>
                <div class="file-item-preview">
                    <span class="modified-date">
                        Deleted ${new Date(item.deletedAt.toDate()).toLocaleDateString()}
                    </span>
                </div>
                <div class="item-actions">
                    <button class="restore-btn" title="Restore">
                        <i class="ri-refresh-line"></i>
                    </button>
                    <button class="delete-btn" title="Delete Permanently">
                        <i class="ri-delete-bin-7-line"></i>
                    </button>
                </div>
            `;
            
            fileList.appendChild(fileItem);

            // Add event listeners
            fileItem.querySelector('.restore-btn').addEventListener('click', () => restoreItem(item.id));
            fileItem.querySelector('.delete-btn').addEventListener('click', () => deletePermanently(item.id));
        });
    }

    async function restoreItem(docId) {
        try {
            await db.collection('documents').doc(docId).update({
                isDeleted: false,
                deletedAt: null
            });
            fetchTrashedItems(); // Refresh the list
        } catch (error) {
            console.error('Error restoring item:', error);
        }
    }

    async function deletePermanently(docId) {
        if (confirm('This action cannot be undone. Are you sure?')) {
            try {
                await db.collection('documents').doc(docId).delete();
                fetchTrashedItems(); // Refresh the list
            } catch (error) {
                console.error('Error deleting item:', error);
            }
        }
    }

    // Auth state observer
    auth.onAuthStateChanged(user => {
        if (user) {
            const userEmailEl = document.getElementById('userEmail');
            if(userEmailEl) {
                userEmailEl.textContent = user.email;
            }
            fetchTrashedItems();
            initializeSharedFunctionality();
        } else {
            window.location.href = '/login.html';
        }
    });

    // Initialize shared functionality (same as apps.js)
    function initializeSharedFunctionality() {
        // ...copy shared functionality from apps.js...
    }
});
