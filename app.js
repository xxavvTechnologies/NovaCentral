// Wait for Firebase SDK to load
document.addEventListener('DOMContentLoaded', function() {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyAeNLHp2EO50B0PrZuBchOJvxhxHlVuVu4",
        authDomain: "novasuite-e4257.firebaseapp.com",
        databaseURL: "https://novasuite-e4257-default-rtdb.firebaseio.com",
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

    // File display functions
    function displayFiles(items) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        if (!items.length) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <i class="ri-file-text-line"></i>
                    <h3>No documents found</h3>
                    <p>Click the "Create New" button to get started</p>
                </div>
            `;
            return;
        }

        items.forEach(item => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.id = item.id;
            
            // Show minimal info by default
            fileItem.innerHTML = `
                <div class="app-badge">
                    <img src="assets/doc-icon.svg" alt="Nova Docs" class="doc-icon">
                    Nova Docs
                </div>
                <h3>${item.title || 'Untitled'}</h3>
                <div class="file-item-preview">
                    <span class="modified-date">
                        ${new Date(item.lastModified).toLocaleDateString()}
                    </span>
                    ${item.isPublic ? '<span class="tag public">Public</span>' : ''}
                </div>
            `;
            
            fileItem.innerHTML += `
                <div class="item-actions">
                    <button class="favorite-btn ${item.isFavorite ? 'active' : ''}" title="Toggle Favorite">
                        <i class="ri-star-${item.isFavorite ? 'fill' : 'line'}"></i>
                    </button>
                    <button class="trash-btn" title="Move to Trash">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;

            // Add event listeners
            fileItem.querySelector('.favorite-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item.id);
            });

            fileItem.querySelector('.trash-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                moveToTrash(item.id);
            });

            fileItem.addEventListener('click', () => showDocumentDetails(item));
            fileList.appendChild(fileItem);
        });
    }

    // Show document details in sidebar
    async function showDocumentDetails(item) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const documentDetails = document.getElementById('documentDetails');
        
        // Display main document details
        documentDetails.innerHTML = getDetailedContent(item);
        
        // Fetch and display revisions
        try {
            const revisions = await fetchRevisions(item.id);
            displayRevisions(revisions);
        } catch (error) {
            console.error('Error fetching revisions:', error);
        }
        
        // Show sidebar and overlay
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }

    // Get detailed content for sidebar
    function getDetailedContent(item) {
        const lastMod = item.lastModified ? new Date(item.lastModified) : null;
        const created = item.createdAt ? new Date(item.createdAt) : null;
        
        return `
            <h2>${item.title || 'Untitled'}</h2>
            <div class="doc-metadata">
                <p>
                    <span class="label">Status:</span> 
                    ${item.isPublic ? 
                        '<span class="tag public">Public</span>' : 
                        '<span class="tag private">Private</span>'}
                    ${item.allowCopy ? 
                        '<span class="tag copyable">Copyable</span>' : 
                        '<span class="tag no-copy">No Copy</span>'}
                </p>
                <p><span class="label">Pages:</span> ${item.pages || 1}</p>
                <p><span class="label">Created:</span> ${created ? created.toLocaleDateString() : 'Unknown'}</p>
                <p><span class="label">Modified:</span> ${lastMod ? lastMod.toLocaleDateString() : 'Unknown'}</p>
                ${item.sharedWith && item.sharedWith.length > 0 ? 
                    `<p><span class="label">Shared with:</span> ${item.sharedWith.length} users</p>` : 
                    ''}
                <p class="doc-preview"><span class="label">Preview:</span><br>
                    ${item.content ? stripHtml(item.content).substring(0, 100) + '...' : 'No content'}
                </p>
            </div>
            <a href="https://docs.nova.xxavvgroup.com/editor.html?id=${item.id}" 
               target="_blank" 
               class="open-in-app">
                Open in Nova Docs
            </a>
        `;
    }

    // Fetch document revisions
    async function fetchRevisions(docId) {
        const revisionsSnapshot = await db.collection('documents')
            .doc(docId)
            .collection('revisions')
            .orderBy('timestamp', 'desc')
            .get();
            
        return revisionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Display revisions in sidebar
    function displayRevisions(revisions) {
        const revisionsList = document.getElementById('revisionsList');
        revisionsList.innerHTML = revisions.map(rev => `
            <div class="revision-item">
                <div class="revision-timestamp">
                    ${new Date(rev.timestamp).toLocaleString()}
                </div>
                <div class="revision-type">${rev.type}</div>
                ${rev.content ? `<div class="revision-preview">${stripHtml(rev.content).substring(0, 50)}...</div>` : ''}
            </div>
        `).join('');
    }

    // Helper function to strip HTML tags for preview
    function stripHtml(html) {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    // Fetch items from multiple collections
    async function fetchFiles(view = 'all') {
        try {
            const items = [];
            const path = window.location.pathname;
            const currentPage = path.split('/').pop() || 'index.html';
            console.log('Current path:', path);
            console.log('Current page:', currentPage);
            
            if (!auth.currentUser) {
                console.log('No authenticated user');
                return;
            }
            console.log('User ID:', auth.currentUser.uid);
            
            // Base query for documents owned by current user
            let docsQuery = db.collection('documents')
                .where('userId', '==', auth.currentUser.uid);

            // Add conditions based on current page
            switch (currentPage) {
                case 'favorites.html':
                    console.log('Fetching favorites');
                    docsQuery = docsQuery.where('isFavorite', '==', true)
                                       .where('isDeleted', '==', false);
                    break;
                case 'trash.html':
                    console.log('Fetching trash');
                    docsQuery = docsQuery.where('isDeleted', '==', true);
                    break;
                default:
                    console.log('Fetching all documents');
                    docsQuery = docsQuery.where('isDeleted', '==', false);
                    if (view !== 'all') {
                        docsQuery = docsQuery.where('app', '==', view);
                    }
            }

            const docsSnapshot = await docsQuery.get();
            console.log('Query results:', docsSnapshot.size);
            
            docsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId === auth.currentUser.uid) {
                    items.push({ 
                        id: doc.id, 
                        type: 'document',
                        ...data 
                    });
                }
            });
            console.log('Processed items:', items.length);

            // Sort all items by creation date
            items.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA;
            });

            displayFiles(items);
            updateAppFilter(items);
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    }

    // Update app filter options
    function updateAppFilter(items) {
        const apps = [...new Set(items.map(item => item.app).filter(Boolean))];
        const appFilter = document.getElementById('appFilter');
        appFilter.innerHTML = '<option value="all">All Apps</option>';
        
        apps.forEach(app => {
            const option = document.createElement('option');
            option.value = app;
            option.textContent = app;
            appFilter.appendChild(option);
        });
    }

    // Event listeners
    const appFilter = document.getElementById('appFilter');
    const navSidebar = document.querySelector('.nav-sidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const collapseBtn = document.getElementById('collapseBtn');
    const userInfo = document.getElementById('userInfo');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    // Initialize shared functionality
    function initializeSharedFunctionality() {
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

            // Close mobile menu when clicking outside
            document.addEventListener('click', (e) => {
                if (isMobile && 
                    !navSidebar.contains(e.target) && 
                    !mobileMenuBtn.contains(e.target)) {
                    navSidebar.classList.remove('active');
                    mobileMenuBtn.querySelector('i').className = 'ri-menu-line';
                }
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

    // App-specific listeners 
    if (appFilter) {
        appFilter.addEventListener('change', (e) => {
            fetchFiles(e.target.value);
        });
    }

    if (closeSidebarBtn && sidebar && overlay) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Initialize shared functionality
    initializeSharedFunctionality();

    // Auth state observer
    auth.onAuthStateChanged(user => {
        if (user) {
            const userEmailEl = document.getElementById('userEmail');
            if(userEmailEl) {
                userEmailEl.textContent = user.email;
            }
            // Fix for document loading - check if page has file listing
            const fileList = document.getElementById('fileList');
            if (fileList) {
                fetchFiles();
            }
        } else {
            window.location.href = '/login.html';
        }
    });

    // Update create button content
    document.querySelector('.create-btn').innerHTML = `
        <i class="ri-add-line"></i>
        Create New
    `;

    async function toggleFavorite(docId) {
        const docRef = db.collection('documents').doc(docId);
        const doc = await docRef.get();
        
        await docRef.update({
            isFavorite: !doc.data().isFavorite
        });
        
        // Refresh file list
        fetchFiles();
    }

    async function moveToTrash(docId) {
        try {
            await db.collection('documents').doc(docId).update({
                isDeleted: true,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            fetchFiles();
        } catch (error) {
            console.error('Error moving to trash:', error);
        }
    }
});
