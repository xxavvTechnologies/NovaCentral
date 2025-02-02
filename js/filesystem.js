export class FileSystem {
    constructor() {
        this.currentPath = '/';
        this.storage = window.localStorage;
    }

    async init() {
        if (!this.storage.getItem('filesystem')) {
            this.storage.setItem('filesystem', JSON.stringify({
                type: 'folder',
                name: 'root',
                path: '/',
                children: []
            }));
        }
    }

    async createFolder(path, name) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        const folder = {
            type: 'folder',
            name: name,
            path: `${path}${name}/`,
            children: []
        };
        
        this.addToPath(filesystem, path, folder);
        this.storage.setItem('filesystem', JSON.stringify(filesystem));
    }

    async uploadFile(file) {
        const fileData = await this.readFile(file);
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        
        const fileNode = {
            type: 'file',
            name: file.name,
            size: file.size,
            mimeType: file.type,
            path: `${this.currentPath}${file.name}`,
            storageKey: `file_${Date.now()}_${file.name}`
        };

        this.storage.setItem(fileNode.storageKey, fileData);
        this.addToPath(filesystem, this.currentPath, fileNode);
        this.storage.setItem('filesystem', JSON.stringify(filesystem));
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            
            if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    getFile(path) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        return this.findFile(filesystem, path);
    }

    findFile(node, path) {
        if (node.path === path) return node;
        if (node.children) {
            for (const child of node.children) {
                const found = this.findFile(child, path);
                if (found) return found;
            }
        }
        return null;
    }

    addToPath(filesystem, path, node) {
        const parts = path.split('/').filter(p => p);
        let current = filesystem;
        
        for (const part of parts) {
            current = current.children.find(c => c.name === part);
        }
        
        current.children.push(node);
    }

    getContents(path) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        const parts = path.split('/').filter(p => p);
        let current = filesystem;
        
        for (const part of parts) {
            current = current.children.find(c => c.name === part);
        }
        
        return current.children;
    }

    getFolderTreeHTML() {
        const filesystem = JSON.parse(localStorage.getItem('filesystem')) || this.getDefaultFileSystem();
        return this.renderFolderTreeNode(filesystem);
    }

    renderFolderTreeNode(node, level = 0) {
        if (node.type === 'file') return '';
        
        const padding = level * 20;
        let html = `
            <div class="folder-item" style="padding-left: ${padding}px" data-path="${node.path}">
                <i class="folder-icon">📁</i>
                <span>${node.name}</span>
            </div>
        `;
        
        if (node.children) {
            html += node.children
                .filter(child => child.type === 'folder')
                .map(child => this.renderFolderTreeNode(child, level + 1))
                .join('');
        }
        
        return html;
    }

    getFilesGridHTML(contents) {
        if (!contents) return '<div class="empty-state">No files or folders</div>';
        
        return contents.map(item => `
            <div class="file-item" data-path="${item.path}">
                <i class="file-icon">${item.type === 'folder' ? '📁' : this.getFileIcon(item.mimeType)}</i>
                <div class="file-name">${item.name}</div>
                ${item.type === 'file' ? `<div class="file-size">${this.formatSize(item.size)}</div>` : ''}
            </div>
        `).join('');
    }

    getFileIcon(mimeType) {
        if (!mimeType) return '📄';
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎬';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📕';
        return '📄';
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

    getDefaultFileSystem() {
        return {
            type: 'folder',
            name: 'root',
            path: '/',
            children: []
        };
    }

    async searchFiles(query) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        return this.searchInNode(filesystem, query.toLowerCase());
    }

    searchInNode(node, query) {
        let results = [];
        if (node.name.toLowerCase().includes(query)) {
            results.push(node);
        }
        if (node.children) {
            for (const child of node.children) {
                results = results.concat(this.searchInNode(child, query));
            }
        }
        return results;
    }

    async generateShareLink(path) {
        const file = this.getFile(path);
        if (!file) return null;

        const shareId = `share_${Date.now()}`;
        const shareData = {
            fileData: file,
            expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };

        this.storage.setItem(`share_${shareId}`, JSON.stringify(shareData));
        return `${window.location.origin}/share/${shareId}`;
    }

    async deleteItem(path) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        this.deleteFromPath(filesystem, path);
        this.storage.setItem('filesystem', JSON.stringify(filesystem));
    }

    deleteFromPath(node, path) {
        if (node.children) {
            const index = node.children.findIndex(child => child.path === path);
            if (index !== -1) {
                if (node.children[index].type === 'file') {
                    this.storage.removeItem(node.children[index].storageKey);
                }
                node.children.splice(index, 1);
                return true;
            }
            for (const child of node.children) {
                if (this.deleteFromPath(child, path)) return true;
            }
        }
        return false;
    }

    async renameItem(path, newName) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        const item = this.findFile(filesystem, path);
        if (!item) return;

        const directory = path.split('/').slice(0, -1).join('/') + '/';
        item.name = newName;
        item.path = directory + newName + (item.type === 'folder' ? '/' : '');
        
        if (item.type === 'folder') {
            // Update paths of all children
            this.updateChildPaths(item, directory + newName + '/');
        }

        this.storage.setItem('filesystem', JSON.stringify(filesystem));
    }

    updateChildPaths(folder, newParentPath) {
        if (!folder.children) return;
        
        for (const child of folder.children) {
            child.path = newParentPath + child.name + (child.type === 'folder' ? '/' : '');
            if (child.type === 'folder') {
                this.updateChildPaths(child, child.path);
            }
        }
    }
}
