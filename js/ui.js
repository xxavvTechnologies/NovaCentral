export class UIManager {
    constructor(storage, fileSystem) {
        this.storage = storage;
        this.fileSystem = fileSystem;
        this.bindEvents();
        this.searchTimeout = null;
        this.initializeContextMenu();
        this.activeContextItem = null;
    }

    bindEvents() {
        document.getElementById('upload-btn').addEventListener('click', () => this.handleUpload());
        document.getElementById('new-folder-btn').addEventListener('click', () => this.createNewFolder());
        
        const dropZone = document.querySelector('.files-grid');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFileDrop(e.dataTransfer.files);
        });

        document.querySelector('.folder-tree').addEventListener('click', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                const path = folderItem.dataset.path;
                this.fileSystem.currentPath = path;
                this.render();
            }
        });

        document.querySelector('.files-grid').addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const path = fileItem.dataset.path;
                if (path.endsWith('/')) {
                    this.fileSystem.currentPath = path;
                    this.render();
                } else {
                    this.openFile(path);
                }
            }
        });

        // Add search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'f': 
                        e.preventDefault();
                        document.getElementById('search-input').focus();
                        break;
                    case 'c': 
                        this.handleCopy();
                        break;
                    case 'v':
                        this.handlePaste();
                        break;
                }
            }
            if (e.key === 'Delete') {
                this.handleDelete();
            }
        });
    }

    render() {
        this.renderFolderTree();
        this.renderFiles();
        this.updateStorageInfo();
    }

    async handleUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            await this.handleFileDrop(files);
        };
        input.click();
    }

    async handleFileDrop(files) {
        try {
            for (const file of files) {
                await this.fileSystem.uploadFile(file);
            }
            this.render();
        } catch (error) {
            console.error('Error handling file drop:', error);
            alert('Error uploading file. Please try again.');
        }
    }

    async createNewFolder() {
        const name = prompt('Enter folder name:');
        if (name) {
            await this.fileSystem.createFolder(this.fileSystem.currentPath, name);
            this.render();
        }
    }

    renderFolderTree() {
        const tree = document.querySelector('.folder-tree');
        tree.innerHTML = this.fileSystem.getFolderTreeHTML();
    }

    renderFiles() {
        const grid = document.querySelector('.files-grid');
        const contents = this.fileSystem.getContents(this.fileSystem.currentPath);
        grid.innerHTML = this.getFilesGridHTML(contents);
    }

    updateStorageInfo() {
        const info = document.querySelector('.storage-info');
        const used = this.storage.getUsedSpace();
        const total = this.storage.getTotalSpace();
        const percentage = (used/total) * 100;
        info.innerHTML = `
            <h2 class="storage-title">
                <i class="fas fa-hard-drive"></i>
                <span>Storage Space</span>
            </h2>
            <div class="storage-bar">
                <div class="used" style="width: ${percentage}%"></div>
            </div>
            <div class="storage-text">
                <i class="fas fa-chart-pie"></i>
                <strong>${this.formatSize(used)}</strong> used of <strong>${this.formatSize(total)}</strong>
                <div class="storage-percentage">${percentage.toFixed(1)}% used</div>
            </div>
        `;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    async openFile(path) {
        // Always show preview first
        this.previewFile(path);
    }

    previewFile(path) {
        const file = this.fileSystem.getFile(path);
        if (!file) return;

        const data = localStorage.getItem(file.storageKey);
        if (!data) return;

        const preview = document.createElement('dialog');
        preview.className = 'file-preview fullscreen';
        
        let content = '';
        try {
            if (file.mimeType.startsWith('image/')) {
                content = `<img src="${data}" alt="${file.name}">`;
            } else if (file.mimeType.startsWith('video/')) {
                content = `<video controls src="${data}"></video>`;
            } else if (file.mimeType.startsWith('audio/')) {
                content = `<audio controls src="${data}"></audio>`;
            } else if (file.mimeType === 'application/pdf') {
                content = `<iframe src="${data}" width="100%" height="100%"></iframe>`;
            } else {
                const textContent = data.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                content = `<div class="preview-text"><pre>${textContent}</pre></div>`;
            }
        } catch (error) {
            content = '<div class="preview-error">Error previewing file</div>';
        }

        preview.innerHTML = `
            <div class="preview-toolbar">
                <div class="preview-title">
                    <h3>${file.name}</h3>
                    <span class="preview-meta">${this.formatSize(file.size)} · ${file.mimeType}</span>
                </div>
                <div class="preview-actions">
                    <button class="action-btn" onclick="this.closest('dialog').querySelector('a.download-link').click()">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn" onclick="this.closest('dialog').close()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="preview-content">${content}</div>
            <a class="download-link hidden" href="${data}" download="${file.name}"></a>
        `;

        document.body.appendChild(preview);
        preview.showModal();

        preview.addEventListener('close', () => {
            preview.remove();
        });
    }

    getFilesGridHTML(contents) {
        if (!contents?.length) {
            return `
                <div class="empty-state">
                    <i class="fas fa-folder-open empty-icon"></i>
                    <h3>No files here yet</h3>
                    <p>Drop files here or use the upload button</p>
                </div>
            `;
        }

        return contents.map(item => `
            <div class="file-item" data-path="${item.path}">
                <div class="file-type-indicator">${this.getFileType(item)}</div>
                <i class="fas ${item.type === 'folder' ? 'fa-folder' : this.fileSystem.getFileIcon(item.mimeType)}"></i>
                <div class="file-name" title="${item.name}">${this.truncateFileName(item.name)}</div>
                ${item.type === 'file' ? `
                    <div class="file-info">
                        <span class="file-size">${this.formatSize(item.size)}</span>
                        ${item.importedFrom ? `<span class="file-source">From ${item.importedFrom}</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    truncateFileName(name) {
        if (name.length <= 20) return name;
        const ext = name.split('.').pop();
        const base = name.slice(0, -ext.length - 1);
        return base.slice(0, 16) + '...' + '.' + ext;
    }

    getFileType(item) {
        if (item.type === 'folder') return 'Folder';
        const ext = item.name.split('.').pop().toLowerCase();
        return ext.toUpperCase();
    }

    initializeContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" data-action="preview">
                <i class="fas fa-eye"></i>
                <span>Preview</span>
            </div>
            <div class="menu-item" data-action="share">
                <i class="fas fa-share-nodes"></i>
                <span>Share</span>
            </div>
            <div class="menu-item" data-action="download">
                <i class="fas fa-download"></i>
                <span>Download</span>
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" data-action="rename">
                <i class="fas fa-pen"></i>
                <span>Rename</span>
            </div>
            <div class="menu-item" data-action="move">
                <i class="fas fa-arrows-up-down-left-right"></i>
                <span>Move to</span>
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item danger" data-action="delete">
                <i class="fas fa-trash"></i>
                <span>Delete</span>
            </div>
        `;
        document.body.appendChild(menu);

        // Hide menu on click outside
        document.addEventListener('click', () => this.hideContextMenu());
        
        // Prevent context menu from being hidden when clicking inside it
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.dataset.action;
            if (action) {
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            }
        });

        // Add context menu trigger
        document.addEventListener('contextmenu', (e) => {
            const fileItem = e.target.closest('.file-item');
            const folderItem = e.target.closest('.folder-item');
            if (fileItem || folderItem) {
                e.preventDefault();
                this.activeContextItem = fileItem || folderItem;
                this.showContextMenu(e.pageX, e.pageY);
            }
        });
    }

    showContextMenu(x, y) {
        const menu = document.querySelector('.context-menu');
        menu.style.display = 'block';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Ensure menu stays within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }
    }

    hideContextMenu() {
        const menu = document.querySelector('.context-menu');
        menu.style.display = 'none';
        this.activeContextItem = null;
    }

    async handleContextMenuAction(action) {
        if (!this.activeContextItem) return;
        const path = this.activeContextItem.dataset.path;

        switch(action) {
            case 'open':
                this.openFile(path);
                break;
            case 'preview':
                this.previewFile(path);
                break;
            case 'download':
                this.downloadFile(path);
                break;
            case 'share':
                await this.handleShare(path);
                break;
            case 'rename':
                await this.handleRename(path);
                break;
            case 'delete':
                await this.handleDelete(path);
                break;
            case 'copy':
                this.handleCopy(path);
                break;
            case 'cut':
                this.handleCut(path);
                break;
        }
    }

    async handleRename(path) {
        const item = this.fileSystem.getFile(path);
        if (!item) return;

        const newName = prompt('Enter new name:', item.name);
        if (newName && newName !== item.name) {
            await this.fileSystem.renameItem(path, newName);
            this.render();
        }
    }

    downloadFile(path) {
        const file = this.fileSystem.getFile(path);
        if (!file || !file.storageKey) return;

        const data = localStorage.getItem(file.storageKey);
        if (!data) {
            console.error('File data not found:', file);
            return;
        }

        const a = document.createElement('a');
        if (data.startsWith('data:')) {
            a.href = data;
        } else {
            // Handle text files
            const blob = new Blob([data], { type: file.mimeType });
            a.href = URL.createObjectURL(blob);
        }
        a.download = file.name;
        a.click();
        
        if (!data.startsWith('data:')) {
            URL.revokeObjectURL(a.href);
        }
    }

    async handleSearch(query) {
        const results = await this.fileSystem.searchFiles(query);
        this.renderSearchResults(results);
    }

    async handleDelete() {
        const selected = this.getSelectedItems();
        if (selected.length && confirm('Are you sure you want to delete selected items?')) {
            for (const item of selected) {
                await this.fileSystem.deleteItem(item.dataset.path);
            }
            this.render();
        }
    }

    async handleShare(path) {
        const shareLink = await this.fileSystem.generateShareLink(path);
        const dialog = document.createElement('dialog');
        dialog.innerHTML = `
            <h3>Share File</h3>
            <input type="text" value="${shareLink}" readonly>
            <button onclick="this.closest('dialog').close()">Close</button>
        `;
        document.body.appendChild(dialog);
        dialog.showModal();
    }

    initializeSearchBar() {
        const searchContainer = document.querySelector('.search-container');
        searchContainer.innerHTML = `
            <div class="search-wrapper">
                <i class="fas fa-search"></i>
                <input type="text" id="search-input" class="search-input" placeholder="Search files and folders...">
            </div>
        `;
    }

    createSortDropdown() {
        const sortDropdown = document.createElement('div');
        sortDropdown.className = 'sort-dropdown';
        sortDropdown.innerHTML = `
            <button class="sort-button">
                <i class="fas fa-sort"></i>
                <span>Sort</span>
            </button>
            <div class="sort-menu">
                <div class="menu-item" data-sort="name">
                    <i class="fas fa-font"></i>
                    <span>Name</span>
                </div>
                <div class="menu-item" data-sort="size">
                    <i class="fas fa-weight"></i>
                    <span>Size</span>
                </div>
                <div class="menu-item" data-sort="date">
                    <i class="fas fa-calendar"></i>
                    <span>Date</span>
                </div>
            </div>
        `;
        document.querySelector('.toolbar').appendChild(sortDropdown);

        // Add sort functionality
        sortDropdown.addEventListener('click', (e) => {
            const sortBy = e.target.closest('.menu-item')?.dataset.sort;
            if (sortBy) this.sortFiles(sortBy);
        });
    }

    sortFiles(by) {
        this.fileSystem.sortBy = by;
        this.render();
    }
}
