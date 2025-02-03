export class FileSystem {
    constructor() {
        this.currentPath = '/';
        this.storage = window.localStorage;
        this.sortBy = 'name';
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
        try {
            const fileData = await this.readFile(file);
            const filesystem = JSON.parse(this.storage.getItem('filesystem'));
            
            const fileNode = {
                type: 'file',
                name: file.name,
                size: file.size,
                mimeType: file.type || this.getMimeTypeFromName(file.name),
                path: `${this.currentPath}${file.name}`,
                storageKey: `file_${Date.now()}_${file.name}`,
                lastModified: file.lastModified
            };

            // Store the actual file data
            localStorage.setItem(fileNode.storageKey, fileData);
            
            // Add file to filesystem
            this.addToPath(filesystem, this.currentPath, fileNode);
            this.storage.setItem('filesystem', JSON.stringify(filesystem));
            
            return fileNode;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    async addImportedFile(fileData) {
        const filesystem = JSON.parse(this.storage.getItem('filesystem'));
        const importFolder = await this.ensureImportFolder(filesystem);
        
        fileData.importedFrom = new URL(fileData.path).hostname;
        importFolder.children.push(fileData);
        
        this.storage.setItem('filesystem', JSON.stringify(filesystem));
    }

    async ensureImportFolder(filesystem) {
        let importFolder = filesystem.children.find(
            child => child.type === 'folder' && child.name === 'Imported'
        );

        if (!importFolder) {
            importFolder = {
                type: 'folder',
                name: 'Imported',
                path: '/Imported/',
                children: []
            };
            filesystem.children.push(importFolder);
        }

        return importFolder;
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            
            if (file.type.startsWith('image/') || 
                file.type.startsWith('video/') || 
                file.type.startsWith('audio/') ||
                file.type.includes('pdf')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    getMimeTypeFromName(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            txt: 'text/plain',
            pdf: 'application/pdf',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            mp4: 'video/mp4',
            mp3: 'audio/mpeg'
        };
        return mimeTypes[ext] || 'application/octet-stream';
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
        
        const contents = [...current.children];
        return this.sortContents(contents);
    }

    sortContents(contents) {
        // Always put folders first
        contents.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }

            switch(this.sortBy) {
                case 'size':
                    return (b.size || 0) - (a.size || 0);
                case 'date':
                    return (b.lastModified || 0) - (a.lastModified || 0);
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
        return contents;
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
                <i class="fas fa-folder"></i>
                <span class="folder-name">${node.name}</span>
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
                <i class="fas ${item.type === 'folder' ? 'fa-folder' : this.getFileIcon(item.mimeType)}"></i>
                <div class="file-name">${item.name}</div>
                ${item.type === 'file' ? `<div class="file-size">${this.formatSize(item.size)}</div>` : ''}
            </div>
        `).join('');
    }

    getFileIcon(mimeType) {
        if (!mimeType) return 'fa-file';
        if (mimeType.startsWith('image/')) return 'fa-image';
        if (mimeType.startsWith('video/')) return 'fa-video';
        if (mimeType.startsWith('audio/')) return 'fa-music';
        if (mimeType.includes('pdf')) return 'fa-file-pdf';
        if (mimeType.includes('word')) return 'fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'fa-file-excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
        if (mimeType.includes('text')) return 'fa-file-lines';
        if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'fa-file-zipper';
        return 'fa-file';
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
