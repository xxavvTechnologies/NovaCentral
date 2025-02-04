export class FileSystem {
    constructor() {
        this.currentPath = '/';
        this.storage = window.localStorage;
        this.sortBy = 'name';
        this.trash = [];
        this.favorites = new Set();
        this.recentFiles = [];
        this.fileVersions = new Map();
        this.viewMode = 'grid'; // or 'list'
    }

    async init() {
        try {
            if (!this.storage.getItem('filesystem')) {
                await this.initializeEmptyFileSystem();
            }
            await this.loadSavedStates();
        } catch (error) {
            console.error('Error initializing filesystem:', error);
            // Create minimal state if loading fails
            await this.initializeEmptyFileSystem();
        }
    }

    async initializeEmptyFileSystem() {
        const emptyFs = {
            type: 'folder',
            name: 'root',
            path: '/',
            children: []
        };
        
        // Use batch operation to avoid quota issues
        const batch = {
            filesystem: JSON.stringify(emptyFs),
            trash: '[]',
            favorites: '[]',
            recentFiles: '[]',
            fileVersions: '[]'
        };

        // Store all initial data at once
        Object.entries(batch).forEach(([key, value]) => {
            try {
                this.storage.setItem(key, value);
            } catch (e) {
                console.warn(`Failed to initialize ${key}:`, e);
            }
        });
    }

    async loadSavedStates() {
        try {
            this.trash = JSON.parse(this.storage.getItem('trash')) || [];
            this.favorites = new Set(JSON.parse(this.storage.getItem('favorites')) || []);
            this.recentFiles = JSON.parse(this.storage.getItem('recentFiles')) || [];
            this.fileVersions = new Map(JSON.parse(this.storage.getItem('fileVersions')) || []);
        } catch (error) {
            console.error('Error loading saved states:', error);
            // Reset to defaults if loading fails
            this.trash = [];
            this.favorites = new Set();
            this.recentFiles = [];
            this.fileVersions = new Map();
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
            const compressedFile = await this.compressFile(file);
            const fileData = await this.readFile(compressedFile);
            
            // Check available space before storing
            const requiredSpace = fileData.length * 2; // UTF-16 encoding
            const availableSpace = this.getAvailableSpace();
            
            if (requiredSpace > availableSpace) {
                throw new Error('Insufficient storage space');
            }

            // Clean up old files if needed
            await this.cleanupOldFiles(requiredSpace);

            const filesystem = JSON.parse(this.storage.getItem('filesystem'));
            
            const fileNode = {
                type: 'file',
                name: compressedFile.name,
                size: compressedFile.size,
                mimeType: compressedFile.type || this.getMimeTypeFromName(compressedFile.name),
                path: `${this.currentPath}${compressedFile.name}`,
                storageKey: `file_${Date.now()}_${compressedFile.name}`,
                lastModified: compressedFile.lastModified
            };

            // Store the actual file data
            localStorage.setItem(fileNode.storageKey, fileData);
            
            // Add file to filesystem
            this.addToPath(filesystem, this.currentPath, fileNode);
            this.storage.setItem('filesystem', JSON.stringify(filesystem));
            
            this.addToRecent(fileNode);
            
            return fileNode;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    getAvailableSpace() {
        const totalSpace = this.getTotalSpace();
        const usedSpace = this.getUsedSpace();
        return totalSpace - usedSpace;
    }

    async cleanupOldFiles(requiredSpace) {
        if (this.getAvailableSpace() >= requiredSpace) return;

        // Remove old files from trash first
        for (const file of this.trash) {
            if (file.storageKey) {
                this.storage.removeItem(file.storageKey);
            }
        }
        this.trash = [];
        this.storage.setItem('trash', '[]');

        // If still needed, remove old versions
        if (this.getAvailableSpace() < requiredSpace) {
            this.fileVersions.clear();
            this.storage.setItem('fileVersions', '[]');
        }
    }

    async compressFile(file) {
        if (file.type.startsWith('image/')) {
            return this.compressImage(file);
        } else if (file.type.startsWith('video/')) {
            return this.compressVideo(file);
        }
        return file;
    }

    async compressImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1920px width/height)
                let width = img.width;
                let height = img.height;
                const maxSize = 1920;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: file.lastModified
                    }));
                }, 'image/jpeg', 0.85); // 85% quality
                
                URL.revokeObjectURL(img.src);
            };
        });
    }

    async compressVideo(file) {
        // Basic video compression using HTML5 video element
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.onloadedmetadata = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Reduce resolution if needed
                let width = video.videoWidth;
                let height = video.videoHeight;
                const maxSize = 1280;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                
                // Capture first frame for thumbnail
                ctx.drawImage(video, 0, 0, width, height);
                
                URL.revokeObjectURL(video.src);
                resolve(file); // For now, just return original file
                // TODO: Implement proper video compression using WebCodecs API
                // when it becomes more widely supported
            };
        });
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

    addToRecent(file) {
        this.recentFiles = [file, ...this.recentFiles.filter(f => f.path !== file.path)].slice(0, 20);
        localStorage.setItem('recentFiles', JSON.stringify(this.recentFiles));
    }

    toggleFavorite(path) {
        if (this.favorites.has(path)) {
            this.favorites.delete(path);
        } else {
            this.favorites.add(path);
        }
        localStorage.setItem('favorites', JSON.stringify([...this.favorites]));
    }

    async moveToTrash(path) {
        const file = this.getFile(path);
        if (file) {
            this.trash.push({ ...file, deletedAt: Date.now() });
            await this.deleteItem(path);
            localStorage.setItem('trash', JSON.stringify(this.trash));
        }
    }

    async restoreFromTrash(path) {
        const fileIndex = this.trash.findIndex(f => f.path === path);
        if (fileIndex !== -1) {
            const file = this.trash[fileIndex];
            this.trash.splice(fileIndex, 1);
            // Restore file to filesystem
            await this.restoreFile(file);
            localStorage.setItem('trash', JSON.stringify(this.trash));
        }
    }

    addFileVersion(path, content) {
        const versions = this.fileVersions.get(path) || [];
        versions.push({
            content,
            timestamp: Date.now(),
            size: content.length
        });
        this.fileVersions.set(path, versions.slice(-10)); // Keep last 10 versions
        localStorage.setItem('fileVersions', JSON.stringify([...this.fileVersions]));
    }

    searchFiles(query) {
        const searchResults = [];
        const queryLower = query.toLowerCase();
        
        const searchNode = (node) => {
            // Search in file/folder name
            if (node.name.toLowerCase().includes(queryLower)) {
                searchResults.push(node);
                return;
            }
            
            // For files, also search in content if it's a text file
            if (node.type === 'file' && this.isTextFile(node.mimeType)) {
                const content = localStorage.getItem(node.storageKey);
                if (content && content.toLowerCase().includes(queryLower)) {
                    searchResults.push(node);
                    return;
                }
            }
            
            // Recursively search in children
            if (node.children) {
                node.children.forEach(searchNode);
            }
        };
        
        const filesystem = JSON.parse(localStorage.getItem('filesystem'));
        searchNode(filesystem);
        
        return searchResults;
    }

    isTextFile(mimeType) {
        return mimeType?.startsWith('text/') || 
               mimeType?.includes('javascript') ||
               mimeType?.includes('json');
    }

    getFavorites() {
        return Array.from(this.favorites)
            .map(path => this.getFile(path))
            .filter(Boolean);
    }

    getRecentFiles() {
        return this.recentFiles
            .map(file => this.getFile(file.path))
            .filter(Boolean);
    }

    getTrash() {
        // Filter out items older than 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        this.trash = this.trash.filter(item => item.deletedAt > thirtyDaysAgo);
        localStorage.setItem('trash', JSON.stringify(this.trash));
        return this.trash;
    }

    emptyTrash() {
        this.trash.forEach(file => {
            if (file.storageKey) {
                localStorage.removeItem(file.storageKey);
            }
        });
        this.trash = [];
        localStorage.setItem('trash', JSON.stringify(this.trash));
    }
}
