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
        for (const file of files) {
            await this.fileSystem.uploadFile(file);
        }
        this.render();
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
        info.innerHTML = `
            <div class="storage-bar">
                <div class="used" style="width: ${(used/total)*100}%"></div>
            </div>
            <div class="storage-text">${this.formatSize(used)} of ${this.formatSize(total)} used</div>
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
        const file = this.fileSystem.getFile(path);
        if (file && file.storageKey) {
            const data = this.storage.getItem(file.storageKey);
            if (file.mimeType.startsWith('image/') || 
                file.mimeType.startsWith('video/') || 
                file.mimeType.startsWith('audio/')) {
                this.previewFile(path);
            } else {
                const a = document.createElement('a');
                a.href = `data:${file.mimeType};charset=utf-8,${encodeURIComponent(data)}`;
                a.download = file.name;
                a.click();
            }
        }
    }

    getFilesGridHTML(contents) {
        return this.fileSystem.getFilesGridHTML(contents);
    }

    initializeContextMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" data-action="preview">
                <span>👁️</span>
                <span>Preview</span>
            </div>
            <div class="menu-item" data-action="share">
                <span>🔗</span>
                <span>Share</span>
            </div>
            <div class="menu-item" data-action="download">
                <span>⬇️</span>
                <span>Download</span>
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item" data-action="rename">
                <span>✏️</span>
                <span>Rename</span>
            </div>
            <div class="menu-item" data-action="move">
                <span>📦</span>
                <span>Move to</span>
            </div>
            <div class="menu-separator"></div>
            <div class="menu-item danger" data-action="delete">
                <span>🗑️</span>
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
        if (file && file.storageKey) {
            const data = this.storage.getItem(file.storageKey);
            const a = document.createElement('a');
            a.href = data;
            a.download = file.name;
            a.click();
        }
    }

    previewFile(path) {
        const file = this.fileSystem.getFile(path);
        if (!file) return;

        const data = this.storage.getItem(file.storageKey);
        const preview = document.createElement('dialog');
        preview.className = 'file-preview';
        
        let content = '';
        if (file.mimeType.startsWith('image/')) {
            content = `<img src="${data}" alt="${file.name}">`;
        } else if (file.mimeType.startsWith('video/')) {
            content = `<video controls src="${data}"></video>`;
        } else if (file.mimeType.startsWith('audio/')) {
            content = `<audio controls src="${data}"></audio>`;
        } else if (typeof data === 'string') {
            content = `<div class="preview-text">${data.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
        } else {
            content = `<div class="preview-text">Preview not available</div>`;
        }

        preview.innerHTML = `
            <div class="preview-header">
                <h3>${file.name}</h3>
                <button onclick="this.closest('dialog').close()">×</button>
            </div>
            <div class="preview-content">${content}</div>
        `;

        document.body.appendChild(preview);
        preview.showModal();

        // Clean up when dialog is closed
        preview.addEventListener('close', () => {
            preview.remove();
        });
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

    previewFile(path) {
        const file = this.fileSystem.getFile(path);
        if (!file) return;

        const data = this.storage.getItem(file.storageKey);
        const preview = document.createElement('dialog');
        preview.className = 'file-preview';
        
        let content = '';
        if (file.mimeType.startsWith('image/')) {
            content = `<img src="${data}" alt="${file.name}">`;
        } else if (file.mimeType.startsWith('video/')) {
            content = `<video controls src="${data}"></video>`;
        } else if (file.mimeType.startsWith('audio/')) {
            content = `<audio controls src="${data}"></audio>`;
        } else {
            content = `<div class="preview-text">${data}</div>`;
        }

        preview.innerHTML = `
            <div class="preview-header">
                <h3>${file.name}</h3>
                <button onclick="this.closest('dialog').close()">×</button>
            </div>
            <div class="preview-content">${content}</div>
        `;

        document.body.appendChild(preview);
        preview.showModal();
    }
}
